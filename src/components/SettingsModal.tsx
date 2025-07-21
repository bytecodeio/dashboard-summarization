import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useAutoOAuth } from '../utils/useAutoOAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useSendVertexMessage } from '../utils/useSendVertexMessage';

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
    google_oauth_client_id: contextSettings.googleOAuthClientId,
    cloud_run_url: contextSettings.cloudRunUrl || '',
  });

  const [expandedSetting, setExpandedSetting] = useState<string | null>(null);
  const [vertexTestResult, setVertexTestResult] = useState<boolean | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  // Use our hook but don't auto-authenticate
  const { idToken } = useAutoOAuth(false);
  
  // Use the updated Vertex message hook
  const { testVertexSettings: testCloudRunVertexSettings } = useSendVertexMessage();

  // Create refs for uncontrolled inputs
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Update local settings when context settings change
  useEffect(() => {
    if (open) {
      setLocalSettings({
        google_oauth_client_id: contextSettings.googleOAuthClientId,
        cloud_run_url: contextSettings.cloudRunUrl || '',
      });
      
      // Update input refs with current values
      if (inputRefs.current.google_oauth_client_id) {
        inputRefs.current.google_oauth_client_id.value = contextSettings.googleOAuthClientId;
      }
      if (inputRefs.current.cloud_run_url) {
        inputRefs.current.cloud_run_url.value = contextSettings.cloudRunUrl || '';
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

      // Since we can't trigger auth directly, we need to save the client ID first
      // then the user will need to reload or navigate to trigger auto-auth
      console.log('OAuth setup requires saving client ID first, then reloading the page');
      alert('Please save the settings first, then reload the page to complete OAuth authentication.');
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
        googleOAuthClientId: inputRefs.current.google_oauth_client_id?.value || '',
        cloudRunUrl: inputRefs.current.cloud_run_url?.value || '',
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

  // Test Vertex AI settings via Cloud Run
  const testVertexSettings = async (): Promise<boolean> => {
    try {
      setVertexTestResult(null);
      
      // Save settings first before testing
      await handleSaveAllSettings();
      
      // Get settings from refs
      const cloudRunUrl = inputRefs.current.cloud_run_url?.value || '';

      console.log('Testing Cloud Run Vertex Settings:', { cloudRunUrl });

      if (!cloudRunUrl) {
        console.error('Cloud Run URL is required for testing');
        setVertexTestResult(false);
        return false;
      }
      
      // Use the updated hook to test via Cloud Run
      const success = await testCloudRunVertexSettings();
      
      setVertexTestResult(success);
      return success;
    } catch (error) {
      console.error('Error testing Cloud Run Vertex settings:', error);
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
    google_oauth_client_id: {
      id: 'google_oauth_client_id',
      name: 'Google OAuth Client ID',
      value: localSettings.google_oauth_client_id,
      description: 'OAuth client ID from Google Cloud Console'
    },
    cloud_run_url: {
      id: 'cloud_run_url',
      name: 'Cloud Run Service URL',
      value: localSettings.cloud_run_url,
      description: 'URL of the Cloud Run service that provides the /vertex-passthrough endpoint'
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
              Authentication Status: {idToken ? 
                <span className="status-passed">Authenticated</span> : 
                <span className="status-failed">Not Authenticated</span>
              }
            </p>
            <p>
              Cloud Run Vertex Test: {vertexTestResult === null ? 
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
