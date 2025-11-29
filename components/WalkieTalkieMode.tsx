import React, { useState, useEffect, useRef } from 'react';
import { Mic, Radio, Activity } from 'lucide-react';

interface WalkieTalkieModeProps {
    onSendMessage: (text: string) => void;
    isProcessing: boolean;
    lastMessage?: string;
}

const WalkieTalkieMode: React.FC<WalkieTalkieModeProps> = ({ onSendMessage, isProcessing, lastMessage }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    interimTranscript += event.results[i][0].transcript;
                }
                setTranscript(interimTranscript);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setError(event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        } else {
            setError('Speech recognition not supported in this browser.');
        }
    }, []);

    const startListening = () => {
        if (recognitionRef.current && !isListening && !isProcessing) {
            try {
                setTranscript('');
                setError(null);
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Failed to start recognition", e);
            }
        }
    };

    const stopListening = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            if (transcript.trim()) {
                console.log('[WalkieTalkie] Sending message:', transcript);
                onSendMessage(transcript);
                // Clear transcript immediately after sending
                setTranscript('');
            }
        }
    };

    // Clear transcript when processing starts (bot is responding)
    useEffect(() => {
        if (isProcessing) {
            console.log('[WalkieTalkie] Processing started, clearing transcript');
            setTranscript('');
        }
    }, [isProcessing]);

    // Log when lastMessage changes
    useEffect(() => {
        console.log('[WalkieTalkie] lastMessage updated:', lastMessage);
    }, [lastMessage]);

    // Status text logic
    let statusText = "HOLD TO SPEAK";
    let statusColor = "text-slate-400";
    let ringColor = "border-slate-700";
    let glowColor = "shadow-none";

    if (isListening) {
        statusText = "LISTENING...";
        statusColor = "text-red-400";
        ringColor = "border-red-500";
        glowColor = "shadow-[0_0_50px_rgba(239,68,68,0.3)]";
    } else if (isProcessing) {
        statusText = "RECEIVING...";
        statusColor = "text-violet-400";
        ringColor = "border-violet-500";
        glowColor = "shadow-[0_0_50px_rgba(139,92,246,0.3)]";
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-space-950">

            {/* Background Decor */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            </div>

            {/* Main Interface */}
            <div className="z-10 flex flex-col items-center gap-12 w-full max-w-md px-6">

                {/* Header / Status Display */}
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-widest">
                        <Radio size={14} className={isProcessing ? "animate-pulse text-violet-400" : ""} />
                        <span>Frequency: 2.5 GHz</span>
                        {isProcessing && <span className="text-violet-400">• LIVE</span>}
                    </div>
                    <h2 className={`text-2xl font-bold tracking-wider transition-colors duration-300 ${statusColor}`}>
                        {statusText}
                    </h2>
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                </div>

                {/* The Big Button */}
                <div className="relative group">
                    {/* Outer Rings */}
                    <div className={`absolute inset-0 rounded-full border-2 ${ringColor} opacity-20 scale-150 transition-all duration-500 ${isListening || isProcessing ? 'animate-ping-slow' : ''}`} />
                    <div className={`absolute inset-0 rounded-full border ${ringColor} opacity-40 scale-125 transition-all duration-300`} />

                    {/* Button Itself */}
                    <button
                        onMouseDown={startListening}
                        onMouseUp={stopListening}
                        onMouseLeave={stopListening}
                        onTouchStart={startListening}
                        onTouchEnd={stopListening}
                        disabled={isProcessing}
                        className={`
              w-48 h-48 rounded-full flex items-center justify-center
              bg-gradient-to-br from-space-800 to-space-900
              border-4 ${ringColor} ${glowColor}
              transition-all duration-200 active:scale-95
              disabled:opacity-80 disabled:cursor-not-allowed
              relative overflow-hidden
            `}
                    >
                        {/* Inner Glow */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                        {/* Icon */}
                        <div className={`relative z-10 transition-all duration-300 ${isListening ? 'scale-110' : 'scale-100'}`}>
                            {isProcessing ? (
                                <Activity size={64} className="text-violet-400 animate-bounce" />
                            ) : (
                                <Mic size={64} className={isListening ? "text-red-400" : "text-slate-400 group-hover:text-slate-200"} />
                            )}
                        </div>
                    </button>
                </div>

                {/* Transcript / Last Message Area */}
                <div className="w-full min-h-[100px] p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm text-center flex items-center justify-center">
                    {transcript ? (
                        <p className="text-lg text-slate-200 font-medium animate-pulse">"{transcript}"</p>
                    ) : lastMessage ? (
                        <p className={`text-lg font-light ${isProcessing ? 'text-violet-300 animate-pulse' : 'text-slate-300'}`}>"{lastMessage}"</p>
                    ) : isProcessing ? (
                        <p className="text-lg text-violet-300 font-light animate-pulse">...establishing connection...</p>
                    ) : (
                        <p className="text-sm text-slate-600 italic">Ready to transmit...</p>
                    )}
                </div>

                {/* Controls Hint */}
                <div className="text-xs text-slate-600 font-mono">
                    PRESS AND HOLD TO SPEAK • RELEASE TO SEND
                </div>

            </div>
        </div>
    );
};

export default WalkieTalkieMode;
