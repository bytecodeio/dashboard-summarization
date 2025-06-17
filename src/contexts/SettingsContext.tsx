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
  vertexModel: 'gemini-2.0-flash',
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
        
        // First, try to load from extension context
        let contextSettings: VertexSettings | null = null;
        try {
          const contextData = extensionSDK.getContextData();
          if (contextData && typeof contextData === 'object') {
            // Validate that the context data has the expected structure
            if ('vertexProject' in contextData || 'vertexLocation' in contextData || 
                'vertexModel' in contextData || 'googleOAuthClientId' in contextData) {
              contextSettings = {
                vertexProject: contextData.vertexProject || defaultSettings.vertexProject,
                vertexLocation: contextData.vertexLocation || defaultSettings.vertexLocation,
                vertexModel: contextData.vertexModel || defaultSettings.vertexModel,
                googleOAuthClientId: contextData.googleOAuthClientId || defaultSettings.googleOAuthClientId,
              };
            }
          }
        } catch (err) {
          console.warn('Failed to load extension context data:', err);
        }

        // If extension context has settings, use them
        if (contextSettings) {
          setSettings(contextSettings);
        } else {
          // Fallback to user attributes
          const userSettings = await loadUserSettings(core40SDK, extensionSDK);
          if (userSettings) {
            setSettings(userSettings);
            
            // Migrate user attributes to extension context for future use
            try {
              await extensionSDK.saveContextData(userSettings);
              console.log('Migrated user attributes to extension context');
            } catch (err) {
              console.warn('Failed to migrate settings to extension context:', err);
            }
          }
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    if (extensionSDK) {
      fetchSettings();
    }
  }, [core40SDK, extensionSDK]);

  const saveSettings = async (newSettings: Partial<VertexSettings>) => {
    try {
      setIsLoading(true);
      
      // Merge new settings with existing settings
      const updatedSettings = {
        ...settings,
        ...newSettings
      };
      
      // Save to extension context (primary storage)
      try {
        await extensionSDK.saveContextData(updatedSettings);
      } catch (err) {
        console.error('Failed to save to extension context:', err);
        throw new Error('Failed to save settings to extension context');
      }
      
      // Update local settings
      setSettings(updatedSettings);
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
