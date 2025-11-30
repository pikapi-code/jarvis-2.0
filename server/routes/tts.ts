import express from 'express';
import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';
import { validateText } from '../middleware/validation';
import { authenticateUser, getGeminiClientForUser } from '../utils/auth';

// Load environment variables
dotenv.config();

const router = express.Router();

// POST /api/tts - Generate speech from text
router.post('/', authenticateUser, validateText, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = (req as any).userId;

    const client = await getGeminiClientForUser(userId);
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      return res.status(500).json({ error: 'Failed to generate audio' });
    }

    res.json({ audioData });
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate speech' });
  }
});

export { router as ttsRouter };

