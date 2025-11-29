import React, { useEffect, useState } from 'react';
import { getAllMemories, deleteMemory } from '../../services/db';
import { Memory } from '../../types';
import { Search, Trash2, Hash, BrainCircuit } from 'lucide-react';

const MemoriesView: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    const data = await getAllMemories();
    setMemories(data);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this memory permanently?')) {
        await deleteMemory(id);
        loadMemories();
    }
  };

  const filtered = memories.filter(m => 
    m.content.toLowerCase().includes(filter.toLowerCase()) || 
    m.category.toLowerCase().includes(filter.toLowerCase()) ||
    m.tags.some(t => t.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full p-6 md:p-8 overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <BrainCircuit size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Neural Bank</h1>
                <p className="text-slate-400 text-sm">{memories.length} active memory nodes</p>
            </div>
        </div>
        <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-3.5 text-slate-500 group-hover:text-violet-400 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search by keywords, tags..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
            />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start pb-10">
        {filtered.map(mem => (
            <div key={mem.id} className="group relative glass-card rounded-xl p-5 transition-all hover:bg-white/10 flex flex-col hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-violet-300 bg-violet-500/10 px-2 py-1 rounded border border-violet-500/20">
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
    </div>
  );
};

export default MemoriesView;