import React, { useState } from 'react';
import { searchMemories, deleteMemory } from '../../services/supabase-db';
import { Memory } from '../../types';
import { Search, Trash2, Hash, Database, Loader } from 'lucide-react';
import Notification, { NotificationType } from '../Notification';
import ConfirmModal from '../ConfirmModal';

const MemorySearchView: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Memory[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        id: number | null;
    }>({
        isOpen: false,
        id: null
    });

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const data = await searchMemories(query);
            setResults(data);
            setHasSearched(true);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleDelete = (id: number) => {
        setConfirmModal({ isOpen: true, id });
    };

    const confirmDelete = async () => {
        if (confirmModal.id === null) return;
        
        try {
            await deleteMemory(confirmModal.id);
            // Refresh results
            handleSearch();
            setNotification({ message: 'Memory node deleted successfully', type: 'success' });
        } catch (error) {
            console.error('Failed to delete memory:', error);
            setNotification({ message: 'Failed to delete memory node', type: 'error' });
        } finally {
            setConfirmModal({ isOpen: false, id: null });
        }
    };

    return (
        <div className="flex flex-col h-full p-6 md:p-8 overflow-hidden">
            <div className="flex flex-col gap-6 mb-8 items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Deep Memory Search</h1>
                        <p className="text-slate-400 text-sm">Query the neural database directly</p>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="relative w-full max-w-2xl mx-auto group">
                    <Search className="absolute left-3 top-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Enter keywords to search memories (e.g., 'mangoes', 'work', 'project')..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
                    />
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="absolute right-2 top-2 p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                    >
                        {isSearching ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {hasSearched && results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Search size={48} className="mb-4 opacity-20" />
                        <p>No memories found matching "{query}"</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start pb-10 max-w-6xl mx-auto">
                        {results.map(mem => (
                            <div key={mem.id} className="group relative glass-card rounded-xl p-5 transition-all hover:bg-white/10 flex flex-col hover:-translate-y-1 hover:shadow-xl border border-white/5 hover:border-cyan-500/30">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
                                        {mem.category}
                                    </span>
                                    <button
                                        onClick={() => handleDelete(mem.id)}
                                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <p className="text-sm text-slate-300 leading-relaxed mb-6 flex-1 font-light">
                                    {mem.content}
                                </p>

                                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-end">
                                    <div className="flex flex-wrap gap-1.5">
                                        {mem.tags.map((tag, i) => (
                                            <div key={i} className="flex items-center text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                <Hash size={10} className="mr-0.5 opacity-50" />
                                                {tag}
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-slate-600 font-mono">
                                        {new Date(mem.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Notification */}
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title="Delete Memory"
                message="Delete this memory permanently?"
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmModal({ isOpen: false, id: null })}
                type="danger"
            />
        </div>
    );
};

export default MemorySearchView;
