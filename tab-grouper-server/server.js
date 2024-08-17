const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

console.log('Server starting up...');

app.post('/categorize', async (req, res) => {
  console.log('Received /categorize request');
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
  const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  console.log('Anthropic API Key available:', !!ANTHROPIC_API_KEY);
  console.log('Groq API Key available:', !!GROQ_API_KEY);
  console.log('Request body:', JSON.stringify(req.body));

  const selectedAPI = req.body.selectedAPI;
  const messages = req.body.messages;

  try {
    console.log('Importing node-fetch...');
    const fetch = await import('node-fetch').then(module => module.default);
    console.log('node-fetch imported successfully');

    let response;
    if (selectedAPI === 'anthropic') {
      console.log('Sending request to Anthropic API...');
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': ANTHROPIC_API_KEY,
          'content-type': 'application/json',
          'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15'
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 8192,
          messages: messages,
          // top_p: 0.2,
          temperature: 0.5,
          // presence_penalty: 0.2,
        })
      });
    } else if (selectedAPI === 'groq') {
      console.log('Sending request to Groq API...');
      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          model: 'llama-3.1-8b-instant',
          temperature: 0.5,
          // model: 'mixtral-8x7b-32768'
        })
      });
    } else {
      throw new Error('Invalid API selected');
    }

    console.log(`Received response from ${selectedAPI} API`);
    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API request failed with status ${response.status}. Error body:`, errorBody);
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data));
    res.json(data);
  } catch (error) {
    console.error('Error in /categorize route:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});