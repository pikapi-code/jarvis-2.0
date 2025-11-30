import express from 'express';
import {
  GoogleGenAI,
  Chat,
  FunctionDeclaration,
  Type,
  Modality
} from '@google/genai';
import dotenv from 'dotenv';
import { validateMessage, validateMessageStream, validateFunctionResponse, validateChunkProcessing } from '../middleware/validation';
import { authenticateUser, getGeminiClientForUser } from '../utils/auth';

// Load environment variables (in case this module is loaded before server/index.ts)
dotenv.config();

const router = express.Router();

const modelName = 'gemini-2.5-flash';

// Tool definitions (same as frontend)
const saveMemoryTool: FunctionDeclaration = {
  name: 'save_memory',
  description: 'Saves a piece of information, fact, note, or diary entry into the user\'s persistent database.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: {
        type: Type.STRING,
        description: 'The content to remember.'
      },
      category: {
        type: Type.STRING,
        description: 'Category: "diary" (for personal logs), "work", "personal", "fact", "people".'
      },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Keywords for retrieval.'
      }
    },
    required: ['content', 'category']
  }
};

const searchMemoryTool: FunctionDeclaration = {
  name: 'search_memory',
  description: 'Searches the user\'s long-term memory database.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The search query.'
      }
    },
    required: ['query']
  }
};

// Store chat sessions per user (in production, use Redis or similar)
const chatSessions = new Map<string, Chat>();

// Export function to clear chat sessions for a user (when API key changes)
export function clearUserChatSessions(userId: string | null) {
  if (userId) {
    // Clear all sessions for this user
    const keysToDelete: string[] = [];
    for (const [key] of chatSessions) {
      if (key.endsWith(`-${userId}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => chatSessions.delete(key));
    console.log(`🗑️  Cleared ${keysToDelete.length} chat session(s) for user: ${userId}`);
  } else {
    // Clear server sessions
    const keysToDelete: string[] = [];
    for (const [key] of chatSessions) {
      if (key.endsWith('-server')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => chatSessions.delete(key));
  }
}

async function getChatSession(sessionId: string, userName?: string, userId?: string | null): Promise<Chat> {
  const cacheKey = `${sessionId}-${userId || 'server'}`;
  if (!chatSessions.has(cacheKey)) {
    const client = await getGeminiClientForUser(userId || null);
    // Get current date in a readable format
    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeString = currentDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    const chat = client.chats.create({
      model: modelName,
      config: {
        systemInstruction: `You are Jarvis, a highly intelligent personal AI assistant.
          
          **CURRENT DATE AND TIME**:
          Today is ${dateString}. The current time is ${timeString}.
          Use this information to provide time-aware responses, such as:
          - Greeting appropriately based on time of day
          - Understanding relative time references (e.g., "today", "yesterday", "next week")
          - Providing context-aware date-related information
          
          **CORE OPERATING RULE**:
          You have **NO** built-in knowledge of the user${userName ? ` (${userName})` : ''}. You **MUST** use the 'search_memory' tool to retrieve ANY personal information (likes, work, history, preferences, profession, activities).
          
          **WHEN TO USE 'search_memory' (MANDATORY)**:
          - **Direct Personal Questions**: "What do I like?", "Where do I work?", "What is my name?", "Who am I?", "What do I do?" (profession/work)
          - **Recall Requests**: "Do you remember...", "What did we talk about...", "Summarize our last chat."
          - **Contextual Queries**: "Suggest a movie" (search for preferences), "Help me with my project" (search for project details).
          - **Vague Personal Questions**: "What do I do?" ALWAYS means "What is my profession/work?" - you MUST search for "work job profession career occupation"
          
          **WHEN TO SKIP 'search_memory'**:
          - **Greetings**: "Hi", "Hello", "Good morning".
          - **General Knowledge**: "What is the capital of France?", "How does a car work?"
          - **Pure Logic/Math**: "Calculate 2+2", "Write a python script to sort a list".
          
          **STRICT RESPONSE PROTOCOL**:
          1. **Analyze**: Does the user's message refer to "I", "me", "my", "we", or ask about the user's personal information?
          2. **Action**: If YES, you **MUST** call 'search_memory' FIRST before responding. Use **specific keywords** (not full sentences).
             - Example: For "What do I like?", search for "likes preferences favorites".
             - Example: For "Where do I work?", search for "work job company office".
             - Example: For "What do I do?", search for "work job profession career occupation".
             - **CRITICAL**: You MUST call the tool - DO NOT respond without searching first.
             - **DO NOT** output text like "I don't know" or "I don't have that info" before searching.
             - **DO NOT** assume you know the answer without searching.
          3. **Fallback**: Only if the search returns no results, THEN ask the user for information.
          
          **MEMORY SAVING**:
          - If the user provides new information (e.g., "I love sci-fi movies", "I work at C5i"), use 'save_memory' immediately.
          
          Be professional, witty, and concise.`,
        tools: [{ functionDeclarations: [saveMemoryTool, searchMemoryTool] }],
      },
    });
    chatSessions.set(cacheKey, chat);
  }
  return chatSessions.get(cacheKey)!;
}

// POST /api/chat/message - Send a message (non-streaming)
router.post('/message', authenticateUser, validateMessage, async (req, res) => {
  try {
    const { sessionId, message, attachments = [], contextMemories = '', userName } = req.body;
    const userId = (req as any).userId;

    const chat = await getChatSession(sessionId, userName, userId);
    const parts: any[] = [];

    // Get current date/time for context
    const now = new Date();
    const currentDateInfo = `[CURRENT DATE/TIME]: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

    // Inject context as system-like text if available
    let promptText = message;
    if (contextMemories) {
      promptText = `${currentDateInfo}\n\n[CONTEXT FROM MEMORY DATABASE]:\n${contextMemories}\n\n[USER MESSAGE]:\n${message}`;
    } else {
      promptText = `${currentDateInfo}\n\n[USER MESSAGE]:\n${message}`;
    }

    // Add attachments
    for (const att of attachments) {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    }

    if (promptText.trim()) {
      parts.push({ text: promptText });
    }

    let response = await chat.sendMessage({
      message: parts
    });

    // Handle function calls (tool execution happens on frontend)
    const functionCalls = response.functionCalls || [];

    res.json({
      text: response.text || '',
      functionCalls: functionCalls.map((call: any) => ({
        id: call.id,
        name: call.name,
        args: call.args
      }))
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to process chat message' });
  }
});

// POST /api/chat/message-stream - Send a message (streaming)
router.post('/message-stream', authenticateUser, validateMessageStream, async (req, res) => {
  try {
    const { sessionId, message, attachments = [], contextMemories = '', userName, functionResponses } = req.body;
    const userId = (req as any).userId;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection message to let client know stream is ready
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const chat = await getChatSession(sessionId, userName, userId);
    let currentMessage: any;

    // If functionResponses provided, continue conversation with them
    if (functionResponses && functionResponses.length > 0) {
      currentMessage = functionResponses.map((fr: any) => ({
        functionResponse: fr
      }));
    } else {
      // New message (already validated by middleware)

      const parts: any[] = [];

      // Get current date/time for context
      const now = new Date();
      const currentDateInfo = `[CURRENT DATE/TIME]: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

      // Inject context as system-like text if available
      let promptText = message;
      if (contextMemories) {
        promptText = `${currentDateInfo}\n\n[CONTEXT FROM MEMORY DATABASE]:\n${contextMemories}\n\n[USER MESSAGE]:\n${message}`;
      } else {
        promptText = `${currentDateInfo}\n\n[USER MESSAGE]:\n${message}`;
      }

      // Add attachments
      for (const att of attachments) {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      }

      if (promptText.trim()) {
        parts.push({ text: promptText });
      }

      currentMessage = parts;
    }

    let fullText = '';

    while (true) {
      const stream = await chat.sendMessageStream({
        message: currentMessage
      });

      let textInTurn = '';
      const collectedFunctionCalls: any[] = [];

      for await (const chunk of stream) {
        try {
          const chunkText = chunk.text;
          if (chunkText) {
            textInTurn += chunkText;
            fullText += chunkText;
            // Send chunk to client
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
          }
        } catch (e) {
          // Ignore non-text chunks
        }

        try {
          const calls = chunk.functionCalls;
          if (calls && calls.length > 0) {
            collectedFunctionCalls.push(...calls);
          }
        } catch (e) {
          // Ignore
        }
      }

      if (collectedFunctionCalls.length > 0) {
        // Send function calls to client and end this stream
        // Client will execute tools and make a new request with function responses
        res.write(`data: ${JSON.stringify({ 
          type: 'functionCalls', 
          calls: collectedFunctionCalls.map((call: any) => ({
            id: call.id,
            name: call.name,
            args: call.args
          }))
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', text: fullText, needsFunctionResponse: true })}\n\n`);
        res.end();
        return;
      } else {
        // No more function calls, we are done
        break;
      }
    }

    // Send completion
    res.write(`data: ${JSON.stringify({ type: 'done', text: fullText })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// POST /api/chat/function-response - Send function response back to continue conversation
router.post('/function-response', authenticateUser, validateFunctionResponse, async (req, res) => {
  try {
    const { sessionId, functionResponses } = req.body;
    const userId = (req as any).userId;

    const chat = await getChatSession(sessionId, undefined, userId);
    
    const response = await chat.sendMessage({
      message: functionResponses.map((fr: any) => ({
        functionResponse: fr
      }))
    });

    res.json({
      text: response.text || '',
      functionCalls: (response.functionCalls || []).map((call: any) => ({
        id: call.id,
        name: call.name,
        args: call.args
      }))
    });
  } catch (error: any) {
    console.error('Function response error:', error);
    res.status(500).json({ error: error.message || 'Failed to process function response' });
  }
});

// POST /api/chat/reset - Reset chat session
router.post('/reset', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && chatSessions.has(sessionId)) {
    chatSessions.delete(sessionId);
  }
  res.json({ success: true });
});

// POST /api/chat/process-chunk - Process a file chunk with LLM for summarization and tagging
router.post('/process-chunk', authenticateUser, validateChunkProcessing, async (req, res) => {
  try {
    const { chunk, fileName, chunkIndex, totalChunks } = req.body;
    const userId = (req as any).userId;

    const client = await getGeminiClientForUser(userId || null);
    
    // Create a temporary chat session for processing this chunk
    const processingChat = client.chats.create({
      model: modelName,
      config: {
        systemInstruction: `You are an intelligent content processor specializing in extracting meaningful, searchable tags from documents. Your task is to:
        1. Create a concise, informative summary (2-4 sentences)
        2. Generate highly specific, actionable tags that enable precise retrieval

        **TAG GENERATION RULES (CRITICAL)**:
        - Tags must be SEARCHABLE and ACTIONABLE - think "what would someone search for?"
        - Extract CONCRETE ENTITIES: job titles, company names, technologies, tools, skills, certifications, degrees, institutions
        - Use SPECIFIC terms, not generic ones (prefer "data-scientist" over "professional", "fastapi" over "framework")
        - For resumes/professional content: extract role titles, company names, technologies used, specific skills, certifications, educational institutions
        - For technical content: extract specific technologies, frameworks, languages, methodologies, concepts
        - Tags should be lowercase, hyphenated (e.g., "business-intelligence", "azure-ai-engineer")
        - Generate 5-10 tags per chunk - prioritize specificity over quantity
        - AVOID generic tags like "content", "information", "section" unless truly necessary

        **GOOD TAG EXAMPLES**:
        - Job roles: "data-scientist", "business-intelligence-developer", "software-engineer"
        - Companies: "capgemini", "eli-lilly", "microsoft"
        - Technologies: "python", "fastapi", "postgresql", "azure", "machine-learning"
        - Skills: "etl-automation", "data-governance", "time-series-forecasting", "k-means-clustering"
        - Education: "iiitb", "post-graduate-diploma", "computer-science", "data-science"

        **BAD TAG EXAMPLES** (too generic):
        - "uploaded", "file-content", "section", "information", "content", "text"

        Return ONLY a JSON object with "summary" and "tags" fields.`,
              },
            });

            const prompt = `Analyze this text chunk from "${fileName}" (chunk ${chunkIndex + 1} of ${totalChunks}):

        ${chunk}

        Extract:
        1. A concise 2-4 sentence summary capturing the key information
        2. Classify the category based on content type:
          - "diary" for personal logs, daily entries, reflections, personal thoughts
          - "work" for professional content, work-related tasks, business information
          - "personal" for personal information, relationships, hobbies, interests
          - "fact" for factual information, knowledge, data, facts
          - "conversation" for dialogue, chat logs, conversations, Q&A
          - "general" if it doesn't fit any specific category
        3. 5-10 specific, searchable tags focusing on:
          - Concrete entities (job titles, companies, technologies, skills, institutions)
          - Specific technologies, tools, frameworks mentioned
          - Key concepts, methodologies, or techniques
          - Avoid generic terms - be specific and actionable

        IMPORTANT: Return ONLY a valid JSON object (no markdown, no code blocks, no additional text):
        {
          "summary": "Your summary here",
          "category": "diary|work|personal|fact|conversation|general",
          "tags": ["specific-tag-1", "specific-tag-2", "specific-tag-3"]
        }

        Tags must be lowercase, hyphenated, and highly specific. Category must be one of: diary, work, personal, fact, conversation, or general. Return ONLY the JSON object.`;

    const response = await processingChat.sendMessage({
      message: prompt
    });

    const responseText = response.text || '';
    
    // Try to extract JSON from the response
    let summary = '';
    let category = 'general';
    let tags: string[] = [];

    try {
      // Look for JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        summary = parsed.summary || responseText;
        // Validate category is one of the allowed values
        const validCategories = ['diary', 'work', 'personal', 'fact', 'conversation', 'general'];
        category = validCategories.includes(parsed.category?.toLowerCase()) 
          ? parsed.category.toLowerCase() 
          : 'general';
        tags = Array.isArray(parsed.tags) ? parsed.tags : [];
      } else {
        // Fallback: use the response as summary, extract tags from text
        summary = responseText;
        // Try to extract hashtags from the response
        const tagMatches = responseText.match(/#[\w-]+/g);
        if (tagMatches) {
          tags = tagMatches.map(t => t.substring(1).toLowerCase());
        }
      }
    } catch (parseError) {
      // If JSON parsing fails, use the full response as summary
      summary = responseText;
      // Try to extract hashtags
      const tagMatches = responseText.match(/#[\w-]+/g);
      if (tagMatches) {
        tags = tagMatches.map(t => t.substring(1).toLowerCase());
      }
    }

    // Filter out generic, non-helpful tags
    const genericTags = new Set([
      'content', 'information', 'text', 'section', 'chunk', 'data', 'file',
      'document', 'page', 'part', 'item', 'entry', 'record', 'detail',
      'uploaded', 'file-content', 'general', 'basic', 'standard', 'common'
    ]);
    
    tags = tags
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => {
        // Remove empty, too short, or generic tags
        if (!tag || tag.length < 3) return false;
        if (genericTags.has(tag)) return false;
        // Remove tags that are just numbers or single characters
        if (/^\d+$/.test(tag) || tag.length < 4) return false;
        return true;
      })
      // Remove duplicates
      .filter((tag, index, self) => self.indexOf(tag) === index);

    // Ensure we have at least some tags - extract meaningful words from summary if needed
    if (tags.length === 0) {
      // Extract meaningful words (4+ chars, not generic) from summary
      const words = summary.toLowerCase().match(/\b\w{4,}\b/g) || [];
      const meaningfulWords = words
        .filter(w => !genericTags.has(w) && w.length >= 4)
        .slice(0, 5);
      tags = meaningfulWords.length > 0 ? meaningfulWords : ['document-content'];
    }

    res.json({
      summary: summary.trim(),
      category: category,
      tags: tags
    });
  } catch (error: any) {
    console.error('Chunk processing error:', error);
    res.status(500).json({ error: error.message || 'Failed to process chunk' });
  }
});

export { router as chatRouter };
