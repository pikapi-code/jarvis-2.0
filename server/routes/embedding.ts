import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { validateText } from '../middleware/validation';
import { authenticateUser, getGeminiClientForUser } from '../utils/auth';

// Load environment variables
dotenv.config();

const router = express.Router();

// POST /api/embedding - Get embedding for text
router.post('/', authenticateUser, validateText, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = (req as any).userId;

    const client = await getGeminiClientForUser(userId);
    const response = await client.models.embedContent({
      model: 'text-embedding-004',
      contents: [{ parts: [{ text }] }]
    });

    const embedding = response.embeddings?.[0]?.values || [];

    res.json({ embedding });
  } catch (error: any) {
    console.error('Embedding error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate embedding' });
  }
});

export { router as embeddingRouter };

