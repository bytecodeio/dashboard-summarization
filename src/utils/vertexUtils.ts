/**
 * Utility functions for interacting with Vertex AI API via Cloud Run
 */

// Type definitions for Vertex settings
export interface VertexSettings {
  cloudRunUrl?: string;
}

// Default settings to use as fallbacks
export const DEFAULT_VERTEX_SETTINGS: VertexSettings = {
  cloudRunUrl: ''
};

/**
 * Make a request to the Vertex AI API via Cloud Run
 * @param contents The prompt to send to the model
 * @param idToken ID token for authentication
 * @param settings Vertex AI settings including Cloud Run URL
 * @param parameters Optional generation parameters
 * @returns The API response
 */
export const callVertexAPI = async (
  contents: string,
  idToken: string,
  settings: VertexSettings,
  parameters: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  } = {}
): Promise<any> => {
  if (!idToken) {
    throw new Error('ID token is required but not provided');
  }

  // Use provided settings with defaults as fallbacks
  const CLOUD_RUN_URL = settings.cloudRunUrl || DEFAULT_VERTEX_SETTINGS.cloudRunUrl;

  if (!CLOUD_RUN_URL) {
    throw new Error('Cloud Run URL is required but not provided');
  }

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
  
  // Call the Cloud Run vertex-passthrough endpoint
  const endpoint = `${CLOUD_RUN_URL}/vertex-passthrough`;
  
  console.log(`Making request to Cloud Run vertex-passthrough: ${endpoint}`);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Cloud Run vertex-passthrough error (${response.status}): ${errorText}`);
  }

  return await response.json();
};

/**
 * Extract text from Vertex API response
 * @param responseData The response from the Vertex API
 * @returns The extracted text or null if no valid content
 */
export const extractTextFromVertexResponse = (responseData: any): string | null => {
  if (responseData?.candidates && responseData.candidates.length > 0) {
    const content = responseData.candidates[0].content;
    
    if (content?.parts && content.parts.length > 0) {
      return content.parts[0].text || null;
    }
  }
  return null;
};

/**
 * Test Vertex AI settings by making a simple request via Cloud Run
 * @param idToken ID token for authentication
 * @param settings Vertex AI settings to test
 * @returns Boolean indicating success or failure
 */
export const testVertexSettings = async (
  idToken: string,
  settings: VertexSettings
): Promise<boolean> => {
  try {
    const response = await callVertexAPI(
      "Hello, please respond with 'OK' if you can hear me.",
      idToken,
      settings,
      { maxOutputTokens: 10 }
    );
    return !!response;
  } catch (error) {
    console.error('Cloud Run vertex-passthrough test failed:', error);
    return false;
  }
};
