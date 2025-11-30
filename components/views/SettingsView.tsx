import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { themes } from '../../config/themes';
import { getAllMemories, deleteMemory, getConversations, deleteConversation } from '../../services/supabase-db';
import { getAuthHeaders } from '../../services/api-client';
import { Memory } from '../../types';
import Notification, { NotificationType } from '../Notification';
import ConfirmModal from '../ConfirmModal';
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
  const { username, session } = useAuth();
  const themeClasses = getThemeClasses();
  const [storageInfo, setStorageInfo] = useState({ memories: 0, conversations: 0, totalSize: '0 KB' });
  const [isClearing, setIsClearing] = useState(false);
  const [clearType, setClearType] = useState<'memories' | 'conversations' | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });
  
  // API Key Management
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

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

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Check if user has API key
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/api/api-keys`, {
          method: 'GET',
          headers,
        });
        
        if (response.ok) {
          const data = await response.json();
          setHasApiKey(data.hasApiKey || false);
        }
      } catch (error) {
        console.error('Failed to check API key:', error);
      } finally {
        setIsCheckingApiKey(false);
      }
    };
    checkApiKey();
  }, []);

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

  const handleClearMemories = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete All Memories',
      message: 'Are you sure you want to delete ALL memories? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setIsClearing(true);
        setClearType('memories');
        try {
          const memories = await getAllMemories();
          for (const mem of memories) {
            await deleteMemory(mem.id!);
          }
          setStorageInfo(prev => ({ ...prev, memories: 0 }));
          setNotification({ message: 'All memories have been deleted.', type: 'success' });
        } catch (error) {
          console.error('Failed to clear memories:', error);
          setNotification({ message: 'Failed to clear memories.', type: 'error' });
        } finally {
          setIsClearing(false);
          setClearType(null);
        }
      }
    });
  };

  const handleClearConversations = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete All Conversations',
      message: 'Are you sure you want to delete ALL conversations? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setIsClearing(true);
        setClearType('conversations');
        try {
          const conversations = await getConversations();
          for (const conv of conversations) {
            await deleteConversation(conv.id);
          }
          setStorageInfo(prev => ({ ...prev, conversations: 0 }));
          setNotification({ message: 'All conversations have been deleted.', type: 'success' });
        } catch (error) {
          console.error('Failed to clear conversations:', error);
          setNotification({ message: 'Failed to clear conversations.', type: 'error' });
        } finally {
          setIsClearing(false);
          setClearType(null);
        }
      }
    });
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
      setNotification({ message: 'Failed to export data.', type: 'error' });
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
        setNotification({ message: 'Import functionality requires additional implementation. Data structure validated.', type: 'info' });
        console.log('Import data:', data);
      } catch (error) {
        setNotification({ message: 'Failed to import data. Invalid file format.', type: 'error' });
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
            label="Gemini API Key"
            description="Your personal API key for Gemini AI. Required to use the assistant."
          >
            {isCheckingApiKey ? (
              <div className="text-xs text-slate-500">Checking...</div>
            ) : hasApiKey && !showApiKeyInput ? (
              <div className="flex items-center gap-2">
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <Check size={14} />
                  Configured
                </div>
                <button
                  onClick={() => setShowApiKeyInput(true)}
                  className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-slate-300 transition-all"
                >
                  Update
                </button>
                <button
                  onClick={async () => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Delete API Key',
                      message: 'Are you sure you want to delete your API key? You will need to add it again to use the assistant.',
                      type: 'danger',
                      onConfirm: async () => {
                        setConfirmModal({ ...confirmModal, isOpen: false });
                        try {
                          const headers = await getAuthHeaders();
                          const response = await fetch(`${API_BASE_URL}/api/api-keys`, {
                            method: 'DELETE',
                            headers,
                          });
                          if (response.ok) {
                            setHasApiKey(false);
                            setNotification({ message: 'API key deleted successfully.', type: 'success' });
                          } else {
                            const error = await response.json();
                            // Check if authentication is required
                            if (error.requiresAuth || response.status === 401) {
                              throw new Error('Please log in to delete your API key. Authentication is required when Supabase is configured.');
                            }
                            throw new Error(error.error || 'Failed to delete API key');
                          }
                        } catch (error: any) {
                          console.error('Failed to delete API key:', error);
                          setNotification({ message: error.message || 'Failed to delete API key.', type: 'error' });
                        }
                      }
                    });
                  }}
                  className="text-xs px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded text-red-400 transition-all"
                >
                  Delete
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full max-w-md">
                {showApiKeyInput && (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter your Gemini API key"
                      className="flex-1 px-3 py-2 bg-space-900/50 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/20"
                    />
                    <button
                      onClick={async () => {
                        if (!apiKeyInput.trim()) {
                          setNotification({ message: 'Please enter an API key.', type: 'error' });
                          return;
                        }
                        setIsSavingApiKey(true);
                        try {
                          // Use session from AuthContext if available
                          const headers = await getAuthHeaders(session || undefined);
                          const response = await fetch(`${API_BASE_URL}/api/api-keys`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
                          });
                          if (response.ok) {
                            setHasApiKey(true);
                            setApiKeyInput('');
                            setShowApiKeyInput(false);
                            setNotification({ message: 'API key validated and saved successfully. You may need to refresh the page or start a new conversation.', type: 'success' });
                          } else {
                            const error = await response.json();
                            console.error('API key save error:', error);
                            // Check if authentication is required
                            if (error.requiresAuth || response.status === 401) {
                              throw new Error('Your session may have expired. Please log out and log back in, then try again.');
                            }
                            throw new Error(error.error || 'Failed to save API key');
                          }
                        } catch (error: any) {
                          console.error('Failed to save API key:', error);
                          // Provide more helpful error messages
                          let errorMessage = error.message || 'Failed to save API key.';
                          if (error.message?.includes('session') || error.message?.includes('log in')) {
                            errorMessage = error.message;
                          } else if (error.message?.includes('No active session')) {
                            errorMessage = 'Your session has expired. Please log out and log back in, then try again.';
                          }
                          setNotification({ message: errorMessage, type: 'error' });
                        } finally {
                          setIsSavingApiKey(false);
                        }
                      }}
                      disabled={isSavingApiKey}
                      className={`px-4 py-2 rounded-lg text-sm ${themeClasses.button} transition-all disabled:opacity-50`}
                    >
                      {isSavingApiKey ? 'Validating...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setShowApiKeyInput(false);
                        setApiKeyInput('');
                      }}
                      className="px-3 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-slate-300 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {!showApiKeyInput && (
                  <button
                    onClick={() => setShowApiKeyInput(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs ${themeClasses.button} transition-all`}
                  >
                    <Key size={14} className="inline mr-1.5" />
                    Add API Key
                  </button>
                )}
                <div className="text-xs text-slate-500 mt-1">
                  Get your API key from{' '}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline"
                  >
                    Google AI Studio
                  </a>
                </div>
              </div>
            )}
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
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        type={confirmModal.type}
      />
    </div>
  );
};

export default SettingsView;

