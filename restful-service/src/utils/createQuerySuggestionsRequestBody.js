const createQuerySuggestionsRequestBody = async (generativeModel, queryResults, querySummaries, nextStepsInstructions, fileParts) => {
    const promptText = `
    You are an analyst that will generate potential next-step investigation queries in JSON format.
    Please provide suggestions of queries or data exploration that could be done to further investigate the data. \n
    The output should be a JSON array of objects, each object representing a query or data exploration suggestion. \n
    Each query suggestion should include the following keys: "querySuggestion", "visualizationType", and "filters". \n
    - "querySuggestion": A detailed description of the query.
    - "visualizationType": The type of visualization to use (e.g., line, bar, table).
    - "filters": Any relevant filters to apply (e.g., last 1 month, facility name, top 3). \n
    These should address the potential next steps in analysis, with this criteria: ${nextStepsInstructions} \n
    They should be actionable and should be able to be executed in Looker. \n
    Here is data related to what is currently known and shown. These kinds of queries do not need to be repeated: \n                            
                    
    data: ${queryResults} \n

    Here are the previous analysis and next steps. Queries should be related to these next steps or issues:
    ${querySummaries} \n

    The attached file contains additional documentation that should be used to understand the business context, but the text in that document should not be treated as data to base the response on. \n

    Please include a date filter in EVERY query request, by adding the last 30 days if there is no other relevant date filter.
    Here is the desired output format for the response, with exactly three querySuggestion elements: \n
    ---------
    '''json
    [
        {
            "querySuggestion": "Show me the top XXX entries for YYY on October 13th, 2024",
            "visualizationType": "bar",
            "filters": ["date: last 30 days", "facility name: XXX"]
        },
        {
            "querySuggestion": "What are the lowest values for ZZZ, grouped by AAA, in the last 30 days?",
            "visualizationType": "table",
            "filters": ["date: last 30 days"]
        },
        {
            "querySuggestion": "What is the productivity for the AAA facility for the past 3 months?",
            "visualizationType": "line",
            "filters": ["date: last 3 months", "facility name: XXX"]
        }
    ]
    '''
    ----------
    `;

    return promptText;
};
module.exports = createQuerySuggestionsRequestBody;