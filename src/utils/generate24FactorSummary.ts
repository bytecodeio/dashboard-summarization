import { query } from "@looker/sdk";

// Replace direct env access with extensionSDK
export const generate24FactorSummary = async (
    newQuerySummaries: any[],
    extensionSDK: any,
    setFormattedData: (data: any) => void,
    prompt: string,
    sharedContext: Object,
    marketData: Object,
): Promise<Object> => {
    const ai_cf_auth_token = process.env.AI_CF_AUTH_TOKEN;

    const AI_ENDPOINT = 'https://alpha-mlops-agent-api.knocktest.com/v1/agent/ask';
    // Change to point locally if you're testing.
    // const AI_ENDPOINT = 'http://localhost:5000';
   
    const body = JSON.stringify({
        product: "mfa",
        prompt: prompt,
        confirmation: "",
        chat_session_id: "some_chat_session_id",
        flow_id: "some_flow_id",
        user: {
          vanity_host: "sat2016h.sat.realpage.com",
          company_id: "some_company_id",
          property_id: "some_property_id",
          user_id: "some_user_id",
        },
        product_info:  {sharedContext, newQuerySummaries, marketData},
      })
  
      try {
        console.log('Sending request to AI Function with context and body:', body)
        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ai_cf_auth_token}`,
          },
          body: body,
        })
       
        if (response.status === 401) {
          throw new Error('Unauthorized: Failed to authenticate with improperly formatted auth header')
        }
  
          const responseData = await response.json()
          console.log('Response data with context:', responseData)
          
          // Parse the response and extract chat_response
          try {
            const parsedResponse = typeof responseData === 'string' ? JSON.parse(responseData) : responseData
            setFormattedData(parsedResponse.content.chat || parsedResponse.chat || `Error: No chat response found`);
            return parsedResponse.content.chat || parsedResponse.chat || `Error: No chat response found`
          } catch (error) {
            console.error('Error parsing response with context:', error)  
          }
     
      } catch (error) {
        console.error('Error sending request to AI Function with context:', error)
        throw error
      }
      return {}
    }