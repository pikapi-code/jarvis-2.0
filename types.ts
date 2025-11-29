export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Attachment {
  type: 'image' | 'audio' | 'text' | 'file';
  mimeType: string;
  data: string; // Base64
  name?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  attachments?: Attachment[];
  isThinking?: boolean;
  latencyMs?: number;
}

export type MemoryType = 'text' | 'image' | 'audio' | 'file';

export interface Memory {
  id: number;
  content: string;
  category: string; // 'diary', 'work', 'personal', 'fact', 'conversation'
  tags: string[];
  timestamp: number;
  type: MemoryType;
  mediaData?: string; // Base64 for images/audio/files
  mediaMimeType?: string;
  mediaName?: string;
  embedding?: number[];
}

// Tool definitions types
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResponse {
  id: string;
  name: string;
  response: Record<string, any>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

export type ViewMode = 'assistant' | 'diary' | 'memories' | 'files' | 'settings' | 'history' | 'memory_search';
