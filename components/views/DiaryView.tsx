import React, { useEffect, useState } from 'react';
import { getAllMemories, deleteMemory, addMemory } from '../../services/db';
import { Memory } from '../../types';
import { Calendar, Clock, Plus, Trash2, X } from 'lucide-react';
import { JarvisService } from '../../services/gemini';

interface DiaryViewProps {
    service: JarvisService;
    onMemoryUpdate: () => void;
}

const DiaryView: React.FC<DiaryViewProps> = ({ service, onMemoryUpdate }) => {
    const [entries, setEntries] = useState<Record<string, Memory[]>>({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [newLogText, setNewLogText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadDiary();
    }, []);

    const loadDiary = async () => {
        const all = await getAllMemories();
        const diaryEntries = all.filter(m => m.category.toLowerCase() === 'diary' || m.category === 'personal');

        const grouped: Record<string, Memory[]> = {};
        diaryEntries.forEach(entry => {
            const dateKey = new Date(entry.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(entry);
        });
        setEntries(grouped);
    };

    const handleAddLog = async () => {
        if (!newLogText.trim()) return;

        setIsSaving(true);
        try {
            const embedding = await service.getEmbedding(newLogText);
            await addMemory(
                newLogText,
                'diary',
                ['manual'],
                'text',
                undefined,
                undefined,
                undefined,
                embedding
            );

            setNewLogText('');
            setShowAddModal(false);
            onMemoryUpdate();
            loadDiary();
        } catch (error) {
            console.error('Failed to save log:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteLog = async (id: number) => {
        if (confirm('Are you sure you want to delete this log entry?')) {
            try {
                await deleteMemory(id);
                onMemoryUpdate();
                loadDiary();
            } catch (error) {
                console.error('Failed to delete log:', error);
            }
        }
    };

    return (
        <div className="flex flex-col h-full p-6 md:p-10 overflow-y-auto custom-scrollbar relative">
            <div className="flex items-center justify-center mb-10">
                <div className="flex items-center gap-4 max-w-4xl w-full">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                            <Calendar size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Personal Logs</h1>
                            <p className="text-slate-400 text-sm mt-1">Timeline of events, thoughts, and logs.</p>
                        </div>
                    </div>

                    {/* Add Log Button */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="ml-auto flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-200 font-medium"
                    >
                        <Plus size={20} />
                        <span className="hidden md:inline">Add Log</span>
                    </button>
                </div>
            </div>

            <div className="space-y-12 max-w-4xl mx-auto">
                {Object.keys(entries).length === 0 ? (
                    <div className="glass-panel p-8 rounded-xl text-center">
                        <p className="text-slate-400">No entries found. Click "Add Log" to start logging.</p>
                    </div>
                ) : (
                    Object.entries(entries).map(([date, items]) => (
                        <div key={date} className="relative pl-8 md:pl-10 border-l border-white/10">
                            <div className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_10px_#8B5CF6]" />
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                {date}
                            </h2>
                            <div className="space-y-4">
                                {items.map(item => (
                                    <div key={item.id} className="glass-card p-5 rounded-xl transition-all hover:bg-white/10 group relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-xs text-violet-400 font-mono opacity-80">
                                                <Clock size={12} />
                                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteLog(item.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                                                title="Delete entry"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap font-light text-base">{item.content}</p>
                                        {item.tags.length > 0 && (
                                            <div className="mt-4 flex gap-2">
                                                {item.tags.map(t => (
                                                    <span key={t} className="text-[10px] bg-white/5 border border-white/5 text-slate-400 px-2.5 py-1 rounded-full">#{t}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Log Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-space-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-white/10">
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <h2 className="text-xl font-bold text-white">Add New Log Entry</h2>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={newLogText}
                                onChange={(e) => setNewLogText(e.target.value)}
                                placeholder="Write your log entry here..."
                                className="w-full h-48 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddLog}
                                disabled={!newLogText.trim() || isSaving}
                                className="px-6 py-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSaving ? 'Saving...' : 'Save Log'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiaryView;