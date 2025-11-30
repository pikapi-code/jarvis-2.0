import { Request, Response, NextFunction } from 'express';

// Constants for validation
const MAX_MESSAGE_LENGTH = 100000; // 100k characters
const MAX_TEXT_LENGTH = 50000; // 50k characters for embeddings/TTS
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB per attachment
const MAX_CONTEXT_MEMORIES_LENGTH = 50000; // 50k characters

// Allowed MIME types for attachments
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json'
];

/**
 * Validate message input
 */
export const validateMessage = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId, message, attachments = [], contextMemories = '', userName } = req.body;

  // Validate sessionId
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required and must be a string' });
  }
  if (sessionId.length > 200) {
    return res.status(400).json({ error: 'sessionId is too long (max 200 characters)' });
  }

  // Validate message
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required and must be a string' });
  }
  if (message.trim().length === 0) {
    return res.status(400).json({ error: 'message cannot be empty' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ 
      error: `message is too long (max ${MAX_MESSAGE_LENGTH} characters)` 
    });
  }

  // Validate userName (optional)
  if (userName !== undefined && (typeof userName !== 'string' || userName.length > 100)) {
    return res.status(400).json({ error: 'userName must be a string with max 100 characters' });
  }

  // Validate contextMemories (optional)
  if (contextMemories && typeof contextMemories !== 'string') {
    return res.status(400).json({ error: 'contextMemories must be a string' });
  }
  if (contextMemories && contextMemories.length > MAX_CONTEXT_MEMORIES_LENGTH) {
    return res.status(400).json({ 
      error: `contextMemories is too long (max ${MAX_CONTEXT_MEMORIES_LENGTH} characters)` 
    });
  }

  // Validate attachments
  if (!Array.isArray(attachments)) {
    return res.status(400).json({ error: 'attachments must be an array' });
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    return res.status(400).json({ 
      error: `Too many attachments (max ${MAX_ATTACHMENTS})` 
    });
  }

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    if (!att || typeof att !== 'object') {
      return res.status(400).json({ error: `Attachment ${i + 1} is invalid` });
    }
    if (!att.mimeType || typeof att.mimeType !== 'string') {
      return res.status(400).json({ error: `Attachment ${i + 1} missing or invalid mimeType` });
    }
    if (!ALLOWED_MIME_TYPES.includes(att.mimeType)) {
      return res.status(400).json({ 
        error: `Attachment ${i + 1} has unsupported MIME type: ${att.mimeType}` 
      });
    }
    if (!att.data || typeof att.data !== 'string') {
      return res.status(400).json({ error: `Attachment ${i + 1} missing or invalid data` });
    }
    // Estimate size from base64 data (base64 is ~33% larger than binary)
    const estimatedSize = (att.data.length * 3) / 4;
    if (estimatedSize > MAX_ATTACHMENT_SIZE) {
      return res.status(400).json({ 
        error: `Attachment ${i + 1} is too large (max ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)` 
      });
    }
  }

  next();
};

/**
 * Validate text input (for embeddings and TTS)
 */
export const validateText = (req: Request, res: Response, next: NextFunction) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required and must be a string' });
  }
  if (text.trim().length === 0) {
    return res.status(400).json({ error: 'text cannot be empty' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ 
      error: `text is too long (max ${MAX_TEXT_LENGTH} characters)` 
    });
  }

  next();
};

/**
 * Validate function response input
 */
export const validateFunctionResponse = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId, functionResponses } = req.body;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required and must be a string' });
  }
  if (sessionId.length > 200) {
    return res.status(400).json({ error: 'sessionId is too long (max 200 characters)' });
  }

  if (!functionResponses || !Array.isArray(functionResponses)) {
    return res.status(400).json({ error: 'functionResponses is required and must be an array' });
  }
  if (functionResponses.length === 0) {
    return res.status(400).json({ error: 'functionResponses cannot be empty' });
  }
  if (functionResponses.length > 10) {
    return res.status(400).json({ error: 'Too many function responses (max 10)' });
  }

  for (let i = 0; i < functionResponses.length; i++) {
    const fr = functionResponses[i];
    if (!fr || typeof fr !== 'object') {
      return res.status(400).json({ error: `Function response ${i + 1} is invalid` });
    }
    if (!fr.id || typeof fr.id !== 'string') {
      return res.status(400).json({ error: `Function response ${i + 1} missing or invalid id` });
    }
    if (fr.response === undefined) {
      return res.status(400).json({ error: `Function response ${i + 1} missing response` });
    }
  }

  next();
};

/**
 * Validate message stream input (can be either new message OR function responses)
 */
export const validateMessageStream = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId, message, functionResponses, attachments = [], contextMemories = '', userName } = req.body;

  // Validate sessionId (always required)
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required and must be a string' });
  }
  if (sessionId.length > 200) {
    return res.status(400).json({ error: 'sessionId is too long (max 200 characters)' });
  }

  // If functionResponses provided, validate those
  if (functionResponses && functionResponses.length > 0) {
    if (!Array.isArray(functionResponses)) {
      return res.status(400).json({ error: 'functionResponses must be an array' });
    }
    if (functionResponses.length > 10) {
      return res.status(400).json({ error: 'Too many function responses (max 10)' });
    }
    // Function responses are validated by the chat route itself
    return next();
  }

  // Otherwise, validate as a new message
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required and must be a string (when functionResponses not provided)' });
  }
  if (message.trim().length === 0) {
    return res.status(400).json({ error: 'message cannot be empty' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ 
      error: `message is too long (max ${MAX_MESSAGE_LENGTH} characters)` 
    });
  }

  // Validate userName (optional)
  if (userName !== undefined && (typeof userName !== 'string' || userName.length > 100)) {
    return res.status(400).json({ error: 'userName must be a string with max 100 characters' });
  }

  // Validate contextMemories (optional)
  if (contextMemories && typeof contextMemories !== 'string') {
    return res.status(400).json({ error: 'contextMemories must be a string' });
  }
  if (contextMemories && contextMemories.length > MAX_CONTEXT_MEMORIES_LENGTH) {
    return res.status(400).json({ 
      error: `contextMemories is too long (max ${MAX_CONTEXT_MEMORIES_LENGTH} characters)` 
    });
  }

  // Validate attachments
  if (!Array.isArray(attachments)) {
    return res.status(400).json({ error: 'attachments must be an array' });
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    return res.status(400).json({ 
      error: `Too many attachments (max ${MAX_ATTACHMENTS})` 
    });
  }

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    if (!att || typeof att !== 'object') {
      return res.status(400).json({ error: `Attachment ${i + 1} is invalid` });
    }
    if (!att.mimeType || typeof att.mimeType !== 'string') {
      return res.status(400).json({ error: `Attachment ${i + 1} missing or invalid mimeType` });
    }
    if (!ALLOWED_MIME_TYPES.includes(att.mimeType)) {
      return res.status(400).json({ 
        error: `Attachment ${i + 1} has unsupported MIME type: ${att.mimeType}` 
      });
    }
    if (!att.data || typeof att.data !== 'string') {
      return res.status(400).json({ error: `Attachment ${i + 1} missing or invalid data` });
    }
    // Estimate size from base64 data (base64 is ~33% larger than binary)
    const estimatedSize = (att.data.length * 3) / 4;
    if (estimatedSize > MAX_ATTACHMENT_SIZE) {
      return res.status(400).json({ 
        error: `Attachment ${i + 1} is too large (max ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)` 
      });
    }
  }

  next();
};

/**
 * Validate chunk processing input
 */
export const validateChunkProcessing = (req: Request, res: Response, next: NextFunction) => {
  const { chunk, fileName, chunkIndex, totalChunks } = req.body;

  if (!chunk || typeof chunk !== 'string') {
    return res.status(400).json({ error: 'chunk is required and must be a string' });
  }
  if (chunk.trim().length === 0) {
    return res.status(400).json({ error: 'chunk cannot be empty' });
  }
  if (chunk.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ 
      error: `chunk is too long (max ${MAX_TEXT_LENGTH} characters)` 
    });
  }

  if (fileName !== undefined && (typeof fileName !== 'string' || fileName.length > 500)) {
    return res.status(400).json({ error: 'fileName must be a string with max 500 characters' });
  }

  if (chunkIndex !== undefined) {
    if (typeof chunkIndex !== 'number' || chunkIndex < 0 || !Number.isInteger(chunkIndex)) {
      return res.status(400).json({ error: 'chunkIndex must be a non-negative integer' });
    }
  }

  if (totalChunks !== undefined) {
    if (typeof totalChunks !== 'number' || totalChunks < 1 || !Number.isInteger(totalChunks)) {
      return res.status(400).json({ error: 'totalChunks must be a positive integer' });
    }
  }

  next();
};

