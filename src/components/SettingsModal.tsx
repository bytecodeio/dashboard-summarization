import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useAutoOAuth } from '../utils/useAutoOAuth';
import { useSettings } from '../contexts/SettingsContext';

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
  const { settings: contextSettings, saveSettings, isLoading } = useSettings();
  
  // Remove all the user attribute management code and replace with:
  const [localSettings, setLocalSettings] = useState({
    vertex_project: contextSettings.vertexProject,
    vertex_location: contextSettings.vertexLocation,
    vertex_model: contextSettings.vertexModel,
    google_oauth_client_id: contextSettings.googleOAuthClientId,
    cloud_endpoint: contextSettings.cloudEndpoint, // Add this line
  });

  const [expandedSetting, setExpandedSetting] = useState<string | null>(null);
  const [vertexTestResult, setVertexTestResult] = useState<boolean | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  // Use our hook but don't auto-authenticate
  const { initiateAuth, oauthToken } = useAutoOAuth(false);

  // Create refs for uncontrolled inputs
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Update local settings when context settings change
  useEffect(() => {
    if (open) {
      setLocalSettings({
        vertex_project: contextSettings.vertexProject,
        vertex_location: contextSettings.vertexLocation,
        vertex_model: contextSettings.vertexModel,
        google_oauth_client_id: contextSettings.googleOAuthClientId,
        cloud_endpoint: contextSettings.cloudEndpoint, // Add this line
      });
      
      // Update input refs with current values
      if (inputRefs.current.vertex_project) {
        inputRefs.current.vertex_project.value = contextSettings.vertexProject;
      }
      if (inputRefs.current.vertex_location) {
        inputRefs.current.vertex_location.value = contextSettings.vertexLocation;
      }
      if (inputRefs.current.vertex_model) {
        inputRefs.current.vertex_model.value = contextSettings.vertexModel;
      }
      if (inputRefs.current.google_oauth_client_id) {
        inputRefs.current.google_oauth_client_id.value = contextSettings.googleOAuthClientId;
      }
      if (inputRefs.current.cloud_endpoint) { // Add this block
        inputRefs.current.cloud_endpoint.value = contextSettings.cloudEndpoint;
      }
    }
  }, [open, contextSettings]);

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

  // Handle saving all settings to user attributes
  const handleSaveAllSettings = async () => {
    setSaveSuccess(null);
    try {
      // Get values from refs
      const updatedSettings = {
        vertexProject: inputRefs.current.vertex_project?.value || '',
        vertexLocation: inputRefs.current.vertex_location?.value || 'us-central1',
        vertexModel: inputRefs.current.vertex_model?.value || 'gemini-2.0-flash',
        googleOAuthClientId: inputRefs.current.google_oauth_client_id?.value || '',
        cloudEndpoint: inputRefs.current.cloud_endpoint?.value || '', // Add this line
      };
      
      // Save using the context (which will save to extension context)
      await saveSettings(updatedSettings);
      
      setSaveSuccess(true);
      console.log("All settings saved successfully!");
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
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
      const project = inputRefs.current.vertex_project?.value || '';
      const location = inputRefs.current.vertex_location?.value || 'us-central1';
      const model = inputRefs.current.vertex_model?.value || 'gemini-2.0-flash';

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

  // Update the settings object:
  const settings = {
    vertex_project: {
      id: 'vertex_project',
      name: 'Vertex AI Project',
      value: localSettings.vertex_project,
      description: 'Google Cloud Project ID where Vertex AI is enabled'
    },
    vertex_location: {
      id: 'vertex_location',
      name: 'Vertex AI Location',
      value: localSettings.vertex_location,
      description: 'Google Cloud region where Vertex AI is deployed (e.g., us-central1)'
    },
    vertex_model: {
      id: 'vertex_model',
      name: 'Vertex AI Model',
      value: localSettings.vertex_model,
      description: 'Vertex AI model to use for generating content'
    },
    cloud_endpoint: { // Add this new setting
      id: 'cloud_endpoint',
      name: 'Cloud Endpoint',
      value: localSettings.cloud_endpoint,
      description: 'Custom endpoint URL for Vertex AI requests (e.g., proxy or gateway URL)'
    },
    google_oauth_client_id: {
      id: 'google_oauth_client_id',
      name: 'Google OAuth Client ID',
      value: localSettings.google_oauth_client_id,
      description: 'OAuth client ID from Google Cloud Console'
    }
  };

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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
