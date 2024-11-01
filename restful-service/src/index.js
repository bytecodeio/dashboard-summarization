/*

MIT License

Copyright (c) 2023 Looker Data Sciences, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io')
const {VertexAI} = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

const storage = new Storage();
const bucketName = 'additional_context_docs_easy_metrics_gen_ai';

const storedClientSecret = process.env.GENAI_CLIENT_SECRET

app.use(express.json()); // To parse JSON bodies


const writeStructuredLog = (message) => {
    // Complete a structured log entry.
   return {
        severity: 'INFO',
        message: message,
        // Log viewer accesses 'component' as 'jsonPayload.component'.
        component: 'dashboard-summarization-logs',
    }
}

// Function to list files in the bucket and create fileParts
async function getFileParts() {
    const [files] = await storage.bucket(bucketName).getFiles();
    return files.map(file => ({
        file_data: {
            file_uri: `gs://${bucketName}/${file.name}`,
            mime_type: 'application/pdf' // Update this if your files have different MIME types
        }
    }));
}

// Middleware to verify client secret
const verifyClientSecret = (req, res, next) => {
    const clientSecret = req.body.client_secret;
    console.log('checking client secret', clientSecret, storedClientSecret);
    if (clientSecret === storedClientSecret) {
        next();
    } else {
        res.status(403).send('Forbidden: Invalid client secret');
    }
};


// Initialize Vertex with your Cloud project and location
const vertexAI = new VertexAI({project: process.env.PROJECT, location: process.env.REGION});
// Instantiate the model
const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-flash-001', // Update to the new model
    generationConfig: {maxOutputTokens: 2500, temperature: 0.4, candidateCount: 1}
});
app.post('/generateQuerySummary', verifyClientSecret, async (req, res) => {
    const { query, description } = req.body; // Update to receive query and description
    try {
        const fileParts = await getFileParts();
        const summary = await generateQuerySummary(generativeModel, query, description, fileParts);
        res.json({ summary });
    } catch (e) {
        console.log('There was an error processing the individual query summary: ', e);
        res.status(500).send('Internal Server Error');
    }
});
app.post('/generateSummary', verifyClientSecret, async (req, res) => {
    const { queryResults, querySummaries, nextStepsInstructions } = req.body; // Update to receive rawQuerySummaries and nextStepsInstructions
    try {
        const fileParts = await getFileParts();
        const summary = await generateSummary(generativeModel, queryResults, querySummaries, nextStepsInstructions, fileParts);
        res.json({ summary });
    } catch (e) {
        console.log('There was an error processing the dashboard summary: ', e);
        res.status(500).send('Internal Server Error');
    }
});
app.post('/generateQuerySuggestions', verifyClientSecret, async (req, res) => {
    const { queryResults, querySummaries, nextStepsInstructions } = req.body; // Update to receive queryResults, querySummaries, and nextStepsInstructions
    try {
        const fileParts = await getFileParts();
        const suggestions = await generateQuerySuggestions(generativeModel, queryResults, querySummaries, nextStepsInstructions, fileParts);
        res.json({ suggestions }); // Correct the response key to suggestions
    } catch (e) {
        console.log('There was an error processing the query suggestions: ', e);
        res.status(500).send('Internal Server Error');
    }
});

// for the individual query summary:
async function generateQuerySummary(generativeModel, query, description, fileParts) {
    const context = `
    Dashboard Detail: ${description || ''} \n
    Query Details:  "Query Title: ${query.title} \n ${query.note_text !== '' || query.note_text !== null ? "Query Note: " + query.note_text : ''} \n Query Fields: ${query.queryBody.fields} \n Query Data: ${query.queryData} \n"
    `;
    const queryPrompt = `
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
            "Unusual spike in organic traffic in March."
        ],
        "actionableInsights": [
            "Investigate the cause of the organic traffic spike in March.",
            "Optimize search advertisement strategies.",
            "Review display advertisement strategy."
        ]
    }
    `;
    const prompt = {
        contents: [
            {
                role: 'user', parts:[
                    ...fileParts,
                    {
                        text: queryPrompt
                    }
                ]
            }
        ]
    };

    const formattedResp = await generativeModel.generateContent(prompt);
    return formattedResp.response.candidates[0].content.parts[0].text;
}


// for the dashboard summary:
async function generateSummary(generativeModel, queryResults, rawQuerySummaries, nextStepsInstructions, fileParts) {
    const querySummaries = rawQuerySummaries.map(result => {
        return `
        ## ${result.title} \n
        ${result.note_text ? "Query Note: " + result.note_text : ''} \n
        Query Data: ${result.data} \n
        `;
    }).join('\n');

    const finalPromptData = `
    You are a specialized answering assistant that can summarize a Looker dashboard and the underlying data and propose operational next steps drawing conclusions from the Query Details listed above. Follow the instructions below:

    Please highlight the findings of all of the query data here. All responses MUST be based on the actual information returned by these queries: \n                            
    data: ${queryResults}
    Here is an earlier interpretation of the summaries of important information within each query: ${querySummaries} \n

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

    const finalPrompt = {
        contents: [{ role: 'user', parts: [
            ...fileParts,
            { text: finalPromptData }] }]
    };

    const formattedResp = await generativeModel.generateContent(finalPrompt);
    return formattedResp.response.candidates[0].content.parts[0].text;
}

async function generateQuerySuggestions(generativeModel, queryResults, querySummaries, nextStepsInstructions, fileParts) {
    const querySuggestionsPromptData = `
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
            "querySuggestion": "Show me the top XXX entries for YYY on October 13th, 2024. Use a bar chart visualization type. Filter to the last 30 days for the facility name ZZZ.",
        },
        {
            "querySuggestion": "What are the lowest values for ZZZ, grouped by AAA, in the last 30 days? Use a table visualization type. Filter to the last 30 days for the group name XXX.",
        },
        {
            "querySuggestion": "What is the productivity for the AAA facility for the past 3 months? Use a line chart visualization type. Filter to the last 3 months for the product type XXX.",
        }
    ]
    '''
    ----------
    `;

    const querySuggestionsPrompt = {
        contents: [{ role: 'user', parts: [
            ...fileParts,
            { text: querySuggestionsPromptData }] }]
    };

    const querySuggestionsResp = await generativeModel.generateContent(querySuggestionsPrompt);
    return querySuggestionsResp.response.candidates[0].content.parts[0].text;
}


const PORT = process.env.PORT ? process.env.PORT : 5000

server.listen(PORT, () => {
    console.log("Listening on: ", PORT)
})