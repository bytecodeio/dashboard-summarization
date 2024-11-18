const createQuerySummaryRequestBody = async (query, description) => {
    console.log('Generating individual query summary with data: ', JSON.stringify(query.queryData));
    const context = `
    Dashboard Detail: ${description || ''} \n
    Query Details:  "Query Title: ${query.title} \n ${query.note_text !== '' || query.note_text !== null ? "Query Note: " + query.note_text : ''} \n Query Fields: ${JSON.stringify(query.queryBody.fields)} \n Query Data: ${JSON.stringify(query.queryData)} \n"
    `;
    const promptText = `
    You are a specialized answering assistant that can summarize a Looker dashboard and the underlying data and propose operational next steps drawing conclusions from the Query Details listed above.
    
    You always answer with JSON formatting. You will be penalized if you do not answer with JSON when it would be possible.
    The JSON formatting you support should include the following keys: "queryName", "description", "summary", "nextSteps", "keyMetrics", "trends", "anomalies", "actionableInsights".
    
    Your response for each dashboard query should include the following attributes:
    - "queryName": The title of the query.
    - "description": A brief description of the query, 2-4 sentences max.
    - "summary": A summary of the results of the query, 3-5 sentences max.
    - "nextSteps": An array of 2-3 actionable next steps based on the data.
    - "keyMetrics": An array of key metrics extracted from the query data.
    - "trends": An array of identified trends in the data.
    - "anomalies": An array of any anomalies or unusual patterns in the data.
    - "actionableInsights": An array of insights that can be used for further analysis or decision-making.
    
    Each dashboard query summary should be a JSON object. Below are details on the dashboard and queries. \n
    
    '''
    Context: ${context}
    '''
    The attached file contains additional documentation that should be used to understand the business context, but the text in that document should not be treated as data to base the response on. \n
    Additionally, here is an example of a formatted response in JSON that you should follow, please use this as an example of how to structure your response and not verbatim copy the example text into your responses. \n
    
    {
        "queryName": "Web Traffic Over Time",
        "description": "This query details the amount of web traffic received to the website over the past 6 months. It includes a web traffic source field of organic, search and display as well as an amount field detailing the amount of people coming from those sources to the website.",
        "summary": "Search historically has been driving the most user traffic with 9875 users over the past month with peak traffic happening in December at 1000 unique users. Organic comes in second and display a distant 3rd. Display got off to a decent start in the year, but has decreased in volume consistently into the end of the year. There appears to be a large spike in organic traffic during the month of March, a 23% increase from the rest of the year.",
        "nextSteps": [
            "Look into the data for the month of March to determine if there was an issue in reporting and/or what sort of local events could have caused the spike.",
            "Continue investing into search advertisement with common digital marketing strategies. Identify/breakdown this number by campaign source and see what strategies have been working well for Search.",
            "Display seems to be dropping off and variable. Use only during select months and optimize for heavily trafficked areas with a good demographic for the site retention."
        ],
        "keyMetrics": [
            {"metric": "Total Users", "value": 9875},
            {"metric": "Peak Traffic", "value": 1000, "month": "December"},
            {"metric": "Organic Traffic Increase", "value": "23%", "month": "March"}
        ],
        "trends": [
            "Search traffic is consistently high.",
            "Display traffic is decreasing over time.",
            "Organic traffic spiked in March."
        ],
        "anomalies": [
            "Unusual spike in organic traffic in March.",
            "Drop in productivity on November 5th."
        ],
        "actionableInsights": [
            "Investigate the cause of the organic traffic spike in March.",
            "Optimize search advertisement strategies.",
            "Review display advertisement strategy."
        ]
    }
    `;

    return promptText;
};
module.exports = createQuerySummaryRequestBody;