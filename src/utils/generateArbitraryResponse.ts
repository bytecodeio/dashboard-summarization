import { query } from "@looker/sdk";

export const generateArbitraryResponse = async (
    newQuerySummaries: any[],
    extensionSDK: any,  
    restfulService: string,
    setFormattedData: (data: any) => void,
    prompt: string,
    sharedContext: Object,
    additionalData: Object,
    idToken?: string, // Accept ID token for Cloud Run
    vertexSettings?: { // Accept settings including Cloud Run URL
        vertexProject?: string,
        vertexLocation?: string,
        vertexModel?: string,
        cloudRunUrl?: string
    }
): Promise<Object> => {
    // Check if token was provided
    if (!idToken) {
        console.error('ID token is missing. Please authenticate first.');
        setFormattedData('Error: Authentication required. Please reload the page to login with Google.');
        return { error: 'Authentication required' };
    }

    // Validate ID token format (should be a JWT with 3 parts)
    if (!idToken.includes('.') || idToken.split('.').length !== 3) {
        console.error('Invalid ID token format. Token should be a JWT.');
        setFormattedData('Error: Invalid authentication token format. Please re-authenticate.');
        return { error: 'Invalid token format' };
    }

    // Try to decode the token to check if it's valid
    try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            console.warn('ID token has expired. Expiry:', new Date(payload.exp * 1000).toISOString());
            setFormattedData('Error: Authentication token has expired. Please reload the page to re-authenticate.');
            return { error: 'Token expired' };
        }
        console.log('ID token validated successfully. Expires:', new Date(payload.exp * 1000).toISOString());
    } catch (error) {
        console.error('Failed to decode ID token:', error);
        setFormattedData('Error: Invalid authentication token. Please re-authenticate.');
        return { error: 'Token decode failed' };
    }

    // Use provided settings or defaults
    const VERTEX_PROJECT = vertexSettings?.vertexProject || 'your-default-project';
    const VERTEX_LOCATION = vertexSettings?.vertexLocation || 'us-central1';
    const VERTEX_MODEL = vertexSettings?.vertexModel || 'gemini-1.5-flash';
    const CLOUD_RUN_URL = vertexSettings?.cloudRunUrl;
    
    if (!CLOUD_RUN_URL) {
        console.error('Cloud Run URL is missing from settings.');
        setFormattedData('Error: Cloud Run service URL not configured. Please check settings.');
        return { error: 'Cloud Run URL missing' };
    }
    
    const endpoint = `${CLOUD_RUN_URL}/vertex-passthrough`;
    
    console.log('Sending request to Cloud Run vertex-passthrough:', endpoint);
    console.log('Using ID token (first 20 chars):', idToken ? idToken.substring(0, 20) + '...' : 'MISSING');
    
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
        },
        // Add project, location, and model info for the passthrough
        project: VERTEX_PROJECT,
        location: VERTEX_LOCATION,
        model: VERTEX_MODEL
    };

    console.log('Request payload:', JSON.stringify(requestBody, null, 2));

    try {
        // Try fetchProxy first (preferred)
        let response;
        try {
            console.log('Attempting fetchProxy request to Cloud Run...');
            console.log('Request headers:', {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken ? idToken.substring(0, 20) + '...' : 'MISSING'}`
            });
            response = await extensionSDK.fetchProxy(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify(requestBody)
            });
            console.log('fetchProxy request successful');
        } catch (proxyError) {
            console.warn('fetchProxy failed, falling back to direct fetch...', proxyError);
            console.log('fetchProxy error details:', proxyError);
            // Fallback to direct fetch
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify(requestBody),
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Direct fetch failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText,
                    url: response.url
                });
                throw new Error(`Cloud Run vertex-passthrough error: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            response = await response.json();
        }

        console.log('Cloud Run vertex-passthrough response:', response);

        // Extract the content from the response
        let responseData = response;
        if (typeof response === 'object' && response.body) {
            responseData = response.body; // If using fetchProxy, response might be wrapped
        }
        
        if (responseData.candidates && responseData.candidates.length > 0) {
            const content = responseData.candidates[0].content;
            
            if (content && content.parts && content.parts.length > 0) {
                const chatContent = content.parts[0].text;
                setFormattedData(chatContent);
                return { chat: chatContent };
            }
        }
        
        throw new Error('No valid content in Cloud Run vertex-passthrough response');
    } catch (error: any) {
        console.error('Error in generateArbitraryResponse:', error);
        const errorMessage = error?.message || 'Unknown error occurred';
        setFormattedData(`Error: ${errorMessage}`);
        return { error: errorMessage };
    }
};