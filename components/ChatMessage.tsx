import React from 'react';
import { Message, MessageRole } from '../types';
import { Bot, User, Cpu, Sparkles } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;

  const renderText = (text: string) => {
    const lines = text.trim().split('\n');
    return lines.map((line, idx) => {
      const boldParts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={idx} className="min-h-[1.5em] mb-1.5 last:mb-0">
          {boldParts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-violet-300 font-bold">{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] lg:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-4`}>

        {/* Avatar */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isUser
          ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
          : 'bg-space-800 border border-white/10 text-violet-400'
          }`}>
          {isUser ? <User size={18} /> : (
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 blur-sm opacity-50" />
              <Bot size={18} className="relative z-10" />
            </div>
          )}
        </div>

        {/* Message Card */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`p-5 rounded-2xl backdrop-blur-md shadow-lg transition-all duration-300 ${isUser
            ? 'bg-violet-600/10 border border-violet-500/20 text-white rounded-tr-sm'
            : 'glass-card text-slate-200 rounded-tl-sm hover:border-white/20'
            }`}>
            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {message.attachments.map((att, index) => (
                  att.type === 'image' ? (
                    <img
                      key={index}
                      src={`data:${att.mimeType};base64,${att.data}`}
                      alt="attachment"
                      className="max-w-[200px] max-h-[200px] rounded-lg border border-white/10 shadow-lg object-cover"
                    />
                  ) : att.type === 'audio' ? (
                    <div key={index} className="flex items-center gap-2 bg-space-900/50 px-3 py-2 rounded-lg text-xs text-violet-300 border border-violet-500/30">
                      <div className="w-2 h-2 bg-violet-neon rounded-full animate-pulse" />
                      Voice Recording
                    </div>
                  ) : null
                ))}
              </div>
            )}

            {message.isThinking ? (
              <div className="flex items-center gap-3 text-violet-400/80 text-sm py-1">
                <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                <span className="font-mono text-xs tracking-wider animate-pulse">
                  {message.text || "PROCESSING NEURAL PATHWAYS..."}
                </span>
              </div>
            ) : (
              <div className="text-xs leading-5 font-light tracking-wide text-slate-200">
                {renderText(message.text)}
              </div>
            )}
          </div>

          {/* Metadata Footer */}
          <div className={`flex items-center gap-2 mt-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-[10px] text-slate-500 font-mono">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isUser && !message.isThinking && (
              <>
                <span className="flex items-center gap-1 text-[10px] text-violet-500/50 bg-violet-500/5 px-1.5 py-0.5 rounded border border-violet-500/10">
                  <Sparkles size={8} />
                  AI GENERATED
                </span>
                {message.latencyMs && (
                  <span className="text-[10px] text-slate-600 font-mono">
                    {(message.latencyMs / 1000).toFixed(2)}s
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;