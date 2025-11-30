import { addMemory, searchMemories, vectorSearchMemories } from "./supabase-db";
import { Attachment, ToolCall } from "../types";
import { getAuthHeaders } from "./api-client";

// Backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Generate a unique session ID for this chat session
let chatSessionId: string | null = null;

function getSessionId(): string {
  if (!chatSessionId) {
    chatSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  return chatSessionId;
}

export class JarvisService {
  private userName?: string;

  constructor(userName?: string) {
    this.userName = userName;
  }

  resetChat(): void {
    chatSessionId = null;
  }

  async generateSpeech(text: string): Promise<string | undefined> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate speech');
      }

      const data = await response.json();
      return data.audioData;
    } catch (error) {
      console.error("TTS Error:", error);
      return undefined;
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`[Jarvis] Requesting embedding for text: "${text.substring(0, 50)}..."`);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/embedding`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        console.error(`[Jarvis] Embedding API error:`, error);
        throw new Error(error.error || `Failed to generate embedding: HTTP ${response.status}`);
      }

      const data = await response.json();
      const embedding = data.embedding || [];
      
      if (embedding.length === 0) {
        console.warn(`[Jarvis] Received empty embedding from API`);
        throw new Error('Received empty embedding from API');
      }
      
      console.log(`[Jarvis] Successfully generated embedding, length: ${embedding.length}`);
      return embedding;
    } catch (error: any) {
      console.error("[Jarvis] Embedding Error:", error);
      console.error(`[Jarvis] API Base URL: ${API_BASE_URL}`);
      // Re-throw the error so callers can handle it appropriately
      throw error;
    }
  }

  async processChunk(chunk: string, fileName: string, chunkIndex: number, totalChunks: number): Promise<{ summary: string; category: string; tags: string[] }> {
    try {
      console.log(`[Jarvis] Processing chunk ${chunkIndex + 1}/${totalChunks} from ${fileName}...`);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chat/process-chunk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chunk,
          fileName,
          chunkIndex,
          totalChunks
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        console.error(`[Jarvis] Chunk processing API error:`, error);
        throw new Error(error.error || `Failed to process chunk: HTTP ${response.status}`);
      }

      const data = await response.json();
      const validCategories = ['diary', 'work', 'personal', 'fact', 'conversation', 'general'];
      const category = validCategories.includes(data.category?.toLowerCase()) 
        ? data.category.toLowerCase() 
        : 'general';
      console.log(`[Jarvis] Chunk processed: category="${category}", summary (${data.summary?.length || 0} chars), tags: [${data.tags?.join(', ') || 'none'}]`);
      return {
        summary: data.summary || chunk,
        category: category,
        tags: Array.isArray(data.tags) ? data.tags : []
      };
    } catch (error: any) {
      console.error("[Jarvis] Chunk Processing Error:", error);
      // Fallback: return the original chunk with basic tags
      return {
        summary: chunk,
        category: 'general',
        tags: ['file-content', 'uploaded']
      };
    }
  }

  async sendMessage(
    text: string,
    attachments: Attachment[] = [],
    contextMemories: string = "",
    onToolCall?: (call: ToolCall) => void
  ): Promise<{ text: string; audioData?: string }> {
    const sessionId = getSessionId();

    try {
      const headers = await getAuthHeaders();
      let response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          message: text,
          attachments,
          contextMemories,
          userName: this.userName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      let data = await response.json();
      let functionCalls = data.functionCalls || [];

      // Handle function calls (tool execution)
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
              let embedding: number[] | undefined;
              
              try {
                embedding = await this.getEmbedding(args.content);
                if (!embedding || embedding.length === 0) {
                  console.warn('[Jarvis] Failed to generate embedding for save_memory');
                }
              } catch (embedError: any) {
                console.error('[Jarvis] Error generating embedding for save_memory:', embedError);
                // Continue without embedding - memory will still be saved
              }

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
              result = { 
                success: true, 
                memoryId: id, 
                status: embedding ? "Memory saved with vector embedding." : "Memory saved (embedding unavailable)." 
              };
            } else if (call.name === 'search_memory') {
              const args = call.args as any;
              console.log('[Jarvis] Searching memory with query:', args.query);
              
              let embedding: number[] | undefined;
              try {
                embedding = await this.getEmbedding(args.query);
                console.log('[Jarvis] Generated embedding, length:', embedding.length);
              } catch (embedError: any) {
                console.error('[Jarvis] Error generating embedding for search:', embedError);
                // Fall back to keyword search only
                embedding = undefined;
              }
              
              const vectorResults = embedding ? await vectorSearchMemories(embedding) : [];
              console.log('[Jarvis] Vector search results:', vectorResults.length);
              
              const keywordResults = await searchMemories(args.query);
              console.log('[Jarvis] Keyword search results:', keywordResults.length);

              // Deduplicate
              const combined = [...vectorResults];
              for (const mem of keywordResults) {
                if (!combined.find(m => m.id === mem.id)) {
                  combined.push(mem);
                }
              }

              console.log('[Jarvis] Combined search results:', combined.length);

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

        // Send function responses back to continue conversation
        const headers = await getAuthHeaders();
        response = await fetch(`${API_BASE_URL}/api/chat/function-response`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            functionResponses,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send function response');
        }

        data = await response.json();
        functionCalls = data.functionCalls || [];
      }

      return { text: data.text || "" };
    } catch (error: any) {
      console.error("Send message error:", error);
      throw error;
    }
  }

  async sendMessageStream(
    text: string,
    attachments: Attachment[] = [],
    contextMemories: string = "",
    onChunk: (text: string) => void,
    onToolCall?: (call: ToolCall) => void,
    onToolResult?: (call: ToolCall, result: any) => void
  ): Promise<{ text: string; audioData?: string }> {
    const sessionId = getSessionId();

    try {
      // Use a recursive approach to handle function calls within streaming
      const streamWithFunctionCalls = async (
        message: string,
        messageAttachments: Attachment[],
        messageContext: string,
        functionResponses?: any[]
      ): Promise<string> => {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/api/chat/message-stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            message,
            attachments: messageAttachments,
            contextMemories: messageContext,
            userName: this.userName,
            functionResponses,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send message');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        let pendingFunctionCalls: any[] = [];

        if (!reader) {
          throw new Error('Failed to get response stream');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'chunk') {
                  fullText += data.text;
                  onChunk(data.text);
                } else if (data.type === 'functionCalls') {
                  pendingFunctionCalls = data.calls || [];
                } else if (data.type === 'done') {
                  // Stream complete, check if we need to handle function calls
                  if (data.needsFunctionResponse && pendingFunctionCalls.length > 0) {
                    // Execute function calls
                    const functionResponses = [];

                    for (const call of pendingFunctionCalls) {
                      if (onToolCall) {
                        onToolCall({ id: call.id, name: call.name, args: call.args });
                      }

                      console.log(`[Jarvis] Executing tool: ${call.name}`, call.args);

                      let toolResult: any = { error: "Unknown tool" };

                      try {
                        if (call.name === 'save_memory') {
                          const args = call.args as any;
                          let embedding: number[] | undefined;
                          
                          try {
                            embedding = await this.getEmbedding(args.content);
                            if (!embedding || embedding.length === 0) {
                              console.warn('[Jarvis] Failed to generate embedding for save_memory');
                            }
                          } catch (embedError: any) {
                            console.error('[Jarvis] Error generating embedding for save_memory:', embedError);
                            // Continue without embedding - memory will still be saved
                          }

                          let mediaData = undefined;
                          let mediaMimeType = undefined;
                          let mediaName = undefined;
                          let type: any = 'text';

                          if (messageAttachments && messageAttachments.length > 0) {
                            const att = messageAttachments[0];
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
                          toolResult = { 
                            success: true, 
                            memoryId: id, 
                            status: embedding ? "Memory saved with vector embedding." : "Memory saved (embedding unavailable)." 
                          };
                        } else if (call.name === 'search_memory') {
                          const args = call.args as any;
                          console.log('[Jarvis] Searching memory with query:', args.query);
                          
                          let embedding: number[] | undefined;
                          try {
                            embedding = await this.getEmbedding(args.query);
                            console.log('[Jarvis] Generated embedding, length:', embedding.length);
                          } catch (embedError: any) {
                            console.error('[Jarvis] Error generating embedding for search:', embedError);
                            // Fall back to keyword search only
                            embedding = undefined;
                          }
                          
                          const vectorResults = embedding ? await vectorSearchMemories(embedding) : [];
                          console.log('[Jarvis] Vector search results:', vectorResults.length);
                          
                          const keywordResults = await searchMemories(args.query);
                          console.log('[Jarvis] Keyword search results:', keywordResults.length);

                          // Deduplicate
                          const combined = [...vectorResults];
                          for (const mem of keywordResults) {
                            if (!combined.find(m => m.id === mem.id)) {
                              combined.push(mem);
                            }
                          }

                          console.log('[Jarvis] Combined search results:', combined.length);

                          // CRITICAL: Strip heavy data (base64 images, embeddings) before sending to LLM
                          const sanitizedResults = combined.slice(0, 8).map(m => ({
                            id: m.id,
                            content: m.content,
                            category: m.category,
                            tags: m.tags,
                            timestamp: new Date(m.timestamp).toISOString(),
                            type: m.type,
                            mediaName: m.mediaName
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
                        id: call.id,
                        name: call.name,
                        response: { result: toolResult }
                      });
                    }

                    // Continue conversation with function responses via new streaming request
                    const continueText = await streamWithFunctionCalls('', [], '', functionResponses);
                    return fullText + continueText;
                  }
                  return fullText;
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }

        // If we exit the loop without a 'done' message, handle function calls if any
        if (pendingFunctionCalls.length > 0) {
          const functionResponses = [];

          for (const call of pendingFunctionCalls) {
            if (onToolCall) {
              onToolCall({ id: call.id, name: call.name, args: call.args });
            }

            console.log(`[Jarvis] Executing tool: ${call.name}`, call.args);

            let toolResult: any = { error: "Unknown tool" };

            try {
              if (call.name === 'save_memory') {
                const args = call.args as any;
                let embedding: number[] | undefined;
                
                try {
                  embedding = await this.getEmbedding(args.content);
                  if (!embedding || embedding.length === 0) {
                    console.warn('[Jarvis] Failed to generate embedding for save_memory');
                  }
                } catch (embedError: any) {
                  console.error('[Jarvis] Error generating embedding for save_memory:', embedError);
                  // Continue without embedding - memory will still be saved
                }

                let mediaData = undefined;
                let mediaMimeType = undefined;
                let mediaName = undefined;
                let type: any = 'text';

                if (messageAttachments && messageAttachments.length > 0) {
                  const att = messageAttachments[0];
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
                toolResult = { 
                  success: true, 
                  memoryId: id, 
                  status: embedding ? "Memory saved with vector embedding." : "Memory saved (embedding unavailable)." 
                };
              } else if (call.name === 'search_memory') {
                const args = call.args as any;
                let embedding: number[] | undefined;
                try {
                  embedding = await this.getEmbedding(args.query);
                } catch (embedError: any) {
                  console.error('[Jarvis] Error generating embedding for search:', embedError);
                  // Fall back to keyword search only
                  embedding = undefined;
                }
                const vectorResults = embedding ? await vectorSearchMemories(embedding) : [];
                const keywordResults = await searchMemories(args.query);

                const combined = [...vectorResults];
                for (const mem of keywordResults) {
                  if (!combined.find(m => m.id === mem.id)) {
                    combined.push(mem);
                  }
                }

                const sanitizedResults = combined.slice(0, 8).map(m => ({
                  id: m.id,
                  content: m.content,
                  category: m.category,
                  tags: m.tags,
                  timestamp: new Date(m.timestamp).toISOString(),
                  type: m.type,
                  mediaName: m.mediaName
                }));

                toolResult = { found: combined.length, results: sanitizedResults };
                
                if (onToolResult) {
                  onToolResult(call, { found: combined.length, results: combined.slice(0, 8) });
                }
              }
            } catch (e: any) {
              toolResult = { error: e.message };
            }

            functionResponses.push({
              id: call.id,
              name: call.name,
              response: { result: toolResult }
            });
          }

          // Continue conversation with function responses via new streaming request
          const continueText = await streamWithFunctionCalls('', [], '', functionResponses);
          return fullText + continueText;
        }

        return fullText;
      };

      const result = await streamWithFunctionCalls(text, attachments, contextMemories);
      return { text: result };
    } catch (error: any) {
      console.error("Send message stream error:", error);
      throw error;
    }
  }
}