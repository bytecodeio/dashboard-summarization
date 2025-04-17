import { useState } from 'react';

// Default Vertex AI settings
const DEFAULT_SETTINGS = {
  vertexProject: 'your-default-project',
  vertexLocation: 'us-central1',
  vertexModel: 'gemini-1.5-flash'
};

export const useSendVertexMessage = () => {
  const [isLoading, setIsLoading] = useState(false);

  const callVertexAPI = async (
    contents: string,
    parameters: any = {},
    settings: any = {}
  ) => {
    try {
      setIsLoading(true);
      
      // Get token from localStorage
      const oauthToken = localStorage.getItem('vertex_oauth_token');
      
      if (!oauthToken) {
        throw new Error('OAuth token is required but not provided');
      }

      // Get Vertex settings with defaults
      const VERTEX_PROJECT = settings.vertexProject || DEFAULT_SETTINGS.vertexProject;
      const VERTEX_LOCATION = settings.vertexLocation || DEFAULT_SETTINGS.vertexLocation;
      const VERTEX_MODEL = settings.vertexModel || DEFAULT_SETTINGS.vertexModel;

      // Define default parameters
      const defaultParameters = {
        temperature: 0.2,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
      };
      
      // Override default parameters with any provided
      const mergedParams = { ...defaultParameters, ...parameters };
      
      // Construct the request body according to Vertex AI API specs
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
      
      // Directly call the Vertex AI API using OAuth authentication
      const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
      
      console.log(`Making request to Vertex AI: ${endpoint}`);
      console.log('Request payload:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${oauthToken}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Vertex API error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      setIsLoading(false);
      
      return responseData;
    } catch (error) {
      setIsLoading(false);
      console.error('Error calling Vertex API:', error);
      throw error;
    }
  };

  const testVertexSettings = async (settings: any = {}) => {
    try {
      await callVertexAPI("Hello, please respond with 'OK' if you can hear me.", {}, settings);
      return true;
    } catch (error) {
      console.error('Vertex AI test failed:', error);
      return false;
    }
  };

  return { callVertexAPI, testVertexSettings, isLoading };
};
