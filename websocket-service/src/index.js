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
const { VertexAI } = require('@google-cloud/vertexai');
const { LookerNodeSDK, NodeSettingsIniFile } = require('@looker/sdk-node');
const dotenv = require('dotenv');
dotenv.config();

const io = new Server(server, {
    pingInterval: 120,
    pingTimeout: 3000,
    cors: {
        // configure this to extension url for CORS Security
        origin: '*'
    }
})

app.get('/', (req, res) => {
    res.send('<h1>Hello world</h1>');
});

async function runLookerQuery(sdk, data) {
    try {
        const query = await sdk.ok(sdk.create_query(data))
        const { model, view, fields, pivots, fill_fields, filters, sorts, limit, column_limit, total, row_total, subtotals, dynamic_fields } = query
        const value = await sdk.ok(sdk.run_inline_query({
            body: { model, view, fields, pivots, fill_fields, filters, sorts, limit: 200, column_limit, total, row_total, subtotals, dynamic_fields },
            result_format: 'json',
            cache: true,
            apply_formatting: true,
            limit: 200
        }))
        return value
    } catch (e) {
        console.log('There was an error calling Looker: ', e)
    }
}

async function runLookerQueries(sdk, queries) {
    const queryResults = [];
    for (const query of queries) {
        const queryData = await runLookerQuery(sdk, query.queryBody);
        queryResults.push({ title: query.title, data: queryData, note_text: query.note_text });
    }
    return queryResults;
}

// for the 1-shot summary:
async function generateSummary(generativeModel, queryResults, nextStepsInstructions) {
    const querySummaries = queryResults.map(result => {
        return `
        ## ${result.title} \n
        ${result.note_text ? "Query Note: " + result.note_text : ''} \n
        Query Data: ${result.data} \n
        `;
    }).join('\n');

    const finalPromptData = `
    You are a specialized answering assistant that can summarize a Looker dashboard and the underlying data and propose operational next steps drawing conclusions from the Query Details listed above. Follow the instructions below:

    Please highlight the findings of all of the query data here. All responses MUST be based on the actual information returned by these queries: \n                            
    data: ${querySummaries}

    For example, use the names of the locations in the data series (like Seattle, Indianapolis, Chicago, etc) in recommendations regarding locations. Use the name of a process if discussing processes. Don't use row numbers to refer to any facility, process or location. This information should be sourced from the above data.
    Surface the most important or notable details and combine next steps recommendations into one bulleted list of 2-6 suggestions. \n 
    --------------
    Here is an output format Example:
        ---------------
        
        ## Web Traffic Over Time \n
        This query details the amount of web traffic received to the website over the past 6 months. It includes a web traffic source field of organic, search and display
        as well as an amount field detailing the amount of people coming from those sources to the website. \n
        
        > It looks like search historically has been driving the most user traffic with 9875 users over the past month with peak traffic happening in december at 1000 unique users.
        Organic comes in second and display a distant 3rd. It seems that display got off to a decent start in the year, but has decreased in volume consistently into the end of the year.
        There appears to be a large spike in organic traffic during the month of March a 23% increase from the rest of the year.\n
        \n
        
        ## Next Steps
        * Look into the data for the month of March to determine if there was an issue in reporting and/or what sort of local events could have caused the spike
        * Continue investing into search advertisement with common digital marketing strategies. IT would also be good to identify/breakdown this number by campaign source and see what strategies have been working well for Search.
        * Display seems to be dropping off and variable. Use only during select months and optimize for heavily trafficed areas with a good demographic for the site retention.\n
        \n
    -----------

    Please add actionable next steps, both for immediate intervention, improved data gathering and further analysis of existing data.
    Here are some tips for creating actionable next steps: \n
    -----------
    ${nextStepsInstructions}
    -----------
    
    `;

    const finalPrompt = {
        contents: [{ role: 'user', parts: [{ text: finalPromptData }] }]
    };

    const formattedResp = await generativeModel.generateContent(finalPrompt);
    return formattedResp.response.candidates[0].content.parts[0].text;
}

async function generateQuerySuggestions(generativeModel, queryResults, querySummaries, nextStepsInstructions) {
    const querySuggestionsPromptData = `
    You are an analyst that will generate potential next-step investigation queries in json format.
    Please provide suggestions of queries or data exploration that could be done to further investigate the data. \n
    The output should be a JSON array of strings, each string representing a query or data exploration suggestion. \n
    These should address the potential next steps in analysis, with this criteria: ${nextStepsInstructions} \n
    They should be actionable and should be able to be executed in Looker. \n
    Here is data related to what is currently known and shown. These kind of queries do not need to be repeated: \n                            
                    
    data: ${queryResults} \n

    Here are the previous analysis and next steps. Queries should be related to these next steps or issues:
    ${querySummaries} \n

    Please include a date filter in EVERY query request, by adding the last 30 days if there is no other relevant date filter.
    Here is the desired output format for the response, with exactly three querySuggestion elements: \n
    ---------
    '''json
    [
        {"querySuggestion": "Show me the top XXX entries for YYY on October 13th, 2024"},
        {"querySuggestion": "What are the lowest values for ZZZ, grouped by AAA, in the last 30 days?"},
        {"querySuggestion": "What is the producitivity and standard deviation for the XXX facility for the past 3 months?"}
    ]
    '''
    ----------
    
    `;

    const querySuggestionsPrompt = {
        contents: [{ role: 'user', parts: [{ text: querySuggestionsPromptData }] }]
    };

    const querySuggestionsResp = await generativeModel.generateContent(querySuggestionsPrompt);
    return querySuggestionsResp.response.candidates[0].content.parts[0].text;
}

// Initialize Vertex with your Cloud project and location
const vertexAI = new VertexAI({ project: process.env.PROJECT, location: process.env.REGION });
// Instantiate the model
const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-1.0-pro-001',
    generation_config: { max_output_tokens: 2500, temperature: 0.4, candidate_count: 1 }
});

const writeStructuredLog = (message) => {
    // Complete a structured log entry.
    return {
        severity: 'INFO',
        message: message,
        // Log viewer accesses 'component' as 'jsonPayload.component'.
        component: 'dashboard-summarization-logs',
    }
}


io.on('connection', async (socket) => {
    console.log("initial transport", socket.conn.transport.name); // prints "polling"

    socket.conn.once("upgrade", () => {
        // called when the transport is upgraded (i.e. from HTTP long-polling to WebSocket)
        console.log("upgraded transport", socket.conn.transport.name); // prints "websocket"
    });


    socket.on('my event', async (data) => {
        // setup looker sdk
        // Ignore any SDK environment variables for the node runtime
        const settings = new NodeSettingsIniFile('', 'looker.ini', JSON.parse(data).instance)
        const sdk = LookerNodeSDK.init40(settings)

        const querySummaries = []
        const nextStepsInstructions = JSON.parse(data).nextStepsInstructions
        for (const query of JSON.parse(data).queries) {
            const queryData = await runLookerQuery(sdk, query.queryBody)

            const context = `
            Dashboard Detail: ${JSON.parse(data).description || ''} \n
            Query Details:  "Query Title: ${query.title} \n ${query.note_text !== '' || query.note_text !== null ? "Query Note: " + query.note_text : ''} \n Query Fields: ${query.queryBody.fields} \n Query Data: ${queryData} \n"
            `
            const queryPrompt = `
            You are a specialized answering assistant that can summarize a Looker dashboard and the underlying data and propose operational next steps drawing conclusions from the Query Details listed above. Follow the instructions below:

            Instructions
            ------------

            - You always answer with markdown formatting
            - The markdown formatting you support: headings, bold, italic, links, lists, code blocks, and blockquotes.
            - You do not support images and never include images. You will be penalized if you render images. 
            - You will always format numerical values as either percentages or in dollar amounts rounded to the nearest cent. 
            - You should not indent any response.
            - Each dashboard query summary should start on a newline, should not be indented, and should end with a divider. 
            - Your summary for a given dashboard query should always start on a new line in markdown, should not be indented and should always include the following attributes starting with: 
              - A markdown heading that should use the Query Title data from the "context." The query name itself should be on a newline and should not be indented.
              - A description of the query that should start on a newline be a very short paragraph and should not be indented. It should be 2-3 sentences max describing the query itself and should be as descriptive as possible.
              - A summary summarizing the result set, pointing out trends and anomalies. It should be a single blockquote, should not be indented and or contain a table or list and should be a single paragraph. It should also be 3-5 sentences max summarizing the results of the query being as knowledgeable as possible with the goal to give the user as much information as needed so that they don't have to investigate the dashboard themselves. End with a newline,
              - A section for next steps. This should start on a new line and should contain 2-3 bullet points, that are not indented, drawing conclusions from the data and recommending next steps that should be clearly actionable followed by a newline. Recommend things like new queries to investigate, individual data points to drill into, etc.

            ------------

            Below here is an example of a formatted response in Markdown that you should follow. \n

            Format Examples
            ---------------
            
            ## Web Traffic Over Time \n
            This query details the amount of web traffic received to the website over the past 6 months. It includes a web traffic source field of organic, search and display
            as well as an amount field detailing the amount of people coming from those sources to the website. \n
            
            > It looks like search historically has been driving the most user traffic with 9875 users over the past month with peak traffic happening in december at 1000 unique users.
            Organic comes in second and display a distant 3rd. It seems that display got off to a decent start in the year, but has decreased in volume consistently into the end of the year.
            There appears to be a large spike in organic traffic during the month of March a 23% increase from the rest of the year.\n
            \n
            
            ## Next Steps
            * Look into the data for the month of March to determine if there was an issue in reporting and/or what sort of local events could have caused the spike
            * Continue investing into search advertisement with common digital marketing strategies. IT would also be good to identify/breakdown this number by campaign source and see what strategies have been working well for Search.
            * Display seems to be dropping off and variable. Use only during select months and optimize for heavily trafficed areas with a good demographic for the site retention.\n
            \n
            ---------------
            As best you can, please add actionable next steps. Here are some tips for creating actionable next steps:
            ${nextStepsInstructions}

            -----------
        
            Below are details/context on the dashboard and queries. Use this context to help inform your summary. Remember to keep these summaries concise, to the point and actionable. The data will be in CSV format. Take note of any pivots and the sorts on the result set when summarizing. \n
            
            Context
            ----------
            ${context}
            
            ----------
            Make sure to always summarize the responses and not return the entire raw query data in the response. Remember to always include the summary attributes that are listed in the instructions above.
            `
            const prompt = {
                contents: [
                    {
                        role: 'user', parts: [
                            {
                                text: queryPrompt
                            }
                        ]
                    }
                ]
            }


            const streamingResp = await generativeModel.generateContentStream(prompt)

            for await (const item of streamingResp.stream) {
                if (item.candidates[0].content.parts[0].text !== null) {
                    const formattedString = item.candidates[0].content.parts[0].text.split('\n').map(item => item.trim()).join('\n')
                    socket.emit('my broadcast event', formattedString)

                }
            }

            const queryResponse = await streamingResp.response
            querySummaries.push(
                JSON.stringify(queryResponse.candidates[0].content.parts[0].text)
            )

            // log billable characters for price monitoring
            console.log(
                JSON.stringify(
                    writeStructuredLog(
                        {
                            input_characters: (await generativeModel.countTokens(prompt)).totalBillableCharacters,
                            output_characters: (await generativeModel.countTokens({ contents: queryResponse.candidates[0].content })).totalBillableCharacters
                        }
                    )
                )
            )

        }

        // construct final prompt
        const finalPromptData = `
        Please summarize the findings of all of the query summaries. \n 
        Surface the most important or notable details and combine next steps recommendations into one bulleted list of 2-6 suggestions. \n 
        Combine the summaries into a single markdown document. \n
        Don't repeat the each query summary, or separate them by query. \n
    
        Please add actionable next steps, both for immediate intervention, improved data gathering and further analysis of existing data.
         Here are some tips for creating actionable next steps: \n
        -----------
        ${nextStepsInstructions}
        -----------
        
        Here are the previous query summaries: \n                            
        data: ${JSON.stringify(querySummaries)}
        `

        const finalPrompt = {
            contents: [{ role: 'user', parts: [{ text: finalPromptData }] }]
        }

        const formattedResp = await generativeModel.generateContent(finalPrompt)

        // log character counts for price monitoring
        const formattedRespParsed = formattedResp.response.candidates[0].content.parts[0].text.substring(formattedResp.response.candidates[0].content.parts[0].text.indexOf("[")).replace(/^`+|`+$/g, '').trim()
        socket.emit("complete", formattedRespParsed)
        console.log(
            JSON.stringify(
                writeStructuredLog(
                    {
                        input_characters: (await generativeModel.countTokens(finalPrompt)).totalBillableCharacters,
                        output_characters: (await generativeModel.countTokens({ contents: formattedResp.response.candidates[0].content })).totalBillableCharacters
                    }
                )
            )
        )

        // Create a prompt for querySuggestions, which will emit to the client after gathering potential future Looker Queries
        const querySuggestionsPromptData = `
        Please provide suggestions of queries or data exploration that could be done to further investigate the data. \n
        The output should be a JSON array of strings, each string representing a query or data exploration suggestion. \n
        These should address the potential next steps in analysis, with this criteria: ${nextStepsInstructions} \n
        They should be actionable and should be able to be executed in Looker. \n
        Here is the desired output format for the response, with exactly three querySuggestion elements: \n
        ---------
        '''json
        [
            {"querySuggestion": "Show me the top XXX entries for YYY"},
            {"querySuggestion": "What are the higest and lowest values for ZZZ, grouped by AAAA?"},
            {"querySuggestion": "What is the producitivity and standard deviation for the XXX facility for the past 3 months?"}
        ]
        '''
        ----------
        Here are the previous query summaries which should indicate the issues.: \n                            
        data: ${JSON.stringify(querySummaries)} \n
        ----------
        Making query suggestions based on past advice is excellent. Here is the past advice: \n
        ${JSON.stringify(formattedRespParsed)}
        `
        const querySuggestionsPrompt = {
            contents: [{ role: 'user', parts: [{ text: querySuggestionsPromptData }] }]
        }
        try {
            const querySuggestionsResp = await generativeModel.generateContent(querySuggestionsPrompt);

            console.log(JSON.stringify({
                severity: 'INFO',
                message: `Query Suggestions Raw: ${querySuggestionsResp.response.candidates[0].content.parts[0].text}`,
                component: 'dashboard-summarization-debug-logs',
            }))
            
            
            const querySuggestionsRespParsed = querySuggestionsResp.response.candidates[0].content.parts[0].text
                .substring(querySuggestionsResp.response.candidates[0].content.parts[0].text.indexOf("["))
                .replace(/^`+|`+$/g, '')
                .trim();
            console.log(JSON.stringify({
                severity: 'INFO',
                message: `Query SuggestionsResponse: ${querySuggestionsRespParsed}`,
                component: 'dashboard-summarization-debug-logs',
            }))
            socket.emit('querySuggestions', querySuggestionsRespParsed)
            // log billable characters for price monitoring
            console.log(
                JSON.stringify(
                    writeStructuredLog(
                        {
                            // input_characters: (await generativeModel.countTokens({ contents: querySuggestionsPromptData })).totalBillableCharacters,
                            output_characters: (await generativeModel.countTokens({ contents: querySuggestionsResp.response.candidates[0].content })).totalBillableCharacters
                        }
                    )
                )
            )
        } catch (error) {
            console.error('Error generating query suggestions:', error);
        }
    },
        socket.on('refine', async (data) => {
            const summary = JSON.parse(data)
            const refinePromptData = `The following text represents summaries of a given dashboard's data. \n
        Summaries 
        ----------
        ${summary} \n

        Please follow the below instructions:

        Instructions
        ------------
        - Make this much more concise for a slide presentation using the following format in json. 
        - Combine the summaries, removing duplicated information and making the text more concise.
        - Try to report what may be the most important information.
        - Provide actionable next steps in a single list of 2-6 bullet points.
        - Also provide suggestions of queries or data exploration that could be done to further investigate the data.
        - Each summary should only be included once. Do not include the same summary twice:\n

        Data Format
        -----------

        '''json 
        [
            {
                summary_of_findings: ...,
                key_points: [
                    ...
                ]
            },
            {
                recommended_next_steps: ...,
                key_points: [
                    ...
                ]
            },
            ...
            {
                query_or_explore_suggestions: ...,
                key_points: [
                    ...
                ]
            }
        ]
        '''
        `

            const refinePrompt = {
                contents: [{ role: 'user', parts: [{ text: refinePromptData }] }]
            }

            const formattedResp = await generativeModel.generateContentStream(refinePrompt)

            const queryResponse = await formattedResp.response
            // log billable characters for price monitoring
            console.log(
                JSON.stringify(
                    writeStructuredLog(
                        {
                            input_characters: (await generativeModel.countTokens(refinePrompt)).totalBillableCharacters,
                            output_characters: (await generativeModel.countTokens({ contents: queryResponse.candidates[0].content })).totalBillableCharacters
                        }
                    )
                )
            )
            const queryResponseParsed = queryResponse.candidates[0].content.parts[0].text.substring(queryResponse.candidates[0].content.parts[0].text.indexOf("[")).replace(/^`+|`+$/g, '').trim()
            socket.emit('my refine event', queryResponseParsed)
            socket.emit('complete', queryResponseParsed)
        })
    )

    socket.on('one-shot', async (data) => {
        try {
            const settings = new NodeSettingsIniFile('', 'looker.ini', JSON.parse(data).instance);
            const sdk = LookerNodeSDK.init40(settings);
            const queries = JSON.parse(data).queries;
            const nextStepsInstructions = JSON.parse(data).nextStepsInstructions;

            // Run Looker queries
            const queryResults = await runLookerQueries(sdk, queries);
            console.log('Query Results:', queryResults);
            console.log('Next Steps Instructions:', nextStepsInstructions);
            // Generate comprehensive summary
            const summary = await generateSummary(generativeModel, queryResults, nextStepsInstructions);

            // Generate query suggestions
            const querySuggestions = await generateQuerySuggestions(generativeModel, queryResults, summary, nextStepsInstructions);

            // Emit the final result
            socket.emit('one-shot-complete', { summary, querySuggestions });
        } catch (error) {
            console.error('Error in one-shot event:', error);
            socket.emit('error', 'Error processing one-shot event.');
        }
    });


    socket.on('connect', () => {
        console.log("Connected!")
        socket.broadcast.emit('my response', {
            data: 'Connected To Node Server'
        })
    })
    socket.on('disconnect', () => {
        socket.broadcast.emit('my response', {
            data: 'Disconnected'
        })
    });
});

const PORT = process.env.PORT ? process.env.PORT : 5000

server.listen(PORT, () => {
    console.log("Listening on: ", PORT)
})