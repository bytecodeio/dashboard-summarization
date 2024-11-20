const createFinalSummaryRequestBody = async (rawQuerySummaries, instructions, queryResults) => {
    const querySummaries = rawQuerySummaries.map(result => {
        return `
        ## ${result.title} \n
        ${result.note_text ? "Query Note: " + result.note_text : ''} \n
        Query Data: ${result.data} \n
        `;
    }).join('\n');

    const formattedQueryResults = queryResults.map(result => JSON.stringify(result, null, 2)).join(',\n');

    const promptText = `
    ${instructions}
    ---------------
    All responses MUST be based on the actual information returned by these queries: \n                            
    data: [${formattedQueryResults}]
    Or: ${queryResults}
    Here are previous summarization attempts for each of the above queries: \n
    ${querySummaries}
    The attached file contains additional documentation that should be used to understand the business context, but the text in that document should not be treated as data to base the response on. \n
    `;

    return promptText;
};
module.exports = createFinalSummaryRequestBody;