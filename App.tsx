import React, { useState } from 'react';
import { JarvisService } from './services/gemini';
import Sidebar from './components/Sidebar';
import ContextPanel from './components/ContextPanel';
import AssistantView from './components/views/AssistantView';
import DiaryView from './components/views/DiaryView';
import MemoriesView from './components/views/MemoriesView';
import FilesView from './components/views/FilesView';
import HistoryView from './components/views/HistoryView';
import MemorySearchView from './components/views/MemorySearchView';
import SettingsView from './components/views/SettingsView';
import LoginPage from './components/LoginPage';
import { ViewMode, Memory } from './types';
import { Menu, X } from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';

// Initialize service outside
const jarvis = new JarvisService();

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { theme, getThemeClasses } = useTheme();
  const themeClasses = getThemeClasses();
  const [currentView, setCurrentView] = useState<ViewMode>('assistant');
  const [memoryRefreshTrigger, setMemoryRefreshTrigger] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [relatedMemories, setRelatedMemories] = useState<Memory[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Get theme color values for ambient glows and selection (using CSS color values)
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

  const getThemeGlowColor = () => getThemeColor(0.1);
  const getThemeGlowColorSecondary = () => {
    const colorMap: Record<string, string> = {
      indigo: 'rgba(147, 51, 234, 0.05)',
      cyan: 'rgba(37, 99, 235, 0.05)',
      emerald: 'rgba(22, 163, 74, 0.05)',
      rose: 'rgba(219, 39, 119, 0.05)',
      amber: 'rgba(234, 88, 12, 0.05)',
      blue: 'rgba(99, 102, 241, 0.05)',
      teal: 'rgba(6, 182, 212, 0.05)',
      purple: 'rgba(99, 102, 241, 0.05)',
      fuchsia: 'rgba(219, 39, 119, 0.05)',
      lime: 'rgba(22, 163, 74, 0.05)',
      yellow: 'rgba(245, 158, 11, 0.05)',
      red: 'rgba(244, 63, 94, 0.05)',
      slate: 'rgba(71, 85, 105, 0.05)',
    };
    return colorMap[theme.secondary.split('-')[0]] || colorMap.indigo;
  };

  const getThemeTextColor = () => {
    const colorMap: Record<string, string> = {
      indigo: 'rgb(196, 181, 253)',
      cyan: 'rgb(103, 232, 249)',
      emerald: 'rgb(110, 231, 183)',
      rose: 'rgb(251, 146, 165)',
      amber: 'rgb(251, 191, 36)',
      blue: 'rgb(147, 197, 253)',
      teal: 'rgb(94, 234, 212)',
      purple: 'rgb(196, 181, 253)',
      fuchsia: 'rgb(240, 171, 252)',
      lime: 'rgb(190, 242, 100)',
      yellow: 'rgb(254, 240, 138)',
      red: 'rgb(252, 165, 165)',
      slate: 'rgb(203, 213, 225)',
    };
    return colorMap[theme.primary.split('-')[0]] || colorMap.indigo;
  };

  // Callback when memory is updated in any view
  const handleMemoryUpdate = () => {
    setMemoryRefreshTrigger(prev => prev + 1);
  };

  const renderContent = () => {
    return (
      <>
        <div className={currentView === 'assistant' ? 'h-full' : 'hidden h-full'}>
          <AssistantView
            service={jarvis}
            onMemoryUpdate={handleMemoryUpdate}
            onContextUpdate={setRelatedMemories}
            soundEnabled={soundEnabled}
            onSoundToggle={() => setSoundEnabled(prev => !prev)}
            conversationId={activeConversationId}
            onConversationChange={setActiveConversationId}
          />
        </div>
        {currentView === 'diary' && <DiaryView service={jarvis} onMemoryUpdate={handleMemoryUpdate} />}
        {currentView === 'memories' && <MemoriesView />}
        {currentView === 'files' && <FilesView service={jarvis} onMemoryUpdate={handleMemoryUpdate} />}
        {currentView === 'memory_search' && <MemorySearchView />}
        {currentView === 'history' && (
          <HistoryView
            onSelectConversation={(id) => {
              setActiveConversationId(id);
              setCurrentView('assistant');
            }}
          />
        )}
        {currentView === 'settings' && (
          <SettingsView 
            soundEnabled={soundEnabled}
            onSoundToggle={() => setSoundEnabled(prev => !prev)}
          />
        )}
      </>
    );
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen bg-space-950 text-slate-200 font-sans overflow-hidden relative">
      <style>{`
        ::selection {
          background-color: ${getThemeColor(0.3)};
          color: ${getThemeTextColor()};
        }
      `}</style>

      {/* Cinematic Ambient Glow */}
      <div 
        className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] rounded-full blur-[150px] pointer-events-none z-0" 
        style={{ backgroundColor: getThemeGlowColor() }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none z-0" 
        style={{ backgroundColor: getThemeGlowColorSecondary() }}
      />

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden flex" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-72 h-full bg-space-900 border-r border-space-700" onClick={e => e.stopPropagation()}>
            <Sidebar currentView={currentView} onViewChange={(v) => { setCurrentView(v); setIsMobileMenuOpen(false); }} />
          </div>
          <button className="absolute top-4 right-4 text-white p-2">
            <X size={24} />
          </button>
        </div>
      )}

      {/* Desktop Sidebar - Floating Glass */}
      <div className={`hidden md:block z-20 h-full p-3 pr-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className="h-full glass-panel rounded-2xl overflow-hidden flex flex-col">
          <Sidebar 
            currentView={currentView} 
            onViewChange={setCurrentView}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 h-full">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-space-950/80 backdrop-blur-md">
          <span className={`font-bold tracking-wider ${themeClasses.text}`}>JARVIS</span>
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
        </div>
      </div>

      {/* Right Context Panel - Floating Glass */}
      <div className={`hidden xl:flex ${isContextCollapsed ? 'w-20' : 'w-80'} flex-col z-20 h-full p-3 pl-0 transition-all duration-300`}>
        <div className="h-full glass-panel rounded-2xl overflow-hidden flex flex-col">
          <ContextPanel
            refreshTrigger={memoryRefreshTrigger}
            relatedMemories={relatedMemories}
            isCollapsed={isContextCollapsed}
            onToggleCollapse={() => setIsContextCollapsed(prev => !prev)}
          />
        </div>
      </div>

    </div>
  );
};

export default App;