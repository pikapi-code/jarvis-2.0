import React, { useEffect, useState, useRef } from 'react';
import { getAllMemories, deleteMemory, addMemory } from '../../services/supabase-db';
import { Memory, MemoryType } from '../../types';
import { FileText, Image as ImageIcon, Mic, Download, Folder, Upload, Trash2, X } from 'lucide-react';
import { JarvisService } from '../../services/gemini';
import { extractAndChunkFile } from '../../services/fileExtraction';
import { hasApiKey } from '../../services/api-client';
import ApiKeyPrompt from '../ApiKeyPrompt';
import Notification, { NotificationType } from '../Notification';
import ConfirmModal from '../ConfirmModal';

interface FilesViewProps {
    service: JarvisService;
    onMemoryUpdate: () => void;
    onNavigateToSettings?: () => void;
}

const FilesView: React.FC<FilesViewProps> = ({ service, onMemoryUpdate, onNavigateToSettings }) => {
    const [files, setFiles] = useState<Memory[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        id: number | null;
        fileName: string;
    }>({
        isOpen: false,
        id: null,
        fileName: ''
    });

    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        const all = await getAllMemories();
        setFiles(all.filter(m => m.type !== 'text'));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'image': return <ImageIcon size={24} className="text-purple-400" />;
            case 'audio': return <Mic size={24} className="text-red-400" />;
            default: return <FileText size={24} className="text-blue-400" />;
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        // Check for API key before processing files
        const userHasApiKey = await hasApiKey();
        if (!userHasApiKey) {
            setShowApiKeyPrompt(true);
            // Reset file input and return early - don't save files without API key
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        setIsUploading(true);

        try {
            for (const file of Array.from(selectedFiles) as File[]) {
                // Read file as base64
                const base64Data = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.readAsDataURL(file);
                });

                // Determine file type
                let memoryType: MemoryType = 'file';
                if (file.type.startsWith('image/')) {
                    memoryType = 'image';
                } else if (file.type.startsWith('audio/')) {
                    memoryType = 'audio';
                }

                // Save the file itself as a memory entry so it appears in the Files tab
                // This is separate from the text chunks that will be extracted
                let fileEmbedding: number[] | undefined;
                try {
                    const fileDescription = `File: ${file.name} (${file.type})`;
                    fileEmbedding = await service.getEmbedding(fileDescription);
                } catch (error) {
                    console.warn(`Failed to generate embedding for file ${file.name}:`, error);
                }

                await addMemory(
                    `Uploaded file: ${file.name}`,
                    'general',
                    ['uploaded', 'file', memoryType],
                    memoryType,
                    base64Data,
                    file.type,
                    file.name,
                    fileEmbedding
                );

                // Extract and chunk file content
                let extractedContent = null;
                try {
                    console.log(`[File Upload] Attempting to extract content from ${file.name} (${file.type})...`);
                    extractedContent = await extractAndChunkFile(file, base64Data);
                    if (extractedContent && extractedContent.text) {
                        console.log(`✅ Extracted ${extractedContent.text.length} characters from ${file.name}`);
                        console.log(`✅ Split into ${extractedContent.chunks.length} chunks`);
                    } else {
                        console.log(`ℹ️ No text content extracted from ${file.name} (may be binary file or unsupported format)`);
                    }
                } catch (extractError: any) {
                    console.error(`❌ Error extracting text content from ${file.name}:`, extractError);
                    console.error(`Error details:`, {
                        message: extractError?.message,
                        stack: extractError?.stack,
                        name: extractError?.name
                    });
                    // Skip this file if we can't extract content
                    continue;
                }

                // Verify API key is still available before processing
                const stillHasApiKey = await hasApiKey();
                if (!stillHasApiKey) {
                    console.warn(`⚠️ API key no longer available, skipping file: ${file.name}`);
                    setShowApiKeyPrompt(true);
                    continue;
                }

                // If we extracted content, process and save each chunk with LLM summarization
                if (extractedContent && extractedContent.chunks.length > 0) {
                    console.log(`Processing ${extractedContent.chunks.length} content chunks for ${file.name} with LLM...`);

                    for (let i = 0; i < extractedContent.chunks.length; i++) {
                        const chunk = extractedContent.chunks[i];

                        // Process chunk with LLM for summarization, categorization, and tagging
                        let processedChunk: { summary: string; category: string; tags: string[] };
                        try {
                            processedChunk = await service.processChunk(
                                chunk,
                                file.name,
                                i,
                                extractedContent.chunks.length
                            );
                            console.log(`✅ Chunk ${i + 1}/${extractedContent.chunks.length} processed: category="${processedChunk.category}", summary: "${processedChunk.summary.substring(0, 100)}..."`);
                        } catch (error: any) {
                            console.error(`Error processing chunk ${i + 1} of ${file.name}:`, error);
                            // If processing fails due to API key issues, skip this file
                            if (error.message?.includes('API key') || error.message?.includes('No API key')) {
                                console.warn(`⚠️ API key issue detected, skipping remaining chunks for ${file.name}`);
                                setShowApiKeyPrompt(true);
                                break;
                            }
                            // Fallback to original chunk if processing fails for other reasons
                            processedChunk = {
                                summary: chunk,
                                category: 'general',
                                tags: ['uploaded', 'file-content', `chunk-${i + 1}`]
                            };
                        }

                        // Create content with file reference - save FULL chunk content, not just summary
                        // Include summary as metadata at the beginning, but preserve all original data
                        const chunkContent = `From "${file.name}" (section ${i + 1}/${extractedContent.chunks.length}):\n\nSummary: ${processedChunk.summary}\n\n--- Full Content ---\n\n${chunk}`;

                        // Combine LLM-generated tags with file metadata tags
                        const tags = [
                            'uploaded',
                            'file-content',
                            ...processedChunk.tags.filter(t => t !== 'uploaded' && t !== 'file-content')
                        ];

                        let chunkEmbedding: number[] | undefined;
                        try {
                            // Generate embedding from the full chunk content for better searchability
                            chunkEmbedding = await service.getEmbedding(chunk);
                            if (!chunkEmbedding || chunkEmbedding.length === 0) {
                                console.warn(`Failed to generate embedding for chunk ${i + 1} of ${file.name}`);
                                // If embedding fails due to API key issues, skip this file
                                throw new Error('Embedding generation failed');
                            }
                        } catch (error: any) {
                            console.error(`Error generating embedding for chunk ${i + 1} of ${file.name}:`, error);
                            // If embedding fails due to API key issues, skip this file
                            if (error.message?.includes('API key') || error.message?.includes('No API key')) {
                                console.warn(`⚠️ API key issue detected, skipping remaining chunks for ${file.name}`);
                                setShowApiKeyPrompt(true);
                                break;
                            }
                            // For other errors, skip this chunk but continue with others
                            console.warn(`Skipping chunk ${i + 1} due to embedding error`);
                            continue;
                        }

                        // Save processed chunk as a memory entry with the determined category
                        await addMemory(
                            chunkContent,
                            processedChunk.category, // Use the category determined from content analysis
                            tags,
                            'text',
                            undefined, // Don't store the chunk text as media data
                            undefined,
                            `${file.name} (section ${i + 1})`,
                            chunkEmbedding
                        );
                    }

                    console.log(`✅ Successfully processed and saved ${extractedContent.chunks.length} content chunks for ${file.name}`);
                } else {
                    console.log(`ℹ️ No text content extracted from ${file.name} (may be binary file or unsupported format)`);
                }
            }

            // Refresh files list
            await loadFiles();
            onMemoryUpdate();
        } catch (error) {
            console.error('Failed to upload file:', error);
            alert('Failed to upload file. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteFile = (id: number, fileName: string) => {
        setConfirmModal({ isOpen: true, id, fileName });
    };

    const confirmDelete = async () => {
        if (confirmModal.id === null) return;
        
        try {
            await deleteMemory(confirmModal.id);
            await loadFiles();
            onMemoryUpdate();
            setNotification({ message: 'File deleted successfully', type: 'success' });
        } catch (error) {
            console.error('Failed to delete file:', error);
            setNotification({ message: 'Failed to delete file', type: 'error' });
        } finally {
            setConfirmModal({ isOpen: false, id: null, fileName: '' });
        }
    };

    return (
        <div className="flex flex-col h-full p-6 md:p-10 overflow-y-auto custom-scrollbar relative">
            <div className="flex items-center justify-center mb-10">
                <div className="flex items-center gap-4 max-w-4xl w-full">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                            <Folder size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Data Archive</h1>
                            <p className="text-slate-400 text-sm mt-1">Stored files, images, and audio logs.</p>
                        </div>
                    </div>

                    {/* Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Upload size={16} />
                        <span className="hidden md:inline">{isUploading ? 'Uploading...' : 'Upload Files'}</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-4xl mx-auto">
                {files.map(file => (
                    <div key={file.id} className="glass-card rounded-xl p-4 flex flex-col items-center text-center hover:bg-white/10 transition-all group relative hover:-translate-y-1">
                        <div className="w-full aspect-square bg-space-950 rounded-lg flex items-center justify-center mb-3 overflow-hidden border border-white/5">
                            {file.type === 'image' && file.mediaData ? (
                                <img src={`data:${file.mediaMimeType};base64,${file.mediaData}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="file" />
                            ) : (
                                getIcon(file.type)
                            )}
                        </div>
                        <div className="w-full">
                            <p className="text-xs font-medium text-slate-200 truncate w-full">{file.mediaName || 'Untitled'}</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono">{new Date(file.timestamp).toLocaleDateString()}</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {file.mediaData && (
                                <a
                                    href={`data:${file.mediaMimeType};base64,${file.mediaData}`}
                                    download={file.mediaName || 'download'}
                                    className="p-2 bg-black/50 backdrop-blur rounded-full text-white hover:bg-violet-600 transition-all shadow-lg"
                                    title="Download"
                                >
                                    <Download size={14} />
                                </a>
                            )}
                            <button
                                onClick={() => handleDeleteFile(file.id, file.mediaName || 'file')}
                                className="p-2 bg-black/50 backdrop-blur rounded-full text-white hover:bg-red-600 transition-all shadow-lg"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {files.length === 0 && (
                    <div className="col-span-full py-10 text-center border border-dashed border-white/10 rounded-2xl">
                        <p className="text-slate-500">No files archived. Click "Upload Files" to add files.</p>
                    </div>
                )}
            </div>

            {/* API Key Prompt */}
            <ApiKeyPrompt
                isOpen={showApiKeyPrompt}
                onClose={() => setShowApiKeyPrompt(false)}
                onNavigateToSettings={onNavigateToSettings}
                message="API key not configured. Files will be saved without embeddings and processing. Add your API key in Settings."
            />

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
                title="Delete File"
                message={`Are you sure you want to delete "${confirmModal.fileName}"?`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmModal({ isOpen: false, id: null, fileName: '' })}
                type="danger"
            />
        </div>
    );
};

export default FilesView;