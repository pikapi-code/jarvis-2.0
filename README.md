
# JARVIS Personal AI

A personal AI assistant built with React, Vite, Express.js, and Google Gemini API. Features secure multi-user support with Supabase backend, vector search, and comprehensive memory management.

## 🏗️ Architecture

- **Frontend**: React + Vite (port 3000)
- **Backend**: Express.js API server (port 3001)
- **Database**: Supabase PostgreSQL with Row Level Security
- **Authentication**: Supabase Auth (with local fallback for development)
- **AI**: Google Gemini API (proxied through backend for security)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- (Optional) Supabase project for multi-user support

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in the root directory:
   ```env
   # Backend server configuration
   GEMINI_API_KEY=your-gemini-api-key-here
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   
   # Supabase configuration (optional - for multi-user support)
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

   For frontend, create `.env.local`:
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Run the development servers:**
   ```bash
   npm run dev
   ```
   
   This starts both the frontend (Vite) and backend (Express) servers concurrently.

4. **Open your browser:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:3001](http://localhost:3001)
   - Health check: [http://localhost:3001/health](http://localhost:3001/health)

### Development Modes

- **Full stack**: `npm run dev` (runs both frontend and backend)
- **Frontend only**: `npm run dev:client` (requires backend running separately)
- **Backend only**: `npm run dev:server` (for backend development)

## 📦 Features

- 💬 **AI Assistant** - Powered by Google Gemini with streaming responses
- 🧠 **Neural Bank** - Persistent memory storage with semantic vector search
- 📝 **Diary Log** - Voice and text diary entries with automatic memory creation
- 📁 **File Management** - Upload and process PDFs, images, and text files
- 🔍 **Memory Search** - Multi-strategy search (vector semantic + keyword + tag-based)
- 📜 **Conversation History** - Persistent chat history with conversation management
- 🎨 **Themes** - Multiple color themes with customizable appearance
- 🔐 **Secure Authentication** - Supabase Auth with user-specific data isolation
- 🔑 **API Key Management** - Per-user API key storage (encrypted in database)
- 📤 **Data Export** - Export memories and conversations as JSON

## 🔒 Security Features

- ✅ Backend API proxy (API keys never exposed to client)
- ✅ Rate limiting (IP-based protection)
- ✅ Input validation (message length, file size/type limits)
- ✅ HTTPS enforcement (production)
- ✅ Row Level Security (RLS) for multi-user data isolation
- ✅ CORS protection (frontend URL whitelist)
- ✅ Structured error logging

## 🛠️ Building for Production

```bash
# Build frontend
npm run build

# Build backend (TypeScript compilation)
npm run build:server

# Start production server
npm start
```

## 📝 Notes

- **Without Supabase**: The app works in development mode with local authentication and IndexedDB storage
- **With Supabase**: Full multi-user support with cloud database, authentication, and data sync across devices
- **API Keys**: Users can provide their own Gemini API keys in Settings, or use a server-wide fallback key
- **Data Storage**: Supabase PostgreSQL (production) or IndexedDB (development fallback)

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📄 License

See [LICENSE](./LICENSE) file for details.