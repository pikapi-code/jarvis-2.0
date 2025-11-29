import React, { useEffect, useState, useRef } from 'react';
import { getAllMemories, deleteMemory, addMemory } from '../../services/db';
import { Memory, MemoryType } from '../../types';
import { FileText, Image as ImageIcon, Mic, Download, Folder, Upload, Trash2, X } from 'lucide-react';
import { JarvisService } from '../../services/gemini';

interface FilesViewProps {
    service: JarvisService;
    onMemoryUpdate: () => void;
}

const FilesView: React.FC<FilesViewProps> = ({ service, onMemoryUpdate }) => {
    const [files, setFiles] = useState<Memory[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

        setIsUploading(true);

        try {
            for (const file of Array.from(selectedFiles)) {
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

                // Create content description for embedding
                const content = `File: ${file.name} (${file.type})`;

                // Get embedding
                const embedding = await service.getEmbedding(content);

                // Save to database
                await addMemory(
                    content,
                    'files',
                    ['uploaded'],
                    memoryType,
                    base64Data,
                    file.type,
                    file.name,
                    embedding
                );
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

    const handleDeleteFile = async (id: number, fileName: string) => {
        if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
            try {
                await deleteMemory(id);
                await loadFiles();
                onMemoryUpdate();
            } catch (error) {
                console.error('Failed to delete file:', error);
                alert('Failed to delete file. Please try again.');
            }
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
                        className="ml-auto flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Upload size={20} />
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
        </div>
    );
};

export default FilesView;