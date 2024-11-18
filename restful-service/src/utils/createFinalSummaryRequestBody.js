const createFinalSummaryRequestBody = async (rawQuerySummaries, nextStepsInstructions, queryResults) => {
    const querySummaries = rawQuerySummaries.map(result => {
        return `
        ## ${result.title} \n
        ${result.note_text ? "Query Note: " + result.note_text : ''} \n
        Query Data: ${result.data} \n
        `;
    }).join('\n');

    const promptText = `
    You are a specialized answering assistant that can summarize a Looker dashboard and the underlying data and propose operational next steps drawing conclusions from the Query Details listed above. Follow the instructions below:

    Please highlight the findings of all of the query data here. All responses MUST be based on the actual information returned by these queries: \n                            
    data: ${JSON.stringify(queryResults)}

    Here are previous summarization attempts for each of the above queries: \n
    ${querySummaries}

    For example, use the names of the locations in the data series (like Seattle, Indianapolis, Chicago, etc) in recommendations regarding locations. Use the name of a process if discussing processes. Don't use row numbers to refer to any facility, process or location. This information should be sourced from the above data.
    Surface the most important or notable details and combine next steps recommendations into one bulleted list of 2-6 suggestions. \n 
    --------------
    Here is an output format Example:
        ---------------
        
        ## Summary of Findings \n
        1. Key finding 1
        2. Key finding 2
        3. Key finding 3
        4. Key finding 4
        5. Key finding 5 \n
        
        ## Next Steps \n
        * Actionable next step 1
        * Actionable next step 2
        * Actionable next step 3
        * Actionable next step 4
        * Actionable next step 5 \n
    -----------

    Please add actionable next steps, both for immediate intervention, improved data gathering and further analysis of existing data.
    Here are some tips for creating actionable next steps: \n
    -----------
    ${nextStepsInstructions}
    -----------
    
    The attached file contains additional documentation that should be used to understand the business context, but the text in that document should not be treated as data to base the response on. \n

    `;


    return promptText;
};
module.exports = createFinalSummaryRequestBody;