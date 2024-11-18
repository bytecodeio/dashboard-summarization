export const sendRating = async (hash: string, rating: number, restfulService: string, extensionSDK: any): Promise<void> => {
  try {
    const response = await extensionSDK.serverProxy(`${restfulService}/rateSummary`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        hash,
        rating,
        client_secret: extensionSDK.createSecretKeyTag("genai_client_secret")
      })
    });

    if (response.ok) {
      console.log('Rating submitted successfully');
    } else {
      console.error('Error submitting rating:', response.statusText);
    }
  } catch (error) {
    console.error('Error submitting rating:', error);
  }
};