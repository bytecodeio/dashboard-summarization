import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useAutoOAuth } from '../utils/useAutoOAuth';
import { useSettings } from '../contexts/SettingsContext';
import { testVertexSettings as testVertexSettingsUtil } from '../utils/vertexUtils';

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
  // State to show success message
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  // Use our hook but don't auto-authenticate
  const { initiateAuth, oauthToken } = useAutoOAuth(false);

  // Create refs for uncontrolled inputs
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load user attribute values
  const loadUserAttributeValues = useCallback(async () => {
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
            // Set initial value in the ref if it exists
            if (inputRefs.current[key]) {
              inputRefs.current[key]!.value = attr.value;
            }
          } else {
            const defaultValue = defaultSettingValues[key];
            if (defaultValue !== undefined) {
              updatedSettings[key].value = defaultValue;
              // Set default value in the ref if it exists
              if (inputRefs.current[key]) {
                inputRefs.current[key]!.value = defaultValue;
              }
            } else {
              updatedSettings[key].value = '';
              // Clear the ref if it exists
              if (inputRefs.current[key]) {
                inputRefs.current[key]!.value = '';
              }
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
        // Set default value in the ref if it exists
        if (inputRefs.current[key]) {
          inputRefs.current[key]!.value = defaultSettingValues[key];
        }
      });
      setSettings(defaultState);
    }
  }, [core40SDK, model_application]);

  // OAuth authentication - as a function that can be called on demand
  const doOAuth = async () => {
    try {
      // Check if we have a client ID from the ref
      const clientId = inputRefs.current.google_oauth_client_id?.value;
      if (!clientId) {
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
      const clientId = inputRefs.current.google_oauth_client_id?.value;
      if (!oauthToken && clientId) {
        console.log('Modal opened, no token in hook state, and client ID is set. Initiating OAuth flow.');
        initiateAuth();
      }
    }
  }, [open, initiateAuth, loadUserAttributeValues, oauthToken]); // Remove core40SDK and settings dependency

  // Handle saving all settings to user attributes
  const handleSaveAllSettings = async () => {
    setSaveSuccess(null);
    try {
      // Get values from refs
      const updatedSettings = { ...settings };
      Object.keys(updatedSettings).forEach((key) => {
        if (inputRefs.current[key]) {
          updatedSettings[key].value = inputRefs.current[key]?.value || '';
        }
      });
      setSettings(updatedSettings);
      
      // Then save to user attributes
      for (const [id, setting] of Object.entries(updatedSettings)) {
        const prefixedId = `${model_application}_${id}`.toLowerCase();
        const value = setting.value;
        
        const user = await core40SDK.ok(core40SDK.me());
        const userId = user.id;
        
        if (!userId) {
          console.error('Unable to get user ID');
          continue;
        }
        
        // First check if the user attribute exists
        let userAttributeId;
        
        // Find in local state first
        const existingAttribute = userAttributes.find(
          (attr) => attr.name.toLowerCase() === prefixedId.toLowerCase()
        );
        
        if (existingAttribute && existingAttribute.id) {
          userAttributeId = existingAttribute.id;
        } else {
          // If not found in local state, try to find it in the system
          try {
            const allUserAttributes = await core40SDK.ok(
              core40SDK.all_user_attributes({fields: "id,name"})
            );
            
            const foundAttribute = allUserAttributes.find(
              (attr: any) => attr.name.toLowerCase() === prefixedId.toLowerCase()
            );
            
            if (foundAttribute) {
              userAttributeId = foundAttribute.id;
              // Update local state
              setUserAttributes(prev => [...prev.filter(a => a.name.toLowerCase() !== prefixedId.toLowerCase()), 
                { id: foundAttribute.id, name: foundAttribute.name, value }]);
            }
          } catch (error) {
            console.error(`Error finding user attribute ${prefixedId}:`, error);
          }
        }
        
        // If user attribute exists, update it
        if (userAttributeId) {
          try {
            console.log(`Updating existing user attribute: ${prefixedId} (ID: ${userAttributeId}) for user ${userId} with value: ${value}`);
            
            // Use the correct SDK method for updating user attribute values
            await core40SDK.ok(
              core40SDK.set_user_attribute_user_value(userAttributeId, userId, { value })
            );
          } catch (error) {
            console.error(`Error updating user attribute ${prefixedId}:`, error);
            throw error; // Rethrow to trigger the outer catch block
          }
        } else {
          // Create a new user attribute if it doesn't exist
          try {
            console.log(`Creating new user attribute: ${prefixedId}`);
            const newUserAttribute = await core40SDK.ok(
              core40SDK.create_user_attribute({
                name: prefixedId.toLowerCase(),
                label: setting.name, // Use a more user-friendly label
                type: 'string',
                default_value: value,
                value_is_hidden: false,
                user_can_view: true,
                user_can_edit: true,
              })
            );
            
            if (newUserAttribute.id) {
              console.log(`Setting value for new user attribute: ${prefixedId} (ID: ${newUserAttribute.id}) for user ${userId} with value: ${value}`);
              
              // Use the correct SDK method for the new attribute
              await core40SDK.ok(
                core40SDK.set_user_attribute_user_value(newUserAttribute.id, userId, { value })
              );
              
              // Add the new attribute to the local state
              setUserAttributes(prev => [...prev, { 
                id: newUserAttribute.id, 
                name: newUserAttribute.name || prefixedId,
                value: value 
              }]);
            }
          } catch (error) {
            console.error(`Error creating user attribute ${prefixedId}:`, error);
            throw error; // Rethrow to trigger the outer catch block
          }
        }
      }
      
      // Show success message
      setSaveSuccess(true);
      console.log("All settings saved successfully!");
      return true;
    } catch (error) {
      console.error('Error saving user attributes:', error);
      setSaveSuccess(false);
      return false;
    }
  };

  // Test Vertex AI settings
  const testVertexSettings = async (): Promise<boolean> => {
    try {
      setVertexTestResult(null);
      
      // Save settings first before testing
      await handleSaveAllSettings();
      
      // Use oauthToken directly from the useAutoOAuth hook
      const tokenToUse = oauthToken; 
      console.log('Token from useAutoOAuth state (for test):', tokenToUse);

      // Get settings from refs
      const project = inputRefs.current.vertex_project?.value || defaultSettingValues.vertex_project;
      const location = inputRefs.current.vertex_location?.value || defaultSettingValues.vertex_location;
      const model = inputRefs.current.vertex_model?.value || defaultSettingValues.vertex_model;

      console.log('Vertex Settings for API call: Project:', project, 'Location:', location, 'Model:', model);

      if (!tokenToUse) {
        console.error('No OAuth token available from hook for testVertexSettings');
        setVertexTestResult(false);
        return false;
      }
      
      if (!project || !location || !model) {
        console.error('Vertex settings (project, location, model) are incomplete for testVertexSettings');
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
    // Reset form values using refs
    Object.entries(defaultSettingValues).forEach(([key, value]) => {
      if (inputRefs.current[key]) {
        inputRefs.current[key]!.value = value;
      }
    });
    
    // Reset settings state
    const newSettingsState = { ...settings };
    Object.entries(defaultSettingValues).forEach(([key, value]) => {
      newSettingsState[key] = {
        ...settings[key],
        value: value
      };
    });
    
    setSettings(newSettingsState);
    
    // Save defaults to user attributes
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
                        defaultValue={setting.value}
                        ref={el => inputRefs.current[setting.id] = el}
                        className="input-field"
                      />
                      <button 
                        onClick={async () => {
                          await handleSaveAllSettings();
                          doOAuth();
                        }}
                        disabled={!inputRefs.current[setting.id]?.value}
                        className="auth-button"
                      >
                        Authenticate
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      defaultValue={setting.value}
                      ref={el => inputRefs.current[setting.id] = el}
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
            {saveSuccess !== null && (
              <p className={saveSuccess ? "status-passed" : "status-failed"}>
                {saveSuccess 
                  ? "Settings saved successfully!" 
                  : "Error saving settings. Please try again."}
              </p>
            )}
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
            <button onClick={handleSaveAllSettings} className="save-button">Save Settings</button>
            <button onClick={testVertexSettings} className="test-button">Test Settings</button>
            <button onClick={handleReset} className="reset-button">Reset All Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
