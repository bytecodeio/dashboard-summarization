import { DashboardMetadata } from '../types';

export const fetchQuerySummary = async (
  queryResult: any,
  restfulService: string,
  extensionSDK: any,
  dashboardMetadata: DashboardMetadata
): Promise<any> => {
  console.log('fetchquerysummary queryResult', queryResult);
  
  // Get the OAuth token from localStorage
  const oauthToken = localStorage.getItem('vertex_oauth_token');
    
  if (!oauthToken) {
    console.error('OAuth token is missing. Please authenticate first.');
    return null;
  }

  // Get Vertex AI settings from localStorage or use defaults
  const VERTEX_PROJECT = localStorage.getItem('vertex_project') || 'your-default-project';
  const VERTEX_LOCATION = localStorage.getItem('vertex_location') || 'us-central1';
  const VERTEX_MODEL = localStorage.getItem('vertex_model') || 'gemini-1.5-flash';
  
  const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
  
  try {
    // Format the full prompt for the model
    const fullPrompt = `
      You are an AI assistant analyzing dashboard data.
      
      Please provide a concise summary of the following query results.
      
      Dashboard Description: ${dashboardMetadata.description || 'No description provided'}
      
      Query Result: ${JSON.stringify(queryResult, null, 2)}
      
      Provide a detailed analysis based on this information, focusing on key insights and trends.
    `;

    // Configure request parameters
    const requestBody = {
      contents: [{
        role: "user",
        parts: [{ text: fullPrompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
      }
    };

    // Make direct request to Vertex AI
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oauthToken}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('Vertex AI returned error:', response.status, response.statusText);
      throw new Error(`Vertex AI returned ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('Vertex AI response:', responseData);

    // Extract the content from Vertex AI response
    if (responseData.candidates && responseData.candidates.length > 0) {
      const content = responseData.candidates[0].content;
      
      if (content && content.parts && content.parts.length > 0) {
        return content.parts[0].text;
      }
    }
    
    throw new Error('No valid content in Vertex AI response');
  } catch (error) {
    console.error('Error generating query summary:', error);
    return null;
  }
};