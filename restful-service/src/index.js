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
const cors = require('cors');
const app = express();
const {VertexAI} = require('@google-cloud/vertexai');
const dotenv = require('dotenv');
dotenv.config();

// Enable CORS for all origins (Looker extensions use fetchProxy which needs this)
app.use(cors());
app.use(express.json()); // To parse JSON bodies

// Middleware to validate API secret
app.use((req, res, next) => {
    // Skip validation for health check endpoint
    if (req.path === '/health') {
        return next();
    }

    const apiSecret = req.headers['dashboard_summary_api_secret'];
    const expectedSecret = process.env.DASHBOARD_SUMMARY_API_SECRET;

    if (!apiSecret) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing dashboard_summary_api_secret header'
        });
    }

    if (!expectedSecret) {
        console.error('DASHBOARD_SUMMARY_API_SECRET not configured in environment');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'API secret not configured'
        });
    }

    if (apiSecret !== expectedSecret) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid API secret'
        });
    }

    next();
});

// Initialize Vertex with your Cloud project and location
const vertexAI = new VertexAI({
    project: process.env.PROJECT || 'explore-assistant-cf-mis',
    location: process.env.REGION || 'us-central1'
});

// Instantiate the model
const generativeModel = vertexAI.getGenerativeModel({
    model: process.env.MODEL || 'gemini-2.0-flash-exp',
    generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
        topP: 0.8,
        topK: 40
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Main generation endpoint for the frontend
app.post('/generate', async (req, res) => {
    const {
        prompt,
        dashboardContext,
        queryData,
        additionalData,
        conversationHistory
    } = req.body;

    try {
        console.log('Received generate request:', {
            prompt: prompt?.substring(0, 100),
            hasContext: !!dashboardContext,
            hasQueryData: !!queryData,
            historyLength: conversationHistory?.length || 0
        });

        // Build conversation context from history
        const recentHistory = conversationHistory ? conversationHistory.slice(-5) : [];
        const conversationContext = recentHistory.length > 0
            ? recentHistory.map((exchange, index) =>
                `Previous Exchange ${index + 1}:\nUser: ${exchange.userPrompt}\nAssistant: ${exchange.aiResponse}`
              ).join('\n\n')
            : '';

        // Format the full prompt for the model
        const fullPrompt = `
You are an AI assistant analyzing dashboard data. This is a multi-turn conversation about the dashboard.

Here is the dashboard context information:
${JSON.stringify(dashboardContext, null, 2)}

Here is the query data:
${JSON.stringify(queryData, null, 2)}

${additionalData ? `Additional context:\n${JSON.stringify(additionalData, null, 2)}` : ''}

${conversationContext ? `Previous conversation context:\n${conversationContext}\n` : ''}

Current user request: ${prompt}

Please respond to the current request while being aware of the previous conversation context. Provide a detailed analysis based on this information.
        `;

        // Call Vertex AI
        const result = await generativeModel.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: fullPrompt }]
            }]
        });

        const responseText = result.response.candidates[0].content.parts[0].text;

        console.log('Generated response successfully');

        // Return in expected format
        res.json({
            response: responseText
        });

    } catch (error) {
        console.error('Error generating response:', error);
        res.status(500).json({
            error: 'Failed to generate response',
            message: error.message
        });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Dashboard Summarization Backend Service listening on port ${PORT}`);
    console.log(`Project: ${process.env.PROJECT || 'explore-assistant-cf-mis'}`);
    console.log(`Region: ${process.env.REGION || 'us-central1'}`);
    console.log(`Model: ${process.env.MODEL || 'gemini-2.0-flash-exp'}`);
});
