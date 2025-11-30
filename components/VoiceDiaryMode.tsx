import React, { useState, useEffect, useRef } from 'react';
import { Mic, Radio, BookOpen, Check } from 'lucide-react';
import { addMemory } from '../services/supabase-db';
import { JarvisService } from '../services/gemini';
import { hasApiKey } from '../services/api-client';
import ApiKeyPrompt from './ApiKeyPrompt';

interface VoiceDiaryModeProps {
    service: JarvisService;
    onDiaryAdded?: () => void;
    onNavigateToSettings?: () => void;
}

const VoiceDiaryMode: React.FC<VoiceDiaryModeProps> = ({ service, onDiaryAdded, onNavigateToSettings }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedEntry, setLastSavedEntry] = useState<string>('');
    const [showSuccess, setShowSuccess] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);

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
        if (recognitionRef.current && !isListening && !isSaving) {
            try {
                setTranscript('');
                setError(null);
                setShowSuccess(false);
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Failed to start recognition", e);
            }
        }
    };

    const stopListening = async () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);

            if (transcript.trim()) {
                setIsSaving(true);
                try {
                    // Check for API key before getting embedding
                    const userHasApiKey = await hasApiKey();
                    if (!userHasApiKey) {
                        setShowApiKeyPrompt(true);
                    }

                    // Get embedding for the diary entry
                    let embedding: number[] | undefined;
                    try {
                        if (userHasApiKey) {
                            embedding = await service.getEmbedding(transcript);
                        }
                        if (!embedding || embedding.length === 0) {
                            console.warn('Failed to generate embedding for voice diary entry');
                        }
                    } catch (embedError) {
                        console.error('Error generating embedding for voice diary entry:', embedError);
                        // Continue without embedding - entry will still be saved
                    }

                    // Save to diary
                    await addMemory(
                        transcript,
                        'diary',
                        ['voice', 'log'],
                        'text',
                        undefined,
                        undefined,
                        undefined,
                        embedding
                    );

                    console.log('[VoiceDiary] Saved entry:', transcript);
                    setLastSavedEntry(transcript);
                    setTranscript('');
                    setShowSuccess(true);

                    // Call callback if provided
                    if (onDiaryAdded) {
                        onDiaryAdded();
                    }

                    // Hide success message after 3 seconds
                    setTimeout(() => {
                        setShowSuccess(false);
                    }, 3000);
                } catch (error) {
                    console.error('Failed to save diary entry:', error);
                    setError('Failed to save entry');
                } finally {
                    setIsSaving(false);
                }
            }
        }
    };

    // Status text logic
    let statusText = "HOLD TO RECORD";
    let statusColor = "text-slate-400";
    let ringColor = "border-slate-700";
    let glowColor = "shadow-none";

    if (isListening) {
        statusText = "RECORDING...";
        statusColor = "text-red-400";
        ringColor = "border-red-500";
        glowColor = "shadow-[0_0_50px_rgba(239,68,68,0.3)]";
    } else if (isSaving) {
        statusText = "SAVING...";
        statusColor = "text-violet-400";
        ringColor = "border-violet-500";
        glowColor = "shadow-[0_0_50px_rgba(139,92,246,0.3)]";
    } else if (showSuccess) {
        statusText = "SAVED!";
        statusColor = "text-emerald-400";
        ringColor = "border-emerald-500";
        glowColor = "shadow-[0_0_50px_rgba(16,185,129,0.3)]";
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-space-950">

            {/* Background Decor */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            </div>

            {/* Main Interface */}
            <div className="z-10 flex flex-col items-center gap-12 w-full max-w-md px-6">

                {/* Header / Status Display */}
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-widest">
                        <BookOpen size={14} className={isSaving ? "animate-pulse text-indigo-400" : ""} />
                        <span>Voice Diary Log</span>
                        {showSuccess && <span className="text-emerald-400">• LOGGED</span>}
                    </div>
                    <h2 className={`text-2xl font-bold tracking-wider transition-colors duration-300 ${statusColor}`}>
                        {statusText}
                    </h2>
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                </div>

                {/* The Big Button */}
                <div className="relative group">
                    {/* Outer Rings */}
                    <div className={`absolute inset-0 rounded-full border-2 ${ringColor} opacity-20 scale-150 transition-all duration-500 ${isListening || isSaving ? 'animate-ping-slow' : ''}`} />
                    <div className={`absolute inset-0 rounded-full border ${ringColor} opacity-40 scale-125 transition-all duration-300`} />

                    {/* Button Itself */}
                    <button
                        onMouseDown={startListening}
                        onMouseUp={stopListening}
                        onMouseLeave={stopListening}
                        onTouchStart={startListening}
                        onTouchEnd={stopListening}
                        disabled={isSaving}
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
                            {showSuccess ? (
                                <Check size={64} className="text-emerald-400" />
                            ) : isSaving ? (
                                <BookOpen size={64} className="text-violet-400 animate-pulse" />
                            ) : (
                                <Mic size={64} className={isListening ? "text-red-400" : "text-slate-400 group-hover:text-slate-200"} />
                            )}
                        </div>
                    </button>
                </div>

                {/* Transcript / Last Entry Area */}
                <div className="w-full min-h-[120px] max-h-[200px] p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm text-center flex items-center justify-center overflow-y-auto custom-scrollbar">
                    {transcript ? (
                        <p className="text-lg text-slate-200 font-medium animate-pulse">"{transcript}"</p>
                    ) : lastSavedEntry ? (
                        <p className={`text-base font-light ${showSuccess ? 'text-emerald-300' : 'text-slate-400'} transition-colors`}>
                            Last entry: "{lastSavedEntry}"
                        </p>
                    ) : (
                        <p className="text-sm text-slate-600 italic">Press and hold to record your thoughts...</p>
                    )}
                </div>

                {/* Controls Hint */}
                <div className="text-xs text-slate-600 font-mono text-center">
                    PRESS AND HOLD TO RECORD • RELEASE TO SAVE
                    <br />
                    <span className="text-[10px] text-slate-700 mt-1 block">Entries are saved to your diary with voice tags</span>
                </div>

            </div>

            {/* API Key Prompt */}
            <ApiKeyPrompt
                isOpen={showApiKeyPrompt}
                onClose={() => setShowApiKeyPrompt(false)}
                onNavigateToSettings={onNavigateToSettings}
                message="API key not configured. Entry will be saved without embedding. Add your API key in Settings for better search."
            />
        </div>
    );
};

export default VoiceDiaryMode;
