import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker to use local worker file from public directory
// The worker file is copied to public/pdf.worker.min.mjs during setup
let workerConfigured = false;

function configurePDFWorker() {
  if (typeof window === 'undefined' || workerConfigured) {
    return;
  }

  try {
    // Use the worker file from the public directory
    // Vite serves files from the public directory at the root path
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    workerConfigured = true;
    console.log('[PDF.js] Worker configured:', pdfjsLib.GlobalWorkerOptions.workerSrc);
  } catch (error) {
    console.error('[PDF.js] Failed to configure worker:', error);
    // Last resort: disable worker (will use main thread, slower but works)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    workerConfigured = true;
    console.warn('[PDF.js] Using main thread mode (no worker)');
  }
}

// Configure worker on module load
if (typeof window !== 'undefined') {
  configurePDFWorker();
}

export interface ExtractedContent {
  text: string;
  chunks: string[];
}

/**
 * Extract text content from a PDF file
 */
export async function extractPDFText(base64Data: string): Promise<string> {
  try {
    console.log('[PDF Extraction] Starting PDF text extraction...');
    
    // Ensure worker is configured
    if (typeof window !== 'undefined') {
      configurePDFWorker();
    }
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('[PDF Extraction] PDF data size:', bytes.length, 'bytes');
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ 
      data: bytes,
      verbosity: 0 // Suppress warnings
    });
    
    console.log('[PDF Extraction] Loading PDF document...');
    const pdf = await loadingTask.promise;
    console.log('[PDF Extraction] PDF loaded, pages:', pdf.numPages);
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`[PDF Extraction] Extracting text from page ${pageNum}/${pdf.numPages}...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      console.log(`[PDF Extraction] Page ${pageNum} extracted ${pageText.length} characters`);
      fullText += pageText + '\n';
    }
    
    const result = fullText.trim();
    console.log(`[PDF Extraction] Total extracted text length: ${result.length} characters`);
    return result;
  } catch (error: any) {
    console.error('[PDF Extraction] Error extracting PDF text:', error);
    console.error('[PDF Extraction] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    throw new Error(`Failed to extract PDF text: ${error?.message || error}`);
  }
}

/**
 * Extract text from a text file
 */
export async function extractTextFileContent(base64Data: string): Promise<string> {
  try {
    const binaryString = atob(base64Data);
    // Try UTF-8 decoding first
    try {
      return decodeURIComponent(escape(binaryString));
    } catch {
      // Fallback to binary string if UTF-8 fails
      return binaryString;
    }
  } catch (error) {
    console.error('Error extracting text file content:', error);
    throw new Error(`Failed to extract text file content: ${error}`);
  }
}

/**
 * Extract text content from various file types
 * Can accept either a File object or file metadata
 */
export async function extractFileContent(
  fileOrName: File | string,
  base64Data: string,
  mimeType?: string
): Promise<string | null> {
  const fileName = typeof fileOrName === 'string' 
    ? fileOrName.toLowerCase() 
    : fileOrName.name.toLowerCase();
  const fileMimeType = mimeType || (typeof fileOrName === 'object' ? fileOrName.type : 'application/octet-stream');

  console.log(`[File Extraction] Processing file: ${fileName}, MIME type: ${fileMimeType}`);
  
  try {
    // PDF files
    if (fileMimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      console.log(`[File Extraction] Detected PDF file, extracting text...`);
      const result = await extractPDFText(base64Data);
      console.log(`[File Extraction] PDF extraction successful, got ${result.length} characters`);
      return result;
    }

    // Text files
    if (
      fileMimeType.startsWith('text/') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.markdown') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.csv') ||
      fileName.endsWith('.log') ||
      fileName.endsWith('.xml') ||
      fileName.endsWith('.html') ||
      fileName.endsWith('.htm') ||
      fileName.endsWith('.css') ||
      fileName.endsWith('.js') ||
      fileName.endsWith('.ts') ||
      fileName.endsWith('.jsx') ||
      fileName.endsWith('.tsx') ||
      fileName.endsWith('.py') ||
      fileName.endsWith('.java') ||
      fileName.endsWith('.cpp') ||
      fileName.endsWith('.c') ||
      fileName.endsWith('.h') ||
      fileName.endsWith('.sh') ||
      fileName.endsWith('.yaml') ||
      fileName.endsWith('.yml')
    ) {
      return await extractTextFileContent(base64Data);
    }

    // For other file types, return null (no text extraction)
    // Images, audio, video, etc. will just have metadata embeddings
    console.log(`[File Extraction] File type not supported for text extraction: ${fileMimeType}`);
    return null;
  } catch (error: any) {
    const fileNameStr = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
    console.error(`[File Extraction] Error extracting content from ${fileNameStr}:`, error);
    console.error(`[File Extraction] Error details:`, {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    return null;
  }
}

/**
 * Split text into chunks with overlap for better context
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    
    // If not the last chunk, try to break at a sentence or paragraph boundary
    if (end < text.length) {
      // Look for sentence endings (., !, ?) followed by space
      const sentenceEnd = text.lastIndexOf('. ', end);
      const paragraphEnd = text.lastIndexOf('\n\n', end);
      
      // Prefer paragraph break, then sentence break
      if (paragraphEnd > start + chunkSize * 0.5) {
        end = paragraphEnd + 2; // Include the double newline
      } else if (sentenceEnd > start + chunkSize * 0.5) {
        end = sentenceEnd + 2; // Include the period and space
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start position with overlap
    start = end - overlap;
    if (start < 0) start = 0;
    
    // Prevent infinite loop
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Extract and chunk file content
 * Can accept either a File object or file metadata
 */
export async function extractAndChunkFile(
  fileOrName: File | string,
  base64Data: string,
  chunkSize: number = 1000,
  overlap: number = 200,
  mimeType?: string
): Promise<ExtractedContent> {
  const extractedText = await extractFileContent(fileOrName, base64Data, mimeType);
  
  if (!extractedText || extractedText.trim().length === 0) {
    return {
      text: '',
      chunks: []
    };
  }

  const chunks = chunkText(extractedText, chunkSize, overlap);
  
  return {
    text: extractedText,
    chunks
  };
}

