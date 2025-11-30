import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from '../ChatMessage';
import InputArea from '../InputArea';
import SearchModal from '../SearchModal';
import { Message, MessageRole, Attachment, ToolCall, Memory } from '../../types';
import { JarvisService } from '../../services/gemini';
import { playAudioContent } from '../../services/audio';
import { searchMemories, addMemory, vectorSearchMemories, saveConversation, getConversation } from '../../services/supabase-db';
import { Wifi, Search, Volume2, VolumeX, Trash2, MessageSquarePlus } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeSelector from '../ThemeSelector';
import { extractAndChunkFile } from '../../services/fileExtraction';
import { hasApiKey } from '../../services/api-client';
import ApiKeyPrompt from '../ApiKeyPrompt';

interface AssistantViewProps {
  service: JarvisService;
  onMemoryUpdate: () => void;
  onContextUpdate: (memories: any[]) => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
  onNavigateToSettings?: () => void;
}

const AssistantView: React.FC<AssistantViewProps> = ({
  service,
  onMemoryUpdate,
  onContextUpdate,
  soundEnabled,
  onSoundToggle,
  conversationId,
  onConversationChange,
  onNavigateToSettings
}) => {
  const { currentTheme, setTheme } = useTheme();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: MessageRole.MODEL,
      text: "Systems online. Neural interface active. How may I assist you?",
      timestamp: Date.now()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);



  // Load conversation when ID changes
  useEffect(() => {
    const loadConv = async () => {
      if (conversationId) {
        const conv = await getConversation(conversationId);
        if (conv) {
          setMessages(conv.messages);
        }
      } else {
        // Reset to init if no ID (new chat)
        setMessages([{
          id: 'init',
          role: MessageRole.MODEL,
          text: "Systems online. Neural interface active. How may I assist you?",
          timestamp: Date.now()
        }]);
      }
    };
    loadConv();
  }, [conversationId]);

  // Save conversation on message update
  useEffect(() => {
    const saveConv = async () => {
      if (messages.length > 1) { // Don't save just the init message
        // Generate UUID v4 for new conversations (Supabase expects UUID format)
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        
        const id = conversationId || generateUUID();

        // If it's a new conversation, notify parent
        if (!conversationId) {
          onConversationChange(id);
        }

        const title = messages.find(m => m.role === 'user')?.text.slice(0, 50) || 'New Conversation';
        try {
          await saveConversation({
            id,
            title,
            messages,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error("Failed to save conversation:", error);
        }
      }
    };

    const timeout = setTimeout(saveConv, 1000); // Debounce save
    return () => clearTimeout(timeout);
  }, [messages, conversationId, onConversationChange]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper function to expand queries with related terms
  const expandQueryForSearch = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    // Map common question patterns to expanded search terms
    if (/where.*work|work.*where|company|employer/.test(lowerQuery)) {
      return `${query} work job company employer position role organization workplace`;
    }
    if (/what.*do|profession|occupation|career/.test(lowerQuery)) {
      return `${query} profession occupation career job role work position title`;
    }
    if (/what.*like|preference|favorite|enjoy/.test(lowerQuery)) {
      return `${query} preferences favorites likes interests hobbies`;
    }
    if (/where.*live|location|address|city/.test(lowerQuery)) {
      return `${query} location address city residence home`;
    }
    if (/who.*am|name|identity/.test(lowerQuery)) {
      return `${query} name identity personal information`;
    }
    
    return query;
  };
  
  // Helper function to extract keywords from a query
  const extractKeywords = (query: string): string[] => {
    const words = query.toLowerCase().match(/\b\w{3,}\b/g) || [];
    // Filter out common stop words
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'do', 'does', 'did', 'is', 'are', 'was', 'were', 'what', 'where', 'who', 'when', 'why', 'how']);
    return words.filter(w => !stopWords.has(w) && w.length >= 3);
  };

  const handleClearChat = () => {
    onConversationChange(null);
    onContextUpdate([]); // Clear related memories when chat is cleared
    setMessages([{
      id: 'init',
      role: MessageRole.MODEL,
      text: "Systems online. Neural interface active. How may I assist you?",
      timestamp: Date.now()
    }]);
  };

  const handleNewChat = async () => {
    // Generate UUID helper function
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    // Save current conversation if it has messages (beyond the init message)
    if (messages.length > 1) {
      const currentId = conversationId || generateUUID();
      
      const title = messages.find(m => m.role === 'user')?.text.slice(0, 50) || 'New Conversation';
      try {
        await saveConversation({
          id: currentId,
          title,
          messages,
          timestamp: Date.now()
        });
        console.log('[AssistantView] Saved conversation before starting new chat');
      } catch (error) {
        console.error("Failed to save conversation before starting new chat:", error);
      }
    }

    // Generate new conversation ID and start fresh
    const newConversationId = generateUUID();
    onConversationChange(newConversationId);
    onContextUpdate([]); // Clear related memories
    setMessages([{
      id: 'init',
      role: MessageRole.MODEL,
      text: "Systems online. Neural interface active. How may I assist you?",
      timestamp: Date.now()
    }]);
  };



  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    // Check if user has API key before sending message
    const userHasApiKey = await hasApiKey();
    if (!userHasApiKey) {
      setShowApiKeyPrompt(true);
      return;
    }

    const userMsgId = Date.now().toString();
    const newMessage: Message = {
      id: userMsgId,
      role: MessageRole.USER,
      text: text,
      timestamp: Date.now(),
      attachments: attachments
    };

    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    // Create thinking message IMMEDIATELY to show bot is processing
    const thinkingId = 'thinking-' + Date.now();
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: MessageRole.MODEL,
      text: '',
      timestamp: Date.now(),
      isThinking: true
    }]);

    try {
      // Detect personal questions and automatically search memories
      const lowerText = text.toLowerCase();
      const isPersonalQuestion = /\b(i|me|my|we|our|myself)\b/.test(lowerText) || 
                                  /what (do|does|did|is|are|was|were) (i|we)/.test(lowerText) ||
                                  /who (am|are) (i|we)/.test(lowerText) ||
                                  /where (do|does|did) (i|we)/.test(lowerText) ||
                                  /(tell|remember|recall|know).*(about|me|my|i)/.test(lowerText);
      
      let contextString = "";
      
      if (isPersonalQuestion) {
        // Update thinking message to show we're searching
        setMessages(prev => prev.map(m =>
          m.id === thinkingId ? { ...m, text: 'Scanning neural bank...' } : m
        ));

        // Automatically search memories for personal questions
        try {
          // Expand query with related terms for better matching
          const expandedQuery = expandQueryForSearch(text);
          
          console.log(`[AssistantView] Auto-searching memories for: "${text}" (expanded: "${expandedQuery}")`);
          
          // Generate embedding for the expanded query
          const queryEmbedding = await service.getEmbedding(expandedQuery);
          const vectorResults = await vectorSearchMemories(queryEmbedding);
          console.log(`[AssistantView] Vector search found ${vectorResults.length} results`);
          
          // Try multiple keyword searches with different terms
          const keywordQueries = [text, expandedQuery, ...extractKeywords(text)];
          const allKeywordResults: Memory[] = [];
          for (const query of keywordQueries) {
            const results = await searchMemories(query);
            for (const mem of results) {
              if (!allKeywordResults.find(m => m.id === mem.id)) {
                allKeywordResults.push(mem);
              }
            }
          }
          console.log(`[AssistantView] Keyword search found ${allKeywordResults.length} results`);
          
          // Deduplicate and combine results
          const combined = [...vectorResults];
          for (const mem of allKeywordResults) {
            if (!combined.find(m => m.id === mem.id)) {
              combined.push(mem);
            }
          }
          
          console.log(`[AssistantView] Combined search found ${combined.length} total memories`);
          
          // Format context string from top results
          if (combined.length > 0) {
            const topResults = combined.slice(0, 8); // Increase to 8 for better context
            contextString = `[RELEVANT MEMORIES FROM DATABASE]:\n\n` + 
              topResults.map((m, idx) => 
                `Memory ${idx + 1}:\n${m.content.substring(0, 700)}${m.content.length > 700 ? '...' : ''}`
              ).join('\n\n---\n\n') +
              `\n\n[END OF MEMORIES]`;
            
            // Update context panel
            onContextUpdate(topResults);
            
            console.log(`[AssistantView] Auto-retrieved ${combined.length} memories, using top ${topResults.length} for context`);
            console.log(`[AssistantView] Context preview: ${contextString.substring(0, 200)}...`);
          } else {
            console.warn(`[AssistantView] No memories found for personal question: "${text}"`);
          }
        } catch (error) {
          console.error('[AssistantView] Error auto-searching memories:', error);
          // Continue without context - AI can still use search_memory tool
        }

        // Clear the status text before starting the actual response
        setMessages(prev => prev.map(m =>
          m.id === thinkingId ? { ...m, text: '' } : m
        ));
      }

      const onToolCall = (call: ToolCall) => {
        let status = "Processing...";
        if (call.name === 'save_memory') {
          onMemoryUpdate();
          status = "Consolidating new memory...";
        } else if (call.name === 'search_memory') {
          status = "Scanning neural bank...";
        }

        setMessages(prev => prev.map(m =>
          m.id === thinkingId ? { ...m, text: status } : m
        ));
      };

      const onToolResult = (call: ToolCall, result: any) => {
        if (call.name === 'search_memory' && result?.results) {
          // Update the context panel with retrieved memories
          onContextUpdate(result.results);
        }
      };

      let accumulatedText = "";
      const onChunk = (text: string) => {
        accumulatedText += text;
        setMessages(prev => prev.map(m =>
          m.id === thinkingId
            ? { ...m, text: accumulatedText, isThinking: false }
            : m
        ));
      };

      const startTime = Date.now();
      const result = await service.sendMessageStream(text, attachments, contextString, onChunk, onToolCall, onToolResult);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Handle attachments separately to avoid blocking the message flow
      if (attachments.length > 0) {
        // Process attachments asynchronously without blocking
        Promise.all(attachments.map(async (att) => {
          try {
            // Extract and chunk file content if possible
            let extractedContent = null;
            try {
              extractedContent = await extractAndChunkFile(
                att.name || 'unnamed',
                att.data,
                1000,
                200,
                att.mimeType
              );
              if (extractedContent && extractedContent.text) {
                console.log(`Extracted ${extractedContent.text.length} characters from ${att.name}`);
                console.log(`Split into ${extractedContent.chunks.length} chunks`);
              }
            } catch (extractError: any) {
              console.warn(`Could not extract text content from ${att.name}:`, extractError);
              // Skip this attachment if we can't extract content
              return;
            }

            // If we extracted content, save each chunk as a separate memory
            if (extractedContent && extractedContent.chunks.length > 0) {
              console.log(`Saving ${extractedContent.chunks.length} content chunks for ${att.name}`);
              
              for (let i = 0; i < extractedContent.chunks.length; i++) {
                const chunk = extractedContent.chunks[i];
                const chunkContent = `Content from "${att.name || 'unnamed'}" (chunk ${i + 1}/${extractedContent.chunks.length}):\n\n${chunk}`;
                
                let chunkEmbedding: number[] | undefined;
                try {
                  chunkEmbedding = await service.getEmbedding(chunkContent);
                  if (!chunkEmbedding || chunkEmbedding.length === 0) {
                    console.warn(`Failed to generate embedding for chunk ${i + 1} of ${att.name}`);
                  }
                } catch (error: any) {
                  console.error(`Error generating embedding for chunk ${i + 1} of ${att.name}:`, error);
                }

                // Save chunk as a memory entry
                await addMemory(
                  chunkContent,
                  'files',
                  ['upload', att.type, 'file-content', `chunk-${i + 1}`],
                  'text',
                  undefined,
                  undefined,
                  `${att.name || 'unnamed'} (chunk ${i + 1})`,
                  chunkEmbedding
                );
              }
              
              console.log(`✅ Successfully saved ${extractedContent.chunks.length} content chunks for ${att.name}`);
            }
          } catch (error) {
            console.error(`Error saving attachment ${att.name}:`, error);
            // Don't throw - log and continue with other attachments
          }
        })).then(() => {
          onMemoryUpdate();
        }).catch((error) => {
          console.error('Error processing attachments:', error);
          // Still update memory list even if some attachments failed
          onMemoryUpdate();
        });
      }

      // Final update to ensure consistency (e.g. if stream finished but last chunk update pending, or to finalize ID)
      setMessages(prev => prev.map(m =>
        m.id === thinkingId
          ? { ...m, id: Date.now().toString(), text: result.text, isThinking: false, latencyMs: latency }
          : m
      ));

      if (soundEnabled && result.text.length < 500) {
        const audioData = await service.generateSpeech(result.text);
        if (audioData) {
          await playAudioContent(audioData);
        }
      }

    } catch (error) {
      console.error("Error processing message:", error);
      setMessages(prev => prev.filter(m => !m.isThinking).concat({
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        text: "Error processing request.",
        timestamp: Date.now()
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header / Command Bar - Fixed height with glass effect */}
      <div className="flex-shrink-0 py-5 px-8 bg-space-950/80 backdrop-blur-xl border-b border-white/5 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Left: Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded-full border border-emerald-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </div>
            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-slate-500">
              <Wifi size={12} />
              <span>32ms</span>
            </div>
          </div>

          {/* Center: Command Placeholder */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-500 text-[10px] hover:bg-white/10 transition-colors cursor-pointer group flex-1 max-w-xs mx-auto"
          >
            <Search size={11} className="group-hover:text-violet-400 transition-colors flex-shrink-0" />
            <span className="hidden md:inline truncate">Type ⌘K or Ctrl+K to search memories...</span>
            <span className="md:hidden">Search</span>
          </button>

          {/* Right: Model Info & Sound Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewChat}
              className="p-2 rounded-full bg-white/5 text-slate-500 hover:bg-violet-500/20 hover:text-violet-400 transition-all"
              title="New Chat (saves current conversation)"
            >
              <MessageSquarePlus size={14} />
            </button>

            <button
              onClick={handleClearChat}
              className="p-2 rounded-full bg-white/5 text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-all"
              title="Clear Conversation (without saving)"
            >
              <Trash2 size={14} />
            </button>

            <button
              onClick={onSoundToggle}
              className={`p-2 rounded-full transition-all ${soundEnabled
                ? 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
                : 'bg-white/5 text-slate-500 hover:bg-white/10'
                }`}
              title={soundEnabled ? 'Disable voice responses' : 'Enable voice responses'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            <ThemeSelector currentTheme={currentTheme} onThemeChange={setTheme} />
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
        <div className="max-w-3xl mx-auto w-full px-4 md:px-6 pt-6 pb-4 space-y-6">
          {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* Input Area - Compact Bottom */}
      <div className="flex-shrink-0 px-4 py-4 bg-space-950/95 backdrop-blur-sm border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <InputArea onSend={(text, att) => handleSendMessage(text, att)} disabled={isLoading} />
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        service={service}
        onSelectMemory={(memory: Memory) => {
          // Optionally handle memory selection - could send it as context or navigate
          console.log('Selected memory:', memory);
        }}
        onNavigateToSettings={onNavigateToSettings}
      />

      {/* API Key Prompt */}
      <ApiKeyPrompt
        isOpen={showApiKeyPrompt}
        onClose={() => setShowApiKeyPrompt(false)}
        onNavigateToSettings={onNavigateToSettings}
        message="Please add your Gemini API key in Settings to use the assistant."
      />
    </div>
  );
};

export default AssistantView;