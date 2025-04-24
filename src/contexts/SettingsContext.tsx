import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { loadUserSettings } from '../utils/loadUserSettings';
import { VertexSettings } from '../types';

export interface SettingsContextProps {
  settings: VertexSettings;
  isLoading: boolean;
  error: string | null;
  saveSettings: (settings: Partial<VertexSettings>) => Promise<void>;
}

const defaultSettings: VertexSettings = {
  vertexProject: '',
  vertexLocation: 'us-central1',
  vertexModel: 'gemini-1.5-flash',
  googleOAuthClientId: '',
};

export const SettingsContext = createContext<SettingsContextProps>({
  settings: defaultSettings,
  isLoading: true,
  error: null,
  saveSettings: async () => {},
});

export const SettingsProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const { core40SDK, extensionSDK } = useContext(ExtensionContext);
  const [settings, setSettings] = useState<VertexSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const userSettings = await loadUserSettings(core40SDK, extensionSDK);
        if (userSettings) {
          setSettings(userSettings);
        }
        setError(null);
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [core40SDK, extensionSDK]);

  const saveSettings = async (newSettings: Partial<VertexSettings>) => {
    try {
      setIsLoading(true);
      const extensionId = extensionSDK?.lookerHostData?.extensionId;
      if (!extensionId) {
        throw new Error('Extension ID not available');
      }
      
      // Convert model_application to lowercase for use in attribute names
      const model_application = extensionId.replace(/::/g, '_').replace(/-/g, '_').toLowerCase();
      
      // Get current user
      const userId = (await core40SDK.ok(core40SDK.me())).id;

      // Update each setting
      for (const [key, value] of Object.entries(newSettings)) {
        if (value === undefined) continue;

        // Convert camelCase to snake_case for user attribute names
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        const attributeName = `${model_application}_${snakeKey}`;
        
        // Find if attribute already exists
        const userAttributes = await core40SDK.ok(
          core40SDK.user_attribute_user_values({
            user_id: userId,
            fields: "name, value, user_attribute_id",
            all_values: true
          })
        );
        
        const existingAttr = userAttributes.find((attr: any) => 
          attr.name.toLowerCase() === attributeName.toLowerCase()
        );
        
        if (existingAttr) {
          // Update existing attribute
          await core40SDK.ok(
            core40SDK.update_user_attribute_user_value(existingAttr.user_attribute_id, {
              user_id: userId,
              value: String(value)
            })
          );
        } else {
          // Create new attribute
          const newAttr = await core40SDK.ok(
            core40SDK.create_user_attribute({
              name: attributeName,
              label: attributeName,
              type: 'string',
              value_is_hidden: false,
              user_can_view: true,
              user_can_edit: true,
            })
          );
          
          await core40SDK.ok(
            core40SDK.update_user_attribute_user_value(newAttr.id, {
              user_id: userId,
              value: String(value)
            })
          );
        }
      }
      
      // Update local settings
      setSettings(prev => ({
        ...prev,
        ...newSettings
      }));
      
      setError(null);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, isLoading, error, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
