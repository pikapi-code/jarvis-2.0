import {
  GoogleGenAI,
  Chat,
  GenerateContentResponse,
  FunctionDeclaration,
  Type,
  Modality
} from "@google/genai";
import { addMemory, searchMemories, vectorSearchMemories } from "./db";
import { Message, Attachment, MessageRole, ToolCall } from "../types";

// Tool Definitions
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

export class JarvisService {
  private ai: GoogleGenAI;
  private chatSession: Chat | null = null;
  private modelName = 'gemini-2.5-flash';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private async getChatSession(): Promise<Chat> {
    if (!this.chatSession) {
      this.chatSession = this.ai.chats.create({
        model: this.modelName,
        config: {
          systemInstruction: `You are Jarvis, a highly intelligent personal AI assistant.
          
          **CORE OPERATING RULE**:
          You have **NO** built-in knowledge of the user (Abhishek). You **MUST** use the 'search_memory' tool to retrieve ANY personal information (likes, work, history, preferences).
          
          **WHEN TO USE 'search_memory' (MANDATORY)**:
          - **Direct Personal Questions**: "What do I like?", "Where do I work?", "What is my name?", "Who am I?"
          - **Recall Requests**: "Do you remember...", "What did we talk about...", "Summarize our last chat."
          - **Contextual Queries**: "Suggest a movie" (search for preferences), "Help me with my project" (search for project details).
          
          **WHEN TO SKIP 'search_memory'**:
          - **Greetings**: "Hi", "Hello", "Good morning".
          - **General Knowledge**: "What is the capital of France?", "How does a car work?"
          - **Pure Logic/Math**: "Calculate 2+2", "Write a python script to sort a list".
          
          **STRICT RESPONSE PROTOCOL**:
          1. **Analyze**: Does the user's message refer to "I", "me", "my", "we", or past interactions?
          2. **Action**: If YES, you **MUST** call 'search_memory' with **specific keywords** (not full sentences).
             - Example: For "What do I like?", search for "likes preferences favorites".
             - Example: For "Where do I work?", search for "work job company office".
             - **DO NOT** output text like "I don't know" or "I don't have that info" before searching.
             - **DO NOT** assume you know the answer without searching.
          3. **Fallback**: Only if the search returns no results, THEN ask the user for information.
          
          **MEMORY SAVING**:
          - If the user provides new information (e.g., "I love sci-fi movies", "I work at C5i"), use 'save_memory' immediately.
          
          Be professional, witty, and concise.`,
          tools: [{ functionDeclarations: [saveMemoryTool, searchMemoryTool] }],
        },
      });
    }
    return this.chatSession;
  }

  resetChat(): void {
    this.chatSession = null;
  }

  async generateSpeech(text: string): Promise<string | undefined> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
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
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      console.error("TTS Error:", error);
      return undefined;
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ai.models.embedContent({
        model: "text-embedding-004",
        contents: [{ parts: [{ text }] }]
      });
      return response.embeddings?.[0]?.values || [];
    } catch (error) {
      console.error("Embedding Error:", error);
      return [];
    }
  }

  async sendMessage(
    text: string,
    attachments: Attachment[] = [],
    contextMemories: string = "",
    onToolCall?: (call: ToolCall) => void
  ): Promise<{ text: string; audioData?: string }> {
    const chat = await this.getChatSession();

    const parts: any[] = [];

    // Inject context as system-like text if available
    let promptText = text;
    if (contextMemories) {
      promptText = `[CONTEXT FROM MEMORY DATABASE]:\n${contextMemories}\n\n[USER MESSAGE]:\n${text}`;
    }

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

    let functionCalls = response.functionCalls;

    while (functionCalls && functionCalls.length > 0) {
      const functionResponses = [];

      for (const call of functionCalls) {
        if (onToolCall) {
          onToolCall({ id: call.id, name: call.name, args: call.args });
        }

        console.log(`[Jarvis] Executing tool: ${call.name}`, call.args);

        let result: any = { error: "Unknown tool" };

        try {
          if (call.name === 'save_memory') {
            const args = call.args as any;
            const embedding = await this.getEmbedding(args.content);

            let mediaData = undefined;
            let mediaMimeType = undefined;
            let mediaName = undefined;
            let type: any = 'text'; // Use 'any' to avoid strict type issues if MemoryType isn't imported, or ensure it matches

            if (attachments && attachments.length > 0) {
              const att = attachments[0];
              mediaData = att.data;
              mediaMimeType = att.mimeType;
              mediaName = att.name;
              // Simple mapping
              if (att.mimeType.startsWith('image/')) type = 'image';
              else if (att.mimeType.startsWith('audio/')) type = 'audio';
              else type = 'file';
            }

            const id = await addMemory(
              args.content,
              args.category,
              args.tags,
              type,
              mediaData,
              mediaMimeType,
              mediaName,
              embedding
            );
            result = { success: true, memoryId: id, status: "Memory saved with vector embedding." };
          } else if (call.name === 'search_memory') {
            const args = call.args as any;
            const embedding = await this.getEmbedding(args.query);
            const vectorResults = await vectorSearchMemories(embedding);
            const keywordResults = await searchMemories(args.query);

            // Deduplicate
            const combined = [...vectorResults];
            for (const mem of keywordResults) {
              if (!combined.find(m => m.id === mem.id)) {
                combined.push(mem);
              }
            }

            // CRITICAL: Strip heavy data
            const sanitizedResults = combined.slice(0, 8).map(m => ({
              id: m.id,
              content: m.content,
              category: m.category,
              tags: m.tags,
              timestamp: new Date(m.timestamp).toISOString(),
              type: m.type,
              mediaName: m.mediaName
            }));

            result = { found: combined.length, results: sanitizedResults };
          }
        } catch (e: any) {
          result = { error: e.message };
        }

        functionResponses.push({
          id: call.id,
          name: call.name,
          response: { result }
        });
      }

      response = await chat.sendMessage({
        message: functionResponses.map(fr => ({
          functionResponse: fr
        }))
      });

      functionCalls = response.functionCalls;
    }

    return { text: response.text || "" };
  }

  async sendMessageStream(
    text: string,
    attachments: Attachment[] = [],
    contextMemories: string = "",
    onChunk: (text: string) => void,
    onToolCall?: (call: ToolCall) => void,
    onToolResult?: (call: ToolCall, result: any) => void
  ): Promise<{ text: string; audioData?: string }> {
    const chat = await this.getChatSession();

    const parts: any[] = [];

    // Inject context as system-like text if available
    let promptText = text;
    if (contextMemories) {
      promptText = `[CONTEXT FROM MEMORY DATABASE]:\n${contextMemories}\n\n[USER MESSAGE]:\n${text}`;
    }

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

    let currentMessage = parts;
    let fullText = "";

    while (true) {
      const stream = await chat.sendMessageStream({
        message: currentMessage
      });

      let textInTurn = "";
      const collectedFunctionCalls: any[] = [];

      for await (const chunk of stream) {
        try {
          const chunkText = chunk.text;
          if (chunkText) {
            textInTurn += chunkText;
            onChunk(chunkText);
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

      fullText += textInTurn;

      if (collectedFunctionCalls.length > 0) {
        const functionResponses = [];

        for (const call of collectedFunctionCalls) {
          if (onToolCall) {
            onToolCall({ id: call.id, name: call.name, args: call.args });
          } console.log(`[Jarvis] Executing tool: ${call.name}`, call.args);
          let toolResult: any = { error: "Unknown tool" };

          try {
            if (call.name === 'save_memory') {
              const args = call.args as any;
              const embedding = await this.getEmbedding(args.content);

              let mediaData = undefined;
              let mediaMimeType = undefined;
              let mediaName = undefined;
              let type: any = 'text';

              if (attachments && attachments.length > 0) {
                const att = attachments[0];
                mediaData = att.data;
                mediaMimeType = att.mimeType;
                mediaName = att.name;
                if (att.mimeType.startsWith('image/')) type = 'image';
                else if (att.mimeType.startsWith('audio/')) type = 'audio';
                else type = 'file';
              }

              const id = await addMemory(
                args.content,
                args.category,
                args.tags,
                type,
                mediaData,
                mediaMimeType,
                mediaName,
                embedding
              );
              toolResult = { success: true, memoryId: id, status: "Memory saved with vector embedding." };
            } else if (call.name === 'search_memory') {
              const args = call.args as any;
              const embedding = await this.getEmbedding(args.query);
              const vectorResults = await vectorSearchMemories(embedding);
              const keywordResults = await searchMemories(args.query);

              // Deduplicate
              const combined = [...vectorResults];
              for (const mem of keywordResults) {
                if (!combined.find(m => m.id === mem.id)) {
                  combined.push(mem);
                }
              }

              // CRITICAL: Strip heavy data (base64 images, embeddings) before sending to LLM
              // This prevents massive payloads that cause 90s+ latency
              const sanitizedResults = combined.slice(0, 8).map(m => ({
                id: m.id,
                content: m.content,
                category: m.category,
                tags: m.tags,
                timestamp: new Date(m.timestamp).toISOString(),
                type: m.type,
                mediaName: m.mediaName
                // Explicitly OMIT mediaData and embedding
              }));

              toolResult = { found: combined.length, results: sanitizedResults };
              
              // Pass the actual memories (not sanitized) to the UI callback
              if (onToolResult) {
                onToolResult(call, { found: combined.length, results: combined.slice(0, 8) });
              }
            }
          } catch (e: any) {
            toolResult = { error: e.message };
          }

          functionResponses.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { result: toolResult }
            }
          });
        }

        // Set next message to be the function responses
        currentMessage = functionResponses;
      } else {
        // No more function calls, we are done
        break;
      }
    }

    return { text: fullText };
  }
}
