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


const createQuerySuggestionsRequestBody = require('./utils/createQuerySuggestionsRequestBody');
const sendQuerySuggestionsRequest = require('./utils/sendQuerySuggestionsRequest');
const createQuerySummaryRequestBody = require('./utils/createQuerySummaryRequestBody');
const sendQuerySummaryRequest = require('./utils/sendQuerySummaryRequest');
const createFinalSummaryRequestBody = require('./utils/createFinalSummaryRequestBody');
const sendFinalSummaryRequest = require('./utils/sendFinalSummaryRequest');
const verifyClientSecret = require('./utils/verifyClientSecret');
const getFileParts = require('./utils/getFileParts');
const writeStructuredLog = require('./utils/writeStructuredLog');
const { writeToTable, writeToTableWithRating } = require('./utils/writeToTable');

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { VertexAI } = require('@google-cloud/vertexai');
const dotenv = require('dotenv');
dotenv.config();


// Increase the payload size limit
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


// Initialize Vertex with your Cloud project and location
const vertexAI = new VertexAI({ project: process.env.PROJECT, location: process.env.REGION });
// Instantiate the model
const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-flash-001', // Update to the new model
    generationConfig: { maxOutputTokens: 2500, temperature: 0.4, candidateCount: 1 }
});
app.post('/generateQuerySummary', verifyClientSecret, async (req, res) => {
    const { query, description } = req.body; // Update to receive query and description
    try {
        const fileParts = await getFileParts();
        // get the size of the files
        const attachmentSize = fileParts.reduce((acc, file) => acc + file.file_data.file_uri.length, 0);
        const promptText = await createQuerySummaryRequestBody(query, description);
        const summary = await sendQuerySummaryRequest(generativeModel, promptText, fileParts);
        const hash = await writeToTable(promptText, attachmentSize, JSON.stringify(summary), 'generateQuerySummary');
        res.json({ summary, hash });
    } catch (e) {
        console.log('There was an error processing the individual query summary: ', e);
        res.status(500).send('Internal Server Error');
    }
});
app.post('/generateSummary', verifyClientSecret, async (req, res) => {
    const { queryResults, querySummaries, nextStepsInstructions } = req.body; // Update to receive rawQuerySummaries and nextStepsInstructions
    console.log('Received request for /generateSummary');
    console.log(writeStructuredLog({message:JSON.stringify(queryResults), component:'generateSummary queryResults'}));
    try {
        const fileParts = await getFileParts();
        const attachmentSize = fileParts.reduce((acc, file) => acc + file.file_data.file_uri.length, 0);
        const promptText = await createFinalSummaryRequestBody(querySummaries, nextStepsInstructions, queryResults);
        const summary = await sendFinalSummaryRequest(generativeModel, promptText, fileParts);
        const hash = await writeToTable(promptText, attachmentSize, summary, 'generateFinalSummary');
        writeStructuredLog({message:JSON.stringify(summary), component:'generateSummary summary'});
        res.json({ summary, hash });
    } catch (e) {
        console.log('There was an error processing the dashboard summary: ', e);
        res.status(500).send('Internal Server Error');
    }
});
app.post('/generateQuerySuggestions', verifyClientSecret, async (req, res) => {
    const { queryResults, querySummaries, nextStepsInstructions } = req.body; // Update to receive queryResults, querySummaries, and nextStepsInstructions
    try {
        const fileParts = await getFileParts();
        const attachmentSize = fileParts.reduce((acc, file) => acc + file.file_data.file_uri.length, 0);
        const promptText = await createQuerySuggestionsRequestBody(generativeModel, queryResults, querySummaries, nextStepsInstructions, fileParts);
        const suggestions = await sendQuerySuggestionsRequest(generativeModel, promptText, fileParts);
        const hash = await writeToTable(promptText, attachmentSize, JSON.stringify(suggestions), 'generateQuerySuggestions');
        writeStructuredLog({message:JSON.stringify(suggestions), component:'generateQuerySuggestions suggestions'});
        res.json({ suggestions, hash }); // Correct the response key to suggestions
    } catch (e) {
        console.log('There was an error processing the query suggestions: ', e);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/rateSummary', verifyClientSecret, async (req, res) => {
    const { hash, rating } = req.body;
    try {
        await writeToTableWithRating(hash, rating);
        res.status(200).send('Rating updated successfully');
    } catch (e) {
        console.log('There was an error updating the rating: ', e);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = process.env.PORT ? process.env.PORT : 5000

server.listen(PORT, () => {
    console.log("Listening on: ", PORT)
})