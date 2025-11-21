import React, { useContext, useEffect, useState, useRef } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useSettings } from '../contexts/SettingsContext';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, isAdmin }) => {
  const { extensionSDK } = useContext(ExtensionContext);
  const { settings: contextSettings, saveSettings, isLoading } = useSettings();

  const [localSettings, setLocalSettings] = useState({
    backend_service_url: contextSettings.backendServiceUrl,
  });

  const [expandedSetting, setExpandedSetting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  // Create refs for uncontrolled inputs
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Update local settings when context settings change
  useEffect(() => {
    if (open) {
      setLocalSettings({
        backend_service_url: contextSettings.backendServiceUrl,
      });

      // Update input refs with current values
      if (inputRefs.current.backend_service_url) {
        inputRefs.current.backend_service_url.value = contextSettings.backendServiceUrl;
      }
    }
  }, [open, contextSettings]);

  // Handle saving all settings
  const handleSaveAllSettings = async () => {
    setSaveSuccess(null);
    try {
      // Get values from refs
      const updatedSettings = {
        backendServiceUrl: inputRefs.current.backend_service_url?.value || '',
      };

      // Save using the context (which will save to extension context)
      await saveSettings(updatedSettings);

      setSaveSuccess(true);
      console.log("Settings saved successfully!");
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveSuccess(false);
      return false;
    }
  };

  // Test backend service connection
  const testBackendService = async (): Promise<boolean> => {
    try {
      setTestResult(null);

      // Get backend service URL from ref
      const backendUrl = inputRefs.current.backend_service_url?.value || '';

      if (!backendUrl) {
        console.error('Backend service URL is required');
        setTestResult(false);
        return false;
      }

      // Make a simple test request to the backend
      const response = await extensionSDK.fetchProxy(backendUrl + '/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const success = response.ok;
      setTestResult(success);
      return success;
    } catch (error) {
      console.error('Error testing backend service:', error);
      setTestResult(false);
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

  const settings = {
    backend_service_url: {
      id: 'backend_service_url',
      name: 'Backend Service URL',
      value: localSettings.backend_service_url,
      description: 'URL of the backend service that handles AI requests (e.g., https://your-service.run.app/generate)'
    }
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <h2>Dashboard Summarization Settings</h2>
        <button className="close-button" onClick={onClose}>×</button>

        <div className="settings-content">
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Configure the backend service URL. No OAuth configuration needed - the backend service handles authentication with Vertex AI.
          </p>

          <ul className="settings-list">
            {Object.values(settings).map((setting) => (
              <li key={setting.id} className="setting-item">
                <div className="setting-header">
                  <button onClick={() => handleExpandClick(setting.id)} className="setting-name">
                    {setting.name} <span className="info-icon">ℹ️</span>
                  </button>

                  <input
                    type="text"
                    defaultValue={setting.value}
                    ref={el => inputRefs.current[setting.id] = el}
                    className="input-field"
                    placeholder="https://your-backend-service.run.app/generate"
                  />
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
              Backend Service Test: {testResult === null ?
                'Not tested' :
                testResult ?
                  <span className="status-passed">Passed</span> :
                  <span className="status-failed">Failed</span>
              }
            </p>
          </div>

          <div className="settings-buttons">
            <button onClick={handleSaveAllSettings} className="save-button">Save Settings</button>
            <button onClick={testBackendService} className="test-button">Test Connection</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
