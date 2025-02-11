import { query } from "@looker/sdk";

// Replace direct env access with extensionSDK
export const generateArbitraryResponse = async (
    newQuerySummaries: any[],
    extensionSDK: any,  
    restfulService: string,
    setFormattedData: (data: any) => void,
    prompt: string,
    sharedContext: Object,
    additionalData: Object,
): Promise<Object> => {
    const AI_ENDPOINT = `${restfulService}/generateArbitraryResponse`;
    
    console.log('Sending request to:', AI_ENDPOINT);
    
    const payload = {
        prompt: prompt,
        sharedContext, 
        newQuerySummaries, 
        additionalData,
        client_secret: extensionSDK.createSecretKeyTag("genai_client_secret")
    };

    console.log('Request payload:', JSON.stringify(payload, null, 2));

    try {
        // Use raw fetch instead of serverProxy for debugging
        const response = await extensionSDK.serverProxy(AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });


        if (!response.ok) {
            console.error('Server returned error:', response.status, response.statusText);
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        const responseData = await response.body;

        if (responseData.content?.chat || responseData.chat) {
            const chatContent = responseData.content?.chat || responseData.chat;
            setFormattedData(chatContent);
            return chatContent;
        } else {
            throw new Error('No chat content in response');
        }
    } catch (error) {
        console.error('Error in generateArbitraryResponse:', error);
        setFormattedData(`Error: ${error.message}`);
        return { error: error.message };
    }
};