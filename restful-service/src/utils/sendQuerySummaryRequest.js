const sendQuerySummaryRequest = async (generativeModel, promptText, fileParts) => {

    const prompt = {
        contents: [
            {
                role: 'user', parts: [
                    ...fileParts,
                    {
                        text: promptText
                    }
                ]
            }
        ]
    };

    const formattedResp = await generativeModel.generateContent(prompt);
    return formattedResp.response.candidates[0].content.parts[0].text;
};

module.exports =  sendQuerySummaryRequest;