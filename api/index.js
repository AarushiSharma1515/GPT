const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const ai = new GoogleGenAI({});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    console.log(`\n--- NEW REQUEST ---`);
    console.log(`[Backend] Received message: "${message}"`);

    const contents = history.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.parts[0]?.text || '' }]
    }));
    
    contents.push({ role: 'user', parts: [{ text: message }] });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`[Backend] Asking Gemini for response...`);
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: contents,
    });

    let chunkCount = 0;
    for await (const chunk of responseStream) {
      chunkCount++;
      if (chunk.text) {
        console.log(`[Backend] Chunk ${chunkCount} sent: ${chunk.text.substring(0, 15).replace(/\n/g, ' ')}...`);
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    
    console.log(`[Backend] Stream complete.`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('[Backend] API Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || "API crashed." })}\n\n`);
    res.end();
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log('Local server running on http://localhost:3000'));
}

module.exports = app;