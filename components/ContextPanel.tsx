import React, { useEffect, useState } from 'react';
import { Memory } from '../types';
import { getAllMemories } from '../services/supabase-db';
import { Database, Clock, Sparkles, Activity, Layers, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ContextPanelProps {
  refreshTrigger: number;
  relatedMemories: Memory[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ContextPanel: React.FC<ContextPanelProps> = ({ refreshTrigger, relatedMemories, isCollapsed = false, onToggleCollapse }) => {
  const { theme } = useTheme();
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [isRecentCollapsed, setIsRecentCollapsed] = useState(false);
  const [isActiveRetrievalCollapsed, setIsActiveRetrievalCollapsed] = useState(false);

  useEffect(() => {
    if (!isCollapsed) {
      loadRecent();
    }
  }, [refreshTrigger, isCollapsed]);

  const loadRecent = async () => {
    const all = await getAllMemories();
    setRecentMemories(all.slice(0, 5));
  };

  // Get theme glow color for active indicator
  const getThemeGlowColor = () => {
    const colorMap: Record<string, string> = {
      indigo: 'rgba(99, 102, 241, 0.2)',
      cyan: 'rgba(6, 182, 212, 0.2)',
      emerald: 'rgba(16, 185, 129, 0.2)',
      rose: 'rgba(244, 63, 94, 0.2)',
      amber: 'rgba(245, 158, 11, 0.2)',
      violet: 'rgba(139, 92, 246, 0.2)',
    };
    return colorMap[theme.primary.split('-')[0]] || colorMap.indigo;
  };

  const MemoryNode = ({ mem, type = 'recent' }: { mem: Memory; type?: 'recent' | 'related' }) => (
    <div className={`p-4 rounded-xl mb-3 transition-all border group relative overflow-hidden ${
        type === 'related' 
            ? 'bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/20' 
            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
    }`}>
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

      <div className="flex justify-between items-start mb-2 relative z-10">
        <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
            type === 'related' 
              ? 'bg-violet-500/20 text-violet-300 border-violet-500/20' 
              : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
        }`}>
            {mem.category}
        </span>
        <span className="text-[10px] text-slate-600 font-mono">
            {new Date(mem.timestamp).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
        </span>
      </div>
      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed font-sans relative z-10">
        {mem.content}
      </p>
      {mem.tags.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap relative z-10">
              {mem.tags.slice(0, 3).map((t, i) => (
                  <span key={i} className="text-[9px] text-slate-500 flex items-center">
                    <span className="w-1 h-1 rounded-full bg-slate-600 mr-1" />
                    {t}
                  </span>
              ))}
          </div>
      )}
    </div>
  );

  // Collapsed view - icons only
  if (isCollapsed) {
    return (
      <div className="flex flex-col w-full h-full items-center">
        {/* Logo */}
        <button
          onClick={onToggleCollapse}
          className="p-3 pb-4 border-b border-white/5 w-full flex justify-center hover:bg-white/5 transition-colors cursor-pointer"
          title="Click to expand Context Panel"
        >
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div 
              className="absolute inset-0 rounded-lg blur-md" 
              style={{ backgroundColor: getThemeGlowColor() }}
            />
            <div className="relative w-full h-full bg-gradient-to-br from-violet-600 to-indigo-800 rounded-lg flex items-center justify-center text-white border border-white/10">
              <Database size={16} />
            </div>
            {relatedMemories.length > 0 && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-violet-neon animate-pulse shadow-[0_0_8px_#6E4FFF]" />
            )}
          </div>
        </button>

        {/* Section Icons */}
        <nav className="flex-1 w-full px-2 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center px-2 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-colors cursor-pointer"
              title={`Active Retrieval (${relatedMemories.length} memories) - Click to expand`}
            >
              <Sparkles size={18} className={relatedMemories.length > 0 ? "text-violet-400" : "text-slate-500"} />
            </button>
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Recent Nodes - Click to expand"
            >
              <Clock size={18} className="text-slate-400" />
            </button>
          </div>
        </nav>

        {/* Bottom Actions - Collapsed */}
        <div className="w-full p-2 border-t border-white/5 space-y-2">
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 shadow-lg">
              <Activity size={14} className="animate-pulse" />
            </div>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center px-2 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              title="Expand Context Panel"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col w-full">
      {/* Header */}
      <div className="p-5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-1">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">System Context</h3>
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-emerald-500 animate-pulse" />
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="p-1 rounded hover:bg-white/10 transition-colors group"
                  title="Collapse Context Panel"
                >
                  <ChevronRight size={14} className="text-slate-500 group-hover:text-violet-400 transition-colors" />
                </button>
              )}
            </div>
        </div>
        <div className="flex items-center gap-2 text-violet-300">
            <Database size={16} />
            <span className="text-sm font-semibold tracking-wide">Neural Bank</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        
        {/* Related Section */}
        <div className="mb-8">
             <button
                onClick={() => setIsActiveRetrievalCollapsed(prev => !prev)}
                className="flex items-center gap-2 text-slate-400 mb-4 px-1 w-full hover:text-slate-300 transition-colors group"
            >
                <Sparkles size={14} />
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">Active Retrieval</span>
                <div className="ml-auto">
                    {isActiveRetrievalCollapsed ? (
                        <ChevronDown size={14} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
                    ) : (
                        <ChevronUp size={14} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
                    )}
                </div>
            </button>
            
            {!isActiveRetrievalCollapsed && (
                <>
                    {relatedMemories.length > 0 ? (
                        relatedMemories.map(mem => <MemoryNode key={`rel-${mem.id}`} mem={mem} type="recent" />)
                    ) : (
                        <div className="text-center py-4 text-slate-600 text-xs">
                            No memories retrieved yet.
                        </div>
                    )}
                </>
            )}
        </div>

        {/* Recent Section */}
        <div>
             <button
                onClick={() => setIsRecentCollapsed(prev => !prev)}
                className="flex items-center gap-2 text-slate-400 mb-4 px-1 w-full hover:text-slate-300 transition-colors group"
            >
                <Clock size={14} />
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">Recent Nodes</span>
                <div className="ml-auto">
                    {isRecentCollapsed ? (
                        <ChevronDown size={14} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
                    ) : (
                        <ChevronUp size={14} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
                    )}
                </div>
            </button>
            {!isRecentCollapsed && (
                <>
                    {recentMemories.length === 0 ? (
                        <div className="text-center py-4 text-slate-600 text-xs">
                            Memory banks empty.
                        </div>
                    ) : (
                        recentMemories.map(mem => <MemoryNode key={`rec-${mem.id}`} mem={mem} />)
                    )}
                </>
            )}
        </div>
      </div>
      
      {/* Footer Stats - Only show when there's content in Active Retrieval */}
      {relatedMemories.length > 0 && (
        <div className="p-3 border-t border-white/5 bg-white/[0.02] text-[10px] font-mono text-slate-600 flex justify-between">
            <span>RAM: NOMINAL</span>
            <span>DB: CONNECTED</span>
        </div>
      )}

      {/* Collapse Button */}
      {onToggleCollapse && (
        <div className="p-4 border-t border-white/5">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            title="Collapse Context Panel"
          >
            <ChevronRight size={18} />
            <span className="font-medium text-sm">Collapse Panel</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ContextPanel;