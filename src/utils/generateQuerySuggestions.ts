import { look, Looker40SDK } from "@looker/sdk";

export const generateQuerySuggestions = async (
  querySummaries: any[],
  restfulService: string,
  extensionSDK: any,
  setQuerySuggestions: (suggestions: any) => void,
  nextStepsInstructions: string
): Promise<void> => {
  try {
    // Get the OAuth token from localStorage
    const oauthToken = localStorage.getItem('vertex_oauth_token');
      
    if (!oauthToken) {
      console.error('OAuth token is missing. Please authenticate first.');
      setQuerySuggestions('Error: Authentication required. Please reload the page to login with Google.');
      return;
    }

    // Get Vertex AI settings from localStorage or use defaults
    const VERTEX_PROJECT = localStorage.getItem('vertex_project') || 'your-default-project';
    const VERTEX_LOCATION = localStorage.getItem('vertex_location') || 'us-central1';
    const VERTEX_MODEL = localStorage.getItem('vertex_model') || 'gemini-1.5-flash';
    
    const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
    
    console.log('Sending request to Vertex AI for query suggestions:', endpoint);
    
    // Format the full prompt for the model
    const fullPrompt = `
      You are an AI assistant analyzing dashboard data.
      
      Based on these summaries of queries, suggest next steps or additional analyses:
      ${JSON.stringify(querySummaries, null, 2)}
      
      Additional instructions: ${nextStepsInstructions || 'Provide 3-5 suggestions for further analysis.'}
      
      Format the suggestions in a clear, concise manner.
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
    console.log('Vertex AI response for query suggestions:', responseData);

    // Extract the content from Vertex AI response
    if (responseData.candidates && responseData.candidates.length > 0) {
      const content = responseData.candidates[0].content;
      
      if (content && content.parts && content.parts.length > 0) {
        const suggestions = content.parts[0].text;
        setQuerySuggestions(suggestions);
      }
    } else {
      throw new Error('No valid content in Vertex AI response');
    }
  } catch (error) {
    console.error('Error generating query suggestions:', error);
    setQuerySuggestions(`Error generating suggestions: ${error.message}`);
  }
};