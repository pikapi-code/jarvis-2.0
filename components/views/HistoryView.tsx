import React, { useEffect, useState } from 'react';
import { getConversations, deleteConversation } from '../../services/supabase-db';
import { Conversation } from '../../types';
import Notification, { NotificationType } from '../Notification';
import ConfirmModal from '../ConfirmModal';
import { MessageSquare, Trash2, Clock, ArrowRight } from 'lucide-react';

interface HistoryViewProps {
    onSelectConversation: (id: string) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onSelectConversation }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        conversationId: string | null;
    }>({
        isOpen: false,
        conversationId: null
    });

    const loadConversations = async () => {
        try {
            const data = await getConversations();
            setConversations(data);
        } catch (error) {
            console.error("Failed to load history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConversations();
    }, []);

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            conversationId: id
        });
    };

    const confirmDelete = async () => {
        if (!confirmModal.conversationId) return;
        
        try {
            await deleteConversation(confirmModal.conversationId);
            loadConversations();
            setNotification({ message: 'Conversation deleted successfully.', type: 'success' });
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            setNotification({ message: 'Failed to delete conversation.', type: 'error' });
        } finally {
            setConfirmModal({ isOpen: false, conversationId: null });
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading history...</div>;
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Conversation History</h1>
                        <p className="text-slate-400">Review past interactions and memories</p>
                    </div>
                </div>

                {conversations.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/5">
                        <MessageSquare size={48} className="mx-auto text-slate-600 mb-4" />
                        <p className="text-slate-400">No conversations saved yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {conversations.map((conv) => (
                            <div
                                key={conv.id}
                                onClick={() => onSelectConversation(conv.id)}
                                className="group relative p-5 bg-space-900/50 hover:bg-space-800/80 border border-white/5 hover:border-violet-500/30 rounded-xl transition-all cursor-pointer"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-slate-200 truncate pr-8">
                                            {conv.title || "Untitled Conversation"}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                            <span>{new Date(conv.timestamp).toLocaleString()}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600" />
                                            <span>{conv.messages.length} messages</span>
                                        </p>
                                        <p className="text-sm text-slate-400 mt-3 line-clamp-2">
                                            {conv.messages.find(m => m.role === 'user')?.text || "No preview available"}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleDelete(e, conv.id)}
                                            className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                                            title="Delete conversation"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <div className="p-2 text-violet-400">
                                            <ArrowRight size={16} />
                                        </div>
                                    </div>
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
                title="Delete Conversation"
                message="Are you sure you want to delete this conversation? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmModal({ isOpen: false, conversationId: null })}
                type="danger"
            />
        </div>
    );
};

export default HistoryView;
