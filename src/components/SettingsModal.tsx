import React, { useContext, useEffect, useState } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useAutoOAuth } from '../utils/useAutoOAuth';
import { loadUserSettings } from '../utils/loadUserSettings';
import { isStorageAccessible } from '../types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface Setting {
  id: string;
  name: string;
  value: string;
  description: string;
}

const safeLocalStorageGet = (key: string): string | null => {
  if (isStorageAccessible(localStorage)) {
    return localStorage.getItem(key);
  }
  return null;
};

const safeLocalStorageSet = (key: string, value: string): void => {
  if (isStorageAccessible(localStorage)) {
    localStorage.setItem(key, value);
  }
};

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { core40SDK, extensionSDK } = useContext(ExtensionContext);
  const extensionId = extensionSDK?.lookerHostData?.extensionId;
  // Convert model_application to lowercase for use in attribute names
  const model_application = extensionId?.replace(/::/g, '_').replace(/-/g, '_').toLowerCase();

  // Settings state
  const [settings, setSettings] = useState<Record<string, Setting>>({
    vertex_project: {
      id: 'vertex_project',
      name: 'Vertex AI Project',
      value: '',
      description: 'Google Cloud Project ID where Vertex AI is enabled'
    },
    vertex_location: {
      id: 'vertex_location',
      name: 'Vertex AI Location',
      value: 'us-central1',
      description: 'Google Cloud region where Vertex AI is deployed (e.g., us-central1)'
    },
    vertex_model: {
      id: 'vertex_model',
      name: 'Vertex AI Model',
      value: 'gemini-1.5-flash',
      description: 'Vertex AI model to use for generating content'
    },
    google_oauth_client_id: {
      id: 'google_oauth_client_id',
      name: 'Google OAuth Client ID',
      value: '',
      description: 'OAuth client ID from Google Cloud Console'
    }
  });

  const [userAttributes, setUserAttributes] = useState<{ id: string | undefined, name: string, value?: string }[]>([]);
  const [expandedSetting, setExpandedSetting] = useState<string | null>(null);
  const [vertexTestResult, setVertexTestResult] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [oauthToken, setOauthToken] = useState<string | null>(safeLocalStorageGet('vertex_oauth_token'));

  // Use our hook but don't auto-authenticate
  const { initiateAuth, handleAuthSuccess } = useAutoOAuth(false);

  // Load user attribute values
  const loadUserAttributeValues = async () => {
    await loadUserSettings(core40SDK, extensionSDK);
    
    // Update local state from localStorage for UI display
    setSettings(prevSettings => ({
      ...prevSettings,
      vertex_project: {
        ...prevSettings.vertex_project,
        value: safeLocalStorageGet('vertex_project') || ''
      },
      vertex_location: {
        ...prevSettings.vertex_location,
        value: safeLocalStorageGet('vertex_location') || 'us-central1'
      },
      vertex_model: {
        ...prevSettings.vertex_model,
        value: safeLocalStorageGet('vertex_model') || 'gemini-1.5-flash'
      },
      google_oauth_client_id: {
        ...prevSettings.google_oauth_client_id,
        value: safeLocalStorageGet('google_oauth_client_id') || ''
      }
    }));
    
    // Also update OAuth token status
    setOauthToken(safeLocalStorageGet('vertex_oauth_token'));
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
      testVertexSettings();
    }
  }, [core40SDK, open]);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await core40SDK.ok(core40SDK.me());
        // Check if user is admin
        if (response.is_admin) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    checkAdminStatus();
  }, [core40SDK]);

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
    
    // Also update localStorage for backward compatibility during transition
    safeLocalStorageSet(id, value);
    
    // Ensure the user attribute name is lowercase
    const prefixedId = `${model_application}_${id}`.toLowerCase();
    
    try {
      // Case-insensitive lookup for existing attribute
      const userAttribute = userAttributes.find(
        (attr) => attr.name.toLowerCase() === prefixedId
      );
      
      console.log('userAttribute:', userAttribute, 'for name:', prefixedId);
      
      if (userAttribute) {
        await core40SDK.ok(
          core40SDK.update_user_attribute_user_value(userAttribute.id || '', {
            user_id: (await core40SDK.ok(core40SDK.me())).id,
            value
          })
        );
      } else {
        // Create user attribute if it doesn't exist
        const newUserAttribute = await core40SDK.ok(
          core40SDK.create_user_attribute({
            name: prefixedId.toLowerCase(),
            label: prefixedId,
            type: 'string',
            default_value: value,
            value_is_hidden: false,
            user_can_view: true,
            user_can_edit: true,
          })
        );
        
        // Set the value for the current user
        await core40SDK.ok(
          core40SDK.update_user_attribute_user_value(newUserAttribute.id || '', {
            user_id: (await core40SDK.ok(core40SDK.me())).id,
            value
          })
        );
        
        setUserAttributes([...userAttributes, { id: newUserAttribute.id, name: prefixedId }]);
      }
    } catch (error) {
      console.error('Error saving user attribute:', error);
    }
  };

  // Test Vertex AI settings
  const testVertexSettings = async (): Promise<boolean> => {
    try {
      setVertexTestResult(null);
      
      const token = safeLocalStorageGet('vertex_oauth_token');
      if (!token) {
        console.error('No OAuth token available');
        setVertexTestResult(false);
        return false;
      }
      
      const project = settings.vertex_project.value;
      const location = settings.vertex_location.value;
      const model = settings.vertex_model.value;
      
      if (!project || !location || !model) {
        console.error('Vertex settings are incomplete');
        setVertexTestResult(false);
        return false;
      }
      
      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
      
      // Make a simple request to test access
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
    const defaultSettings = {
      vertex_project: '',
      vertex_location: 'us-central1',
      vertex_model: 'gemini-1.5-flash',
      google_oauth_client_id: ''
    };
    
    // Update local state
    Object.entries(defaultSettings).forEach(([key, value]) => {
      setSettings(prevSettings => ({
        ...prevSettings,
        [key]: {
          ...prevSettings[key],
          value
        }
      }));
      
      // Also update localStorage
      safeLocalStorageSet(key, String(value));
    });
    
    // Clear token
    safeLocalStorageSet('vertex_oauth_token', '');
    setOauthToken(null);
    
    // Update user attributes
    for (const [key, value] of Object.entries(defaultSettings)) {
      await handleSaveSetting(key, String(value));
    }
  };

  if (!open) return null;
  if (!isAdmin) return <div>Settings are only available to administrators</div>;

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
