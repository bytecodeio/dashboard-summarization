import { useState, useContext, useCallback } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAutoOAuth } from './useAutoOAuth';

export const useSendVertexMessage = () => {
  const { extensionSDK } = useContext(ExtensionContext);
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  
  // Use the existing OAuth hook and trigger auth when needed
  const { idToken, isAuthenticating } = useAutoOAuth(true);

  // Get settings
  const CLOUD_RUN_URL = settings.cloudRunUrl;

  const callCloudRunAPI = async (payload: any) => {
    if (!CLOUD_RUN_URL) {
      throw new Error('Cloud Run service URL not configured');
    }

    // Wait for authentication to complete if it's in progress
    if (isAuthenticating) {
      console.log('Waiting for authentication to complete...');
      // Wait up to 30 seconds for auth to complete
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!isAuthenticating && idToken) break;
        if (i === 29) throw new Error('Authentication timeout');
      }
    }

    if (!idToken) {
      throw new Error('Authentication token not available. Please ensure you are logged in.');
    }

    const url = `${CLOUD_RUN_URL}/vertex-passthrough`;
    console.log('Making request to Cloud Run vertex-passthrough endpoint...');
    console.log('Request URL:', url);
    
    try {
      // Try fetchProxy first (preferred)
      try {
        console.log('Attempting fetchProxy request with Bearer token...');
        const response = await extensionSDK.fetchProxy(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
        });
        console.log('fetchProxy request successful');
        return response;
      } catch (proxyError) {
        console.warn('fetchProxy failed, falling back to direct fetch...', proxyError);
        // Fallback to direct fetch
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
          mode: 'cors',
          credentials: 'omit',
        });
        
        if (response.ok) {
          console.log('Direct fetch with Bearer token successful');
          return await response.json();
        } else {
          const errorText = await response.text();
          throw new Error(`Cloud Run fetch error: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }
    } catch (error) {
      console.error('Cloud Run request failed:', error);
      throw new Error(`Unable to connect to Cloud Run service: ${error}`);
    }
  };

  const callVertexAPI = async (
    contents: string,
    parameters: any = {}
  ) => {
    try {
      setIsLoading(true);

      // Define default parameters
      const defaultParameters = {
        temperature: 0.2,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
      };
      
      // Override default parameters with any provided
      const mergedParams = { ...defaultParameters, ...parameters };
      
      // Construct the request body for Cloud Run vertex-passthrough
      const requestBody = {
        contents: [{
          role: "user",
          parts: [{ text: contents }]
        }],
        generationConfig: {
          temperature: mergedParams.temperature,
          maxOutputTokens: mergedParams.maxOutputTokens,
          topP: mergedParams.topP,
          topK: mergedParams.topK
        }
      };
      
      console.log('Sending request to Cloud Run vertex-passthrough:', requestBody);
      
      const result = await callCloudRunAPI(requestBody);
      setIsLoading(false);
      
      return result;
    } catch (error) {
      setIsLoading(false);
      console.error('Error calling Cloud Run vertex-passthrough:', error);
      throw error;
    }
  };

  const testVertexSettings = async () => {
    try {
      await callVertexAPI("Hello, please respond with 'OK' if you can hear me.");
      return true;
    } catch (error) {
      console.error('Cloud Run vertex-passthrough test failed:', error);
      return false;
    }
  };

  return { callVertexAPI, testVertexSettings, isLoading };
};
