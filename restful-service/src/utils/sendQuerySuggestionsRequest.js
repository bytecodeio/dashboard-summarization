const sendQuerySuggestionsRequest = async (generativeModel, promptText, fileParts) => {
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

    const querySuggestionsResp = await generativeModel.generateContent(prompt);
    return querySuggestionsResp.response.candidates[0].content.parts[0].text;
};

module.exports = sendQuerySuggestionsRequest;