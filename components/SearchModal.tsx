import React, { useState, useEffect, useRef } from 'react';
import { searchMemories, vectorSearchMemories } from '../services/db';
import { Memory } from '../types';
import { Search, X, Loader, Hash, Database, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { JarvisService } from '../services/gemini';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: JarvisService;
  onSelectMemory?: (memory: Memory) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, service, onSelectMemory }) => {
  const { theme, getThemeClasses } = useTheme();
  const themeClasses = getThemeClasses();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Memory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get theme color for glows
  const getThemeColor = (opacity: number = 1) => {
    const colorMap: Record<string, string> = {
      indigo: `rgba(99, 102, 241, ${opacity})`,
      cyan: `rgba(6, 182, 212, ${opacity})`,
      emerald: `rgba(16, 185, 129, ${opacity})`,
      rose: `rgba(244, 63, 94, ${opacity})`,
      amber: `rgba(245, 158, 11, ${opacity})`,
      blue: `rgba(59, 130, 246, ${opacity})`,
      teal: `rgba(20, 184, 166, ${opacity})`,
      purple: `rgba(168, 85, 247, ${opacity})`,
      fuchsia: `rgba(217, 70, 239, ${opacity})`,
      lime: `rgba(132, 204, 22, ${opacity})`,
      yellow: `rgba(234, 179, 8, ${opacity})`,
      red: `rgba(239, 68, 68, ${opacity})`,
      slate: `rgba(100, 116, 139, ${opacity})`,
    };
    return colorMap[theme.primary.split('-')[0]] || colorMap.indigo;
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        // Perform both keyword and vector search
        const keywordResults = await searchMemories(query);
        
        // Vector search for semantic similarity
        let vectorResults: Memory[] = [];
        try {
          const embedding = await service.getEmbedding(query);
          vectorResults = await vectorSearchMemories(embedding);
        } catch (err) {
          console.warn('Vector search failed, using keyword only:', err);
        }

        // Combine and deduplicate results
        const combined = [...vectorResults];
        for (const mem of keywordResults) {
          if (!combined.find(m => m.id === mem.id)) {
            combined.push(mem);
          }
        }

        // Limit to top 10 results
        setResults(combined.slice(0, 10));
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, service]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div 
        className="relative w-full max-w-2xl glass-panel rounded-2xl border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: `0 20px 60px ${getThemeColor(0.2)}` }}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-11 pr-10 py-3 bg-space-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <kbd className="px-2 py-1 bg-space-900 rounded border border-white/10">⌘K</kbd>
            <span>or</span>
            <kbd className="px-2 py-1 bg-space-900 rounded border border-white/10">Ctrl+K</kbd>
            <span>to open</span>
            <span className="mx-1">•</span>
            <kbd className="px-2 py-1 bg-space-900 rounded border border-white/10">Esc</kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={24} className="animate-spin text-violet-400" />
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto text-slate-600 mb-4 opacity-50" />
              <p className="text-slate-400">No memories found</p>
              <p className="text-xs text-slate-500 mt-2">Try different keywords</p>
            </div>
          ) : results.length > 0 ? (
            <div className="p-4 space-y-2">
              {results.map((memory) => (
                <div
                  key={memory.id}
                  onClick={() => {
                    if (onSelectMemory) {
                      onSelectMemory(memory);
                    }
                    onClose();
                  }}
                  className="glass-card p-4 rounded-xl hover:bg-white/10 transition-all cursor-pointer group border border-white/5 hover:border-white/20"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${themeClasses.badge} flex-shrink-0`}>
                      {memory.type === 'text' ? (
                        <Database size={16} />
                      ) : memory.type === 'image' ? (
                        <Hash size={16} />
                      ) : (
                        <Hash size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${themeClasses.text}`}>
                          {memory.category}
                        </span>
                        {memory.tags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {memory.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-slate-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 line-clamp-2 group-hover:text-white transition-colors">
                        {memory.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <Clock size={12} />
                        <span>{new Date(memory.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto text-slate-600 mb-4 opacity-50" />
              <p className="text-slate-400">Start typing to search memories</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;

