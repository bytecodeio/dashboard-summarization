import React, { useContext, useEffect, useState } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useAutoOAuth } from '../utils/useAutoOAuth';
import { loadUserSettings } from '../utils/loadUserSettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

interface Setting {
  id: string;
  name: string;
  value: string;
  description: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, isAdmin }) => {
  const { core40SDK, extensionSDK } = useContext(ExtensionContext);
  const extensionId = extensionSDK?.lookerHostData?.extensionId;
  // Convert model_application to lowercase for use in attribute names
  const model_application = extensionId?.replace(/::/g, '_').replace(/-/g, '_').toLowerCase();

  // Default settings values
  const defaultSettingValues: Record<string, string> = {
    vertex_project: '',
    vertex_location: 'us-central1',
    vertex_model: 'gemini-1.5-flash',
    google_oauth_client_id: ''
  };

  // Settings state
  const [settings, setSettings] = useState<Record<string, Setting>>({
    vertex_project: {
      id: 'vertex_project',
      name: 'Vertex AI Project',
      value: defaultSettingValues.vertex_project,
      description: 'Google Cloud Project ID where Vertex AI is enabled'
    },
    vertex_location: {
      id: 'vertex_location',
      name: 'Vertex AI Location',
      value: defaultSettingValues.vertex_location,
      description: 'Google Cloud region where Vertex AI is deployed (e.g., us-central1)'
    },
    vertex_model: {
      id: 'vertex_model',
      name: 'Vertex AI Model',
      value: defaultSettingValues.vertex_model,
      description: 'Vertex AI model to use for generating content'
    },
    google_oauth_client_id: {
      id: 'google_oauth_client_id',
      name: 'Google OAuth Client ID',
      value: defaultSettingValues.google_oauth_client_id,
      description: 'OAuth client ID from Google Cloud Console'
    }
  });

  const [userAttributes, setUserAttributes] = useState<{ id: string | undefined, name: string, value?: string }[]>([]);
  const [expandedSetting, setExpandedSetting] = useState<string | null>(null);
  const [vertexTestResult, setVertexTestResult] = useState<boolean | null>(null);

  // Use our hook but don't auto-authenticate
  const { initiateAuth, oauthToken } = useAutoOAuth(false);

  // Load user attribute values
  const loadUserAttributeValues = async () => {
    try {
      const user = await core40SDK.ok(core40SDK.me());
      const userId = user.id;
      
      if (userId) {
        const userAttrsSDK = await core40SDK.ok(
          core40SDK.user_attribute_user_values({
            user_id: userId,
            fields: "name, value, user_attribute_id", // Ensure user_attribute_id is fetched
            all_values: true
          })
        );
        
        const updatedSettings = { ...settings };
        
        Object.keys(settings).forEach(key => {
          const attrName = `${model_application}_${key}`.toLowerCase();
          const attr = userAttrsSDK.find((attr: any) => 
            attr.name.toLowerCase() === attrName.toLowerCase()
          );
          
          if (attr && attr.value) {
            updatedSettings[key] = {
              ...updatedSettings[key],
              value: attr.value
            };
          } else {
            const defaultValue = defaultSettingValues[key];
            if (defaultValue !== undefined) {
              updatedSettings[key].value = defaultValue;
            } else {
              updatedSettings[key].value = '';
            }
          }
        });
        
        setSettings(updatedSettings);
        // Map SDK response to the structure expected by userAttributes state
        const mappedUserAttrs = userAttrsSDK.map(attr => ({
          id: attr.user_attribute_id, // Map user_attribute_id to id
          name: attr.name,
          value: attr.value
        }));
        setUserAttributes(mappedUserAttrs);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      // When loading fails, set settings state to defaults
      const defaultState = { ...settings };
      Object.keys(defaultSettingValues).forEach(key => {
        defaultState[key] = {
          ...defaultState[key],
          value: defaultSettingValues[key]
        };
      });
      setSettings(defaultState);
    }
  };

  // OAuth authentication - as a function that can be called on demand
  const doOAuth = async () => {
    try {
      // Check if we have a client ID
      if (!settings.google_oauth_client_id.value) {
        console.error('OAuth client ID is required but not provided');
        return false;
      }

      initiateAuth();
      return true;
    } catch (error) {
      console.error('OAuth2 authentication failed:', error);
      return false;
    }
  };

  // Load user attributes and their values when the modal opens
  useEffect(() => {
    if (open) {
      loadUserAttributeValues();
      // Optionally, initiate OAuth if no token is found when the modal opens
      // and the client ID is available.
      // Check oauthToken from the hook directly instead of localStorage
      if (!oauthToken && settings.google_oauth_client_id.value) {
        console.log('Modal opened, no token in hook state, and client ID is set. Initiating OAuth flow.');
        initiateAuth();
      }
    }
  }, [open, core40SDK, settings.google_oauth_client_id.value, initiateAuth, loadUserAttributeValues, oauthToken]); // Added oauthToken to dependencies

  // Check admin status - REMOVED, isAdmin is now a prop
  /*
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await core40SDK.ok(core40SDK.me());
        // Check if user has admin permissions
        setIsAdmin(true); // For now, allow all users to see settings
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    checkAdminStatus();
  }, [core40SDK]);
  */

  // Handle saving settings to user attributes
  const handleSaveSetting = async (id: string, value: string) => {
    // Update local state
    setSettings(prevSettings => ({
      ...prevSettings,
      [id]: {
        ...prevSettings[id],
        value
      }
    }));
    
    const prefixedId = `${model_application}_${id}`.toLowerCase();
    
    try {
      const user = await core40SDK.ok(core40SDK.me());
      const userId = user.id;
      
      if (!userId) {
        console.error('Unable to get user ID');
        return;
      }
      
      const userAttribute = userAttributes.find(
        (attr) => attr.name.toLowerCase() === prefixedId
      );
      
      console.log('userAttribute:', userAttribute, 'for name:', prefixedId);
      
      if (userAttribute && userAttribute.id) {
        // Corrected SDK call: user_attribute_id, user_id, body
        await core40SDK.ok(
          core40SDK.set_user_attribute_user_value(userAttribute.id, userId, { value })
        );
      } else {
        const newUserAttribute = await core40SDK.ok(
          core40SDK.create_user_attribute({
            name: prefixedId.toLowerCase(),
            label: prefixedId, // Consider a more user-friendly label
            type: 'string',
            default_value: value,
            value_is_hidden: false,
            user_can_view: true,
            user_can_edit: true,
          })
        );
        
        if (newUserAttribute.id) {
          // Corrected SDK call: user_attribute_id, user_id, body
          await core40SDK.ok(
            core40SDK.set_user_attribute_user_value(newUserAttribute.id, userId, { value })
          );
          // Add the new attribute to the local state, ensuring correct mapping
          setUserAttributes([...userAttributes, { 
            id: newUserAttribute.id, 
            name: newUserAttribute.name || prefixedId, // Use name from response if available
            value: value 
          }]);
        }
      }
    } catch (error) {
      console.error('Error saving user attribute:', error);
    }
  };

  // Test Vertex AI settings
  const testVertexSettings = async (): Promise<boolean> => {
    try {
      setVertexTestResult(null);
      
      // Use oauthToken directly from the useAutoOAuth hook
      const tokenToUse = oauthToken; 
      console.log('Token from useAutoOAuth state (for test):', tokenToUse);

      // Get settings from component state
      const project = settings.vertex_project.value || defaultSettingValues.vertex_project;
      const location = settings.vertex_location.value || defaultSettingValues.vertex_location;
      const model = settings.vertex_model.value || defaultSettingValues.vertex_model;

      console.log('Vertex Settings for API call: Project:', project, 'Location:', location, 'Model:', model);

      if (!tokenToUse) {
        console.error('No OAuth token available from hook for testVertexSettings');
        setVertexTestResult(false);
        return false;
      }
      
      if (!project || !location || !model) {
        console.error('Vertex settings (project, location, model) are incomplete in state for testVertexSettings');
        setVertexTestResult(false);
        return false;
      }
      
      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: "Hello, this is a test. Please respond with 'Test successful'" }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 10
          }
        })
      });
      
      const success = response.ok;
      setVertexTestResult(success);
      return success;
    } catch (error) {
      console.error('Error testing Vertex settings:', error);
      setVertexTestResult(false);
      return false;
    }
  };

  // Handle expanding settings description
  const handleExpandClick = (id: string) => {
    setExpandedSetting(expandedSetting === id ? null : id);
  };

  // Reset all settings
  const handleReset = async () => {
    const newSettingsState = { ...settings };
    Object.entries(defaultSettingValues).forEach(([key, value]) => {
      newSettingsState[key] = {
        ...settings[key],
        value: value
      };
    });
    setSettings(newSettingsState);
    
    for (const [key, value] of Object.entries(defaultSettingValues)) {
      const prefixedId = `${model_application}_${key}`.toLowerCase();
      try {
        const user = await core40SDK.ok(core40SDK.me());
        const userId = user.id;
        if (!userId) continue;

        const userAttribute = userAttributes.find(
          (attr) => attr.name.toLowerCase() === prefixedId
        );

        if (userAttribute && userAttribute.id) {
          // Corrected SDK call: user_attribute_id, user_id, body
          await core40SDK.ok(
            core40SDK.set_user_attribute_user_value(userAttribute.id, userId, { value })
          );
        } else {
          console.warn(`User attribute ${prefixedId} not found for reset, cannot set user-specific value to default.`);
        }
      } catch (error) {
        console.error(`Error resetting user attribute ${prefixedId}:`, error);
      }
    }
  };

  if (!open) return null;
  // Use the isAdmin prop to control rendering
  if (!isAdmin) {
    return (
      <div className="settings-modal-overlay">
        <div className="settings-modal">
          <h2>Dashboard Summarization Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
          <p>Settings are only available to administrators or users with specific permissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <h2>Dashboard Summarization Settings</h2>
        <button className="close-button" onClick={onClose}>×</button>
        
        <div className="settings-content">
          <ul className="settings-list">
            {Object.values(settings).map((setting) => (
              <li key={setting.id} className="setting-item">
                <div className="setting-header">
                  <button onClick={() => handleExpandClick(setting.id)} className="setting-name">
                    {setting.name} <span className="info-icon">ℹ️</span>
                  </button>
                  
                  {setting.id === 'google_oauth_client_id' ? (
                    <div className="client-id-container">
                      <input
                        type="text"
                        value={String(setting.value)}
                        onChange={(e) => handleSaveSetting(setting.id, e.target.value)}
                        className="input-field"
                      />
                      <button 
                        onClick={doOAuth} 
                        disabled={!setting.value}
                        className="auth-button"
                      >
                        Authenticate
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={String(setting.value)}
                      onChange={(e) => handleSaveSetting(setting.id, e.target.value)}
                      className="input-field"
                    />
                  )}
                </div>
                
                {expandedSetting === setting.id && (
                  <div className="setting-description">
                    {setting.description}
                  </div>
                )}
              </li>
            ))}
          </ul>
          
          <div className="settings-status">
            <p>
              OAuth Status: {oauthToken ? 
                <span className="status-passed">Authenticated</span> : 
                <span className="status-failed">Not Authenticated</span>
              }
            </p>
            <p>
              Vertex AI Test: {vertexTestResult === null ? 
                'Not tested' : 
                vertexTestResult ? 
                  <span className="status-passed">Passed</span> : 
                  <span className="status-failed">Failed</span>
              }
            </p>
          </div>
          
          <div className="settings-buttons">
            <button onClick={testVertexSettings} className="test-button">Test Settings</button>
            <button onClick={handleReset} className="reset-button">Reset All Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
