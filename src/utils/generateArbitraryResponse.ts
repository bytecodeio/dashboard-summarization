import { query } from "@looker/sdk";
import { getCachedAIResponse, cacheAIResponse } from './caching';

export interface ConversationExchange {
    userPrompt: string;
    aiResponse: string;
    timestamp: number;
}

export const generateArbitraryResponse = async (
    newQuerySummaries: any[],
    extensionSDK: any,
    backendServiceUrl: string,
    setFormattedData: (data: any) => void,
    prompt: string,
    sharedContext: Object,
    additionalData: Object,
    conversationHistory?: ConversationExchange[] // Add conversation history
): Promise<Object> => {
    // Check if backend service URL is provided
    if (!backendServiceUrl) {
        console.error('Backend service URL is missing. Please configure it in settings.');
        setFormattedData('Error: Backend service not configured. Please contact your administrator.');
        return { error: 'Backend service not configured' };
    }

    // Ensure the URL ends with /generate endpoint
    const generateEndpoint = backendServiceUrl.endsWith('/generate') 
        ? backendServiceUrl 
        : `${backendServiceUrl.replace(/\/$/, '')}/generate`;
    
    console.log('Sending request to backend service:', generateEndpoint);
    
    // Create conversation history context (keep last 5 exchanges to manage context size)
    const recentHistory = conversationHistory ? conversationHistory.slice(-5) : [];

    // Configure request parameters for backend service
    const requestBody = {
        prompt: prompt,
        dashboardContext: sharedContext,
        queryData: newQuerySummaries,
        additionalData: additionalData,
        conversationHistory: recentHistory
    };

    console.log('Request payload:', JSON.stringify(requestBody, null, 2));

    try {
        // Make request to backend service (no auth needed - backend handles Vertex AI auth)
        const response = await extensionSDK.fetchProxy(generateEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response type:', typeof response);
        console.log('Response object:', response);

        if (!response.ok) {
            console.error('Backend service returned error:', response.status, response.statusText);
            throw new Error(`Backend service returned ${response.status}: ${response.statusText}`);
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

        console.log('Backend service response:', responseData);

        // Extract the content from backend service response
        // Expecting format: { response: "AI generated text" }
        if (responseData.response) {
            setFormattedData(responseData.response);
            return { chat: responseData.response };
        }

        throw new Error('No valid content in backend service response');
    } catch (error) {
        console.error('Error in generateArbitraryResponse:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setFormattedData(`Error: ${errorMessage}`);
        return { error: errorMessage };
    }
};