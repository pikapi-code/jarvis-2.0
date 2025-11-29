import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from '../ChatMessage';
import InputArea from '../InputArea';
import SearchModal from '../SearchModal';
import { Message, MessageRole, Attachment, ToolCall, Memory } from '../../types';
import { JarvisService } from '../../services/gemini';
import { playAudioContent } from '../../services/audio';
import { searchMemories, addMemory, vectorSearchMemories, saveConversation, getConversation } from '../../services/db';
import { Terminal, Wifi, Search, Volume2, VolumeX, Trash2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeSelector from '../ThemeSelector';

interface AssistantViewProps {
  service: JarvisService;
  onMemoryUpdate: () => void;
  onContextUpdate: (memories: any[]) => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
}

const AssistantView: React.FC<AssistantViewProps> = ({
  service,
  onMemoryUpdate,
  onContextUpdate,
  soundEnabled,
  onSoundToggle,
  conversationId,
  onConversationChange
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
        const id = conversationId || Date.now().toString();

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



  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
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

    try {
      // Automatic context search removed to allow agent to decide when to query memory
      const contextString = "";

      const thinkingId = 'thinking-' + Date.now();
      setMessages(prev => [...prev, {
        id: thinkingId,
        role: MessageRole.MODEL,
        text: '',
        timestamp: Date.now(),
        isThinking: true
      }]);

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

      if (attachments.length > 0) {
        for (const att of attachments) {
          const content = `User uploaded ${att.type}: ${att.name || 'unnamed'}`;
          const attEmbedding = await service.getEmbedding(content);

          await addMemory(
            content,
            'files',
            ['upload', att.type],
            att.type as any,
            att.data,
            att.mimeType,
            att.name,
            attEmbedding
          );
        }
        onMemoryUpdate();
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
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-500 text-xs hover:bg-white/10 transition-colors cursor-pointer group flex-1 max-w-sm mx-auto"
          >
            <Search size={12} className="group-hover:text-violet-400 transition-colors flex-shrink-0" />
            <span className="hidden md:inline truncate">Type ⌘K or Ctrl+K to search memories...</span>
            <span className="md:hidden">Search memories</span>
          </button>

          {/* Right: Model Info & Sound Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-mono text-violet-400/70">
              <Terminal size={12} />
              <span>GEMINI-2.5</span>
            </div>

            <button
              onClick={handleClearChat}
              className="p-2 rounded-full bg-white/5 text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-all"
              title="Clear Conversation"
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
      />
    </div>
  );
};

export default AssistantView;