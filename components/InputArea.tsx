import React, { useState, useRef } from 'react';
import { Send, Mic, Image as ImageIcon, X, Paperclip, Square, BrainCircuit } from 'lucide-react';
import { Attachment } from '../types';
import { blobToBase64 } from '../services/audio';

interface InputAreaProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  disabled: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = (textOverride?: string) => {
    const textToSend = textOverride !== undefined ? textOverride : input;
    if ((!textToSend.trim() && attachments.length === 0) || disabled) return;
    
    onSend(textToSend, attachments);
    if (textOverride === undefined) {
        setInput('');
        setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        let type: Attachment['type'] = 'text';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('audio/')) type = 'audio';
        else type = 'file';

        setAttachments(prev => [...prev, {
          type,
          mimeType: file.type,
          data: base64String,
          name: file.name
        }]);
      };
      
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const base64 = await blobToBase64(audioBlob);
        
        setAttachments(prev => [...prev, {
          type: 'audio',
          mimeType: 'audio/webm',
          data: base64,
          name: 'voice_note.webm'
        }]);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1.5">
      
      {/* Quick Actions */}
      {!input && attachments.length === 0 && !isRecording && (
          <div className="flex gap-2 overflow-x-auto pb-1 justify-center md:justify-start">
             <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                <Paperclip size={10} /> Upload
             </button>
             <button onClick={() => handleSend("What can you remember about me?")} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                <BrainCircuit size={10} /> What do you remember?
             </button>
          </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 px-1">
          {attachments.map((att, i) => (
            <div key={i} className="relative group bg-slate-900/80 backdrop-blur rounded-xl p-2 border border-white/10 flex items-center min-w-[140px] shadow-lg">
              {att.type === 'image' ? (
                <img src={`data:${att.mimeType};base64,${att.data}`} className="h-10 w-10 object-cover rounded-lg" alt="upload" />
              ) : (
                <div className="h-10 w-10 bg-white/5 rounded-lg flex items-center justify-center text-violet-400">
                  {att.type === 'audio' ? <Mic size={18} /> : <Paperclip size={18} />}
                </div>
              )}
              <div className="ml-3">
                  <div className="text-[10px] text-violet-300 uppercase font-bold">{att.type}</div>
                  <div className="text-xs text-slate-300 truncate max-w-[80px]">{att.name || 'Attachment'}</div>
              </div>
              <button 
                onClick={() => removeAttachment(i)}
                className="absolute -top-2 -right-2 bg-slate-800 text-slate-400 rounded-full p-1 hover:bg-red-500 hover:text-white transition-colors border border-slate-700 shadow-md"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Bar */}
      <div className={`relative flex items-end gap-2 p-1.5 rounded-xl border transition-all duration-300 shadow-xl ${
          isRecording 
            ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
            : 'glass-panel bg-black/40'
      }`}>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileSelect} 
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-slate-400 hover:text-violet-400 hover:bg-white/5 rounded-lg transition-colors"
          title="Upload File"
        >
          <Paperclip size={18} />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening..." : "Message Jarvis..."}
          className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-sm p-3 focus:outline-none resize-none max-h-32 min-h-[44px]"
          rows={1}
          style={{ height: 'auto', minHeight: '44px' }} 
        />

        {/* Action Button */}
        <div className="flex gap-1">
            {isRecording ? (
                <button 
                    onClick={stopRecording}
                    className="p-2.5 rounded-lg bg-red-500 text-white animate-pulse shadow-lg shadow-red-900/30 flex items-center gap-2"
                >
                    <Square size={14} fill="currentColor" />
                </button>
            ) : input.trim() || attachments.length > 0 ? (
                 <button 
                    onClick={() => handleSend()}
                    disabled={disabled}
                    className={`p-2.5 rounded-lg transition-all duration-200 ${
                    disabled 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                        : 'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]'
                    }`}
                >
                    <Send size={18} className={disabled ? '' : 'ml-0.5'} />
                </button>
            ) : (
                <button 
                    onClick={startRecording}
                    className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Voice Message"
                >
                    <Mic size={20} />
                </button>
            )}
        </div>
      </div>
      
      {/* Footer Hint - Minimized */}
      <div className="text-center mt-0.5">
         <span className="text-[9px] text-slate-700 font-mono tracking-widest uppercase">Secured Environment</span>
      </div>
    </div>
  );
};

export default InputArea;