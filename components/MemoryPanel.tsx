import React, { useEffect, useState } from 'react';
import { Memory } from '../types';
import { getAllMemories, deleteMemory } from '../services/db';
import { Trash2, Database, Search, Hash } from 'lucide-react';

interface MemoryPanelProps {
  isOpen: boolean;
  refreshTrigger: number; // Increment to reload
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({ isOpen, refreshTrigger }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadMemories();
  }, [refreshTrigger, isOpen]);

  const loadMemories = async () => {
    try {
      const data = await getAllMemories();
      setMemories(data);
    } catch (e) {
      console.error("Failed to load memories", e);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteMemory(id);
    loadMemories();
  };

  const filteredMemories = memories.filter(m => 
    m.content.toLowerCase().includes(filter.toLowerCase()) || 
    m.category.toLowerCase().includes(filter.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-80 md:w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700 shadow-2xl z-50 flex flex-col transition-all duration-300">
      <div className="p-4 border-b border-slate-700 flex items-center gap-2 bg-slate-950/50">
        <Database className="text-cyan-400" size={20} />
        <h2 className="text-lg font-mono font-semibold text-slate-100">Neural Bank</h2>
        <span className="text-xs ml-auto bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
            {memories.length} records
        </span>
      </div>

      <div className="p-4 bg-slate-900 border-b border-slate-800">
         <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
            <input 
              type="text" 
              placeholder="Search memories..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-600"
            />
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMemories.length === 0 ? (
          <div className="text-center text-slate-600 py-10">
            <p className="text-sm">No memories found.</p>
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <div key={mem.id} className="group bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 hover:border-cyan-500/30 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-mono text-cyan-500 uppercase tracking-wider bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900/50">
                    {mem.category}
                </span>
                <button 
                    onClick={() => handleDelete(mem.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                    <Trash2 size={14} />
                </button>
              </div>
              <p className="text-sm text-slate-300 mb-3 leading-relaxed">{mem.content}</p>
              
              {mem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                      {mem.tags.map((tag, i) => (
                          <div key={i} className="flex items-center text-[10px] text-slate-500">
                             <Hash size={10} className="mr-0.5" />
                             {tag}
                          </div>
                      ))}
                  </div>
              )}
              
              <div className="mt-2 text-[10px] text-slate-600 text-right">
                {new Date(mem.timestamp).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MemoryPanel;
