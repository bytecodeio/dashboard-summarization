/**
 * Utility functions for interacting with Vertex AI API
 */

// Type definitions for Vertex settings
export interface VertexSettings {
  vertexProject: string;
  vertexLocation: string;
  vertexModel: string;
}

// Default settings to use as fallbacks
export const DEFAULT_VERTEX_SETTINGS: VertexSettings = {
  vertexProject: '',
  vertexLocation: 'us-central1',
  vertexModel: 'gemini-1.5-flash'
};

/**
 * Make a request to the Vertex AI API
 * @param contents The prompt to send to the model
 * @param oauthToken OAuth token for authentication
 * @param settings Vertex AI settings
 * @param parameters Optional generation parameters
 * @returns The API response
 */
export const callVertexAPI = async (
  contents: string,
  oauthToken: string,
  settings: VertexSettings,
  parameters: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  } = {}
): Promise<any> => {
  if (!oauthToken) {
    throw new Error('OAuth token is required but not provided');
  }

  // Use provided settings with defaults as fallbacks
  const VERTEX_PROJECT = settings.vertexProject || DEFAULT_VERTEX_SETTINGS.vertexProject;
  const VERTEX_LOCATION = settings.vertexLocation || DEFAULT_VERTEX_SETTINGS.vertexLocation;
  const VERTEX_MODEL = settings.vertexModel || DEFAULT_VERTEX_SETTINGS.vertexModel;

  if (!VERTEX_PROJECT) {
    throw new Error('Vertex Project ID is required but not provided');
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
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${oauthToken}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Vertex API error (${response.status}): ${errorText}`);
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
 * Test Vertex AI settings by making a simple request
 * @param oauthToken OAuth token for authentication
 * @param settings Vertex AI settings to test
 * @returns Boolean indicating success or failure
 */
export const testVertexSettings = async (
  oauthToken: string,
  settings: VertexSettings
): Promise<boolean> => {
  try {
    const response = await callVertexAPI(
      "Hello, please respond with 'OK' if you can hear me.",
      oauthToken,
      settings,
      { maxOutputTokens: 10 }
    );
    return !!response;
  } catch (error) {
    console.error('Vertex AI test failed:', error);
    return false;
  }
};
