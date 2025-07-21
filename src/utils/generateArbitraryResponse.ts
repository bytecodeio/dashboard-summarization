import { query } from "@looker/sdk";

export const generateArbitraryResponse = async (
    newQuerySummaries: any[],
    extensionSDK: any,  
    restfulService: string,
    setFormattedData: (data: any) => void,
    prompt: string,
    sharedContext: Object,
    additionalData: Object,
    oauthToken?: string, // Accept token directly
    vertexSettings?: { // Accept settings directly
        vertexProject?: string,
        vertexLocation?: string,
        vertexModel?: string,
        cloudEndpoint?: string,
    }
): Promise<Object> => {
    // Check if token was provided
    if (!oauthToken) {
        console.error('OAuth token is missing. Please authenticate first.');
        setFormattedData('Error: Authentication required. Please reload the page to login with Google.');
        return { error: 'Authentication required' };
    }

    // Use provided settings or defaults
    const VERTEX_PROJECT = vertexSettings?.vertexProject || 'your-default-project';
    const VERTEX_LOCATION = vertexSettings?.vertexLocation || 'us-central1';
    const VERTEX_MODEL = vertexSettings?.vertexModel || 'gemini-1.5-flash';
    const CLOUD_ENDPOINT = vertexSettings?.cloudEndpoint || ''; 
    
    // const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
    const endpoint = CLOUD_ENDPOINT; 
    console.log('Sending request to Vertex AI:', endpoint);
    
    // Construct the content for Vertex AI
    const contextData = {
        prompt: prompt,
        sharedContext, 
        newQuerySummaries, 
        additionalData
    };
    
    // Format the full prompt for the model
    const fullPrompt = `
      You are an AI assistant analyzing dashboard data.
      
      Here is the dashboard context information:
      ${JSON.stringify(sharedContext, null, 2)}
      
      Here is the query data:
      ${JSON.stringify(newQuerySummaries, null, 2)}
      
      ${additionalData ? `Additional context:\n${JSON.stringify(additionalData, null, 2)}` : ''}
      
      User request: ${prompt}
      
      Provide a detailed analysis based on this information.
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

    console.log('Request payload:', JSON.stringify(requestBody, null, 2));

    try {
        // Make direct request to Vertex AI
        const response = await extensionSDK.fetchProxy(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${oauthToken}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response type:', typeof response);
        console.log('Response object:', response);
        console.log('Response methods:', Object.getOwnPropertyNames(response));

        if (!response.ok) {
            console.error('Vertex AI returned error:', response.status, response.statusText);
            throw new Error(`Vertex AI returned ${response.status}: ${response.statusText}`);
        }
       
        // Try different ways to get the data
        let responseData;
        if (typeof response.json === 'function') {
            responseData = await response.json();
        } else if (response.body) {
            responseData = response.body;
        } else {
            responseData = response;
        }
        
        console.log('Vertex AI response:', responseData);

        // Extract the content from Vertex AI response
        if (responseData.candidates && responseData.candidates.length > 0) {
            const content = responseData.candidates[0].content;
            
            if (content && content.parts && content.parts.length > 0) {
                const chatContent = content.parts[0].text;
                setFormattedData(chatContent);
                return { chat: chatContent };
            }
        }
        
        throw new Error('No valid content in Vertex AI response');
    } catch (error) {
        console.error('Error in generateArbitraryResponse:', error);
        setFormattedData(`Error: ${error.message}`);
        return { error: error.message };
    }
};