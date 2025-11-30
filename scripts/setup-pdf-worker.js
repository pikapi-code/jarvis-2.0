import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const publicDir = join(projectRoot, 'public');
const workerSource = join(projectRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const workerDest = join(publicDir, 'pdf.worker.min.mjs');

try {
  // Create public directory if it doesn't exist
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
    console.log('Created public directory');
  }

  // Copy worker file
  if (existsSync(workerSource)) {
    copyFileSync(workerSource, workerDest);
    console.log('✓ PDF.js worker file copied to public directory');
  } else {
    console.warn('⚠ PDF.js worker file not found at:', workerSource);
    console.warn('  Make sure pdfjs-dist is installed: npm install');
  }
} catch (error) {
  console.error('Error setting up PDF.js worker:', error);
  process.exit(1);
}

