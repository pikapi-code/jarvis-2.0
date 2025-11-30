import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { chatRouter } from './routes/chat';
import { embeddingRouter } from './routes/embedding';
import { ttsRouter } from './routes/tts';
import { apiKeysRouter } from './routes/api-keys';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Check for server-wide API key (optional - users can provide their own)
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.warn('⚠️  WARNING: No server-wide GEMINI_API_KEY found.');
  console.warn('   Users will need to provide their own API keys in Settings.');
  console.warn('   For development, you can set GEMINI_API_KEY in .env as a fallback.');
} else {
  console.log('✅ Server-wide GEMINI_API_KEY is configured (fallback for users without keys)');
}

// HTTPS Enforcement (production only)
if (isProduction) {
  app.use((req, res, next) => {
    // Check if request is secure (HTTPS) or forwarded from a proxy
    const isSecure = req.secure || 
                     req.headers['x-forwarded-proto'] === 'https' ||
                     req.headers['x-forwarded-ssl'] === 'on';
    
    if (!isSecure && req.method !== 'GET') {
      // For non-GET requests, require HTTPS
      return res.status(403).json({ 
        error: 'HTTPS required for this operation' 
      });
    }
    
    // Add HSTS header
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '❌' : res.statusCode >= 300 ? '⚠️' : '✅';
    console.log(`[${timestamp}] ${statusColor} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Support large payloads for images/audio

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Stricter rate limiting for chat endpoints (more expensive operations)
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 chat requests per hour
  message: 'Too many chat requests. Please wait before sending more messages.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for embedding generation (very expensive)
const embeddingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // Limit each IP to 200 embedding requests per hour
  message: 'Too many embedding requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api', generalLimiter);
app.use('/api/chat', chatLimiter);
app.use('/api/embedding', embeddingLimiter);

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Jarvis API server is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// API routes
app.use('/api/chat', chatRouter);
app.use('/api/embedding', embeddingRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/api-keys', apiKeysRouter);

// Enhanced error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    message: err.message || 'Internal server error',
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp
  };
  
  // Log error with context
  console.error(`[${timestamp}] ❌ ERROR on ${req.method} ${req.path}:`, {
    message: errorInfo.message,
    ip: errorInfo.ip,
    ...(isProduction ? {} : { stack: errorInfo.stack })
  });
  
  // In production, don't expose stack traces
  res.status(err.status || 500).json({
    error: errorInfo.message,
    ...(isProduction ? {} : { stack: errorInfo.stack }),
    timestamp: errorInfo.timestamp
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Jarvis API server running on http://localhost:${PORT}`);
  console.log(`📡 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

