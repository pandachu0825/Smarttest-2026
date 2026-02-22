import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging system
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

function logMessage(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(path.join(logDir, 'api.log'), logEntry);
  console.log(logEntry.trim());
}

// API Handler with Failover Logic
app.post('/api/generate', async (req, res) => {
  const { prompt, systemInstruction } = req.body;
  
  const apiKeys = (process.env.API_KEYS || process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
  const models = (process.env.API_MODELS || 'gemini-3.1-pro-preview,gemini-3-flash-preview,gemini-2.5-flash-lite,gemini-1.5-flash').split(',').map(m => m.trim());

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: 'No API keys configured' });
  }

  let lastError = null;

  for (const model of models) {
    for (const apiKey of apiKeys) {
      try {
        logMessage(`Attempting with Model: ${model}, Key: ${apiKey.substring(0, 5)}...`);
        
        const genAI = new GoogleGenAI({ apiKey });
        const response = await genAI.models.generateContent({
          model: model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json',
          }
        });

        if (response && response.text) {
          logMessage(`Success with Model: ${model}`);
          return res.json({ text: response.text });
        }
      } catch (error: any) {
        lastError = error;
        const status = error?.status || 500;
        const message = error?.message || 'Unknown error';
        
        logMessage(`Error with Model: ${model}, Key: ${apiKey.substring(0, 5)}... - Status: ${status}, Message: ${message}`);
        
        // If it's not a quota or server error, maybe it's a prompt issue, but we still try next key/model
        if (status === 429 || status === 503 || status === 500) {
          continue; // Try next key/model
        } else {
          // For other errors (like 400 Bad Request), we might want to stop or continue
          continue;
        }
      }
    }
  }

  res.status(500).json({ 
    error: 'All keys and models failed', 
    details: lastError?.message || 'Unknown error' 
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
