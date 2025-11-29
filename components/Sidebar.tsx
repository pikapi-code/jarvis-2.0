import React from 'react';
import { ViewMode } from '../types';
import { MessageSquare, Book, BrainCircuit, Folder, Settings, User, Command, Clock, Search, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, isCollapsed = false, onToggleCollapse }) => {
  const { theme, getThemeClasses } = useTheme();
  const { logout, username } = useAuth();
  const themeClasses = getThemeClasses();

  const mainItems: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'assistant', icon: <MessageSquare size={18} />, label: 'Assistant' },
    { id: 'history', icon: <Clock size={18} />, label: 'History' },
  ];

  const memoryItems: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'diary', icon: <Book size={18} />, label: 'Diary Log' },
    { id: 'memories', icon: <BrainCircuit size={18} />, label: 'Neural Bank' },
    { id: 'memory_search', icon: <Search size={18} />, label: 'Search DB' },
    { id: 'files', icon: <Folder size={18} />, label: 'Files' },
  ];

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

  const NavItem: React.FC<{ item: typeof mainItems[0] }> = ({ item }) => (
    <button
      onClick={() => onViewChange(item.id)}
      className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-all duration-300 group relative ${currentView === item.id
        ? 'bg-white/10 text-white'
        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      style={currentView === item.id ? { boxShadow: `0 0 15px ${getThemeGlowColor()}` } : {}}
      title={isCollapsed ? item.label : undefined}
    >
      {currentView === item.id && !isCollapsed && (
        <div 
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full ${themeClasses.activeIndicator}`}
        />
      )}
      <div className={`transition-colors ${currentView === item.id ? themeClasses.text : 'text-slate-500 group-hover:text-slate-300'}`}>
        {item.icon}
      </div>
      {!isCollapsed && (
        <span className="font-medium text-sm tracking-wide">{item.label}</span>
      )}
    </button>
  );

  // Collapsed view - icons only
  if (isCollapsed) {
    return (
      <div className="flex flex-col w-full h-full items-center">
        {/* Logo */}
        <div className="p-3 pb-4 border-b border-white/5 w-full flex justify-center">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div 
              className="absolute inset-0 rounded-lg blur-md" 
              style={{ backgroundColor: getThemeGlowColor() }}
            />
            <div className={`relative w-full h-full bg-gradient-to-br ${themeClasses.logoGradient} rounded-lg flex items-center justify-center text-white border border-white/10`}>
              <Command size={16} />
            </div>
          </div>
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 w-full px-2 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {mainItems.map(item => (
            <NavItem key={item.id} item={item} />
          ))}
          {memoryItems.map(item => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>

        {/* Bottom Actions - Collapsed */}
        <div className="w-full p-2 border-t border-white/5 space-y-2">
          <button
            onClick={() => onViewChange('settings')}
            className={`w-full flex items-center justify-center px-2 py-2 rounded-lg transition-colors ${currentView === 'settings' ? 'text-white bg-white/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <div className="flex justify-center">
            <div className={`w-8 h-8 rounded-full ${themeClasses.icon} flex items-center justify-center text-white shadow-lg`}>
              <User size={14} />
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-2 py-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center px-2 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              title="Expand Sidebar"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="flex flex-col w-full h-full">
      {/* Logo Area */}
      <div className="p-5 pb-6 flex items-center gap-3 border-b border-white/5">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div 
            className="absolute inset-0 rounded-lg blur-md" 
            style={{ backgroundColor: getThemeGlowColor() }}
          />
          <div className={`relative w-full h-full bg-gradient-to-br ${themeClasses.logoGradient} rounded-lg flex items-center justify-center text-white border border-white/10`}>
            <Command size={16} />
          </div>
        </div>
        <div className="flex-1">
          <div className="font-sans font-bold text-base text-white tracking-wide">JARVIS</div>
          <div className={`text-[10px] ${themeClasses.text} font-mono tracking-wider`}>OS V2.0</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">

        {/* Main Section */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Main</div>
          {mainItems.map(item => <NavItem key={item.id} item={item} />)}
        </div>

        {/* Memory Section */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Memory</div>
          {memoryItems.map(item => <NavItem key={item.id} item={item} />)}
        </div>

      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => onViewChange('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-4 ${currentView === 'settings' ? 'text-white bg-white/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
        >
          <Settings size={18} />
          <span className="font-medium text-sm">Settings</span>
        </button>

        <div className="glass-card p-3 rounded-xl flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full ${themeClasses.icon} flex items-center justify-center text-white shadow-lg`}>
            <User size={14} />
          </div>
          <div className="overflow-hidden flex-1">
            <div className="text-xs font-semibold text-slate-200">{username || 'Admin User'}</div>
            <div className={`text-[10px] ${themeClasses.text} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${themeClasses.text.replace('text-', 'bg-')} animate-pulse`} />
              Connected
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors mb-4"
        >
          <LogOut size={18} />
          <span className="font-medium text-sm">Logout</span>
        </button>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft size={18} />
            <span className="font-medium text-sm">Collapse Sidebar</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;