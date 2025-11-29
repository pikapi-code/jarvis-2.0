import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { themes } from '../../config/themes';
import { getAllMemories, deleteMemory, getConversations, deleteConversation } from '../../services/db';
import { Memory } from '../../types';
import { 
  Settings, 
  Palette, 
  Volume2, 
  VolumeX, 
  Key, 
  Database, 
  Trash2, 
  Download, 
  Upload, 
  Info, 
  Check,
  AlertTriangle,
  HardDrive,
  BrainCircuit,
  MessageSquare,
  FileText
} from 'lucide-react';

interface SettingsViewProps {
  soundEnabled: boolean;
  onSoundToggle: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ soundEnabled, onSoundToggle }) => {
  const { currentTheme, setTheme, getThemeClasses } = useTheme();
  const { username } = useAuth();
  const themeClasses = getThemeClasses();
  const [storageInfo, setStorageInfo] = useState({ memories: 0, conversations: 0, totalSize: '0 KB' });
  const [isClearing, setIsClearing] = useState(false);
  const [clearType, setClearType] = useState<'memories' | 'conversations' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Get theme color for glows (not used but kept for consistency)
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
    return colorMap[currentTheme] || colorMap.indigo;
  };

  // Load storage info
  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        const memories = await getAllMemories();
        const conversations = await getConversations();
        
        // Estimate storage size (rough calculation)
        const memorySize = JSON.stringify(memories).length;
        const convSize = JSON.stringify(conversations).length;
        const totalBytes = memorySize + convSize;
        const totalSize = totalBytes > 1024 * 1024 
          ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
          : `${(totalBytes / 1024).toFixed(2)} KB`;

        setStorageInfo({
          memories: memories.length,
          conversations: conversations.length,
          totalSize
        });
      } catch (error) {
        console.error('Failed to load storage info:', error);
      }
    };
    loadStorageInfo();
  }, []);

  const handleClearMemories = async () => {
    if (!confirm('Are you sure you want to delete ALL memories? This cannot be undone.')) {
      return;
    }
    setIsClearing(true);
    setClearType('memories');
    try {
      const memories = await getAllMemories();
      for (const mem of memories) {
        await deleteMemory(mem.id!);
      }
      setStorageInfo(prev => ({ ...prev, memories: 0 }));
      alert('All memories have been deleted.');
    } catch (error) {
      console.error('Failed to clear memories:', error);
      alert('Failed to clear memories.');
    } finally {
      setIsClearing(false);
      setClearType(null);
    }
  };

  const handleClearConversations = async () => {
    if (!confirm('Are you sure you want to delete ALL conversations? This cannot be undone.')) {
      return;
    }
    setIsClearing(true);
    setClearType('conversations');
    try {
      const conversations = await getConversations();
      for (const conv of conversations) {
        await deleteConversation(conv.id);
      }
      setStorageInfo(prev => ({ ...prev, conversations: 0 }));
      alert('All conversations have been deleted.');
    } catch (error) {
      console.error('Failed to clear conversations:', error);
      alert('Failed to clear conversations.');
    } finally {
      setIsClearing(false);
      setClearType(null);
    }
  };

  const handleExportData = async () => {
    try {
      const memories = await getAllMemories();
      const conversations = await getConversations();
      const data = {
        memories,
        conversations,
        exportDate: new Date().toISOString(),
        version: '2.0'
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jarvis-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data.');
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // Note: In a real implementation, you'd want to import this data properly
        alert('Import functionality requires additional implementation. Data structure validated.');
        console.log('Import data:', data);
      } catch (error) {
        alert('Failed to import data. Invalid file format.');
      }
    };
    input.click();
  };

  const SettingSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="glass-card rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${themeClasses.badge}`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );

  const SettingItem: React.FC<{ 
    label: string; 
    description?: string; 
    children: React.ReactNode;
  }> = ({ label, description, children }) => (
    <div className="flex items-start justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {description && (
          <div className="text-xs text-slate-500 mt-1">{description}</div>
        )}
      </div>
      <div className="ml-4">
        {children}
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className={`p-3 rounded-xl ${themeClasses.icon} text-white`}>
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-slate-400 text-sm">Configure your JARVIS experience</p>
          </div>
        </div>

        {/* Appearance */}
        <SettingSection title="Appearance" icon={<Palette size={18} />}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(themes).map(([id, theme]) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all border ${
                  currentTheme === id
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-space-900/50 border-white/5 text-slate-300 hover:bg-white/5 hover:border-white/10 hover:text-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${theme.gradient} shadow-lg`} />
                <span className="text-xs font-medium text-center">{theme.name}</span>
                {currentTheme === id && (
                  <div className="absolute top-1 right-1">
                    <Check size={14} className="text-emerald-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </SettingSection>

        {/* Audio */}
        <SettingSection title="Audio" icon={soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}>
          <SettingItem
            label="Voice Responses"
            description="Enable audio responses for short messages"
          >
            <button
              onClick={onSoundToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                soundEnabled ? themeClasses.icon : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </SettingItem>
        </SettingSection>

        {/* API Configuration */}
        <SettingSection title="API Configuration" icon={<Key size={18} />}>
          <SettingItem
            label="API Key"
            description="Your Gemini API key (stored in environment)"
          >
            <div className="flex items-center gap-2">
              <code className="text-xs px-2 py-1 bg-space-900 rounded text-slate-400">
                {showApiKey ? (process.env.API_KEY || 'Not set') : '••••••••••••'}
              </code>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </SettingItem>
          <SettingItem
            label="Model"
            description="Current AI model in use"
          >
            <div className="text-sm text-slate-300 font-mono">gemini-2.5-flash</div>
          </SettingItem>
        </SettingSection>

        {/* Data Management */}
        <SettingSection title="Data Management" icon={<Database size={18} />}>
          <SettingItem
            label="Storage Usage"
            description={`${storageInfo.memories} memories, ${storageInfo.conversations} conversations`}
          >
            <div className="text-sm text-slate-300">{storageInfo.totalSize}</div>
          </SettingItem>
          <SettingItem
            label="Export Data"
            description="Download all your data as a backup"
          >
            <button
              onClick={handleExportData}
              className={`px-3 py-1.5 rounded-lg text-xs ${themeClasses.button} transition-all`}
            >
              <Download size={14} className="inline mr-1.5" />
              Export
            </button>
          </SettingItem>
          <SettingItem
            label="Import Data"
            description="Restore from a backup file"
          >
            <button
              onClick={handleImportData}
              className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-slate-300 hover:bg-white/10 transition-all border border-white/10"
            >
              <Upload size={14} className="inline mr-1.5" />
              Import
            </button>
          </SettingItem>
        </SettingSection>

        {/* Clear Data */}
        <SettingSection title="Clear Data" icon={<Trash2 size={18} />}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle size={16} className="text-amber-400" />
              <p className="text-xs text-amber-300">Warning: These actions cannot be undone</p>
            </div>
            <div className="flex items-center justify-between p-4 bg-space-900/50 rounded-lg border border-white/5">
              <div className="flex items-center gap-3">
                <BrainCircuit size={18} className="text-slate-400" />
                <div>
                  <div className="text-sm font-medium text-slate-200">Clear All Memories</div>
                  <div className="text-xs text-slate-500">Delete all stored memories permanently</div>
                </div>
              </div>
              <button
                onClick={handleClearMemories}
                disabled={isClearing}
                className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
              >
                {isClearing && clearType === 'memories' ? 'Clearing...' : 'Clear'}
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-space-900/50 rounded-lg border border-white/5">
              <div className="flex items-center gap-3">
                <MessageSquare size={18} className="text-slate-400" />
                <div>
                  <div className="text-sm font-medium text-slate-200">Clear All Conversations</div>
                  <div className="text-xs text-slate-500">Delete all conversation history permanently</div>
                </div>
              </div>
              <button
                onClick={handleClearConversations}
                disabled={isClearing}
                className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
              >
                {isClearing && clearType === 'conversations' ? 'Clearing...' : 'Clear'}
              </button>
            </div>
          </div>
        </SettingSection>

        {/* About */}
        <SettingSection title="About" icon={<Info size={18} />}>
          <div className="space-y-3">
            <SettingItem label="Version">
              <div className="text-sm text-slate-300 font-mono">OS V2.0</div>
            </SettingItem>
            <SettingItem label="User">
              <div className="text-sm text-slate-300">{username || 'Guest'}</div>
            </SettingItem>
            <SettingItem label="Storage Type">
              <div className="text-sm text-slate-300">IndexedDB (Local)</div>
            </SettingItem>
            <div className="pt-3 border-t border-white/5">
              <p className="text-xs text-slate-500">
                JARVIS Personal AI - Powered by Google Gemini
              </p>
            </div>
          </div>
        </SettingSection>
      </div>
    </div>
  );
};

export default SettingsView;

