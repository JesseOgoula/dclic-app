// ============================================================
// DCLIC Backend — Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory
import fs from 'fs';
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auto-load existing files from the files directory on startup
async function autoLoadFiles() {
  const filesDir = path.resolve(process.cwd(), '..', 'files');
  if (!fs.existsSync(filesDir)) {
    console.log('No files directory found, skipping auto-load');
    return;
  }

  const { processUpload } = await import('./services/uploadService.js');

  // Load participants XLSX first (to establish G1 filter)
  const xlsxFiles = fs.readdirSync(filesDir).filter(f => f.endsWith('.xlsx'));
  for (const file of xlsxFiles) {
    try {
      console.log(`Auto-loading participants: ${file}`);
      const result = await processUpload(path.join(filesDir, file), file);
      console.log(`  → ${result.learners_created} learners created, ${result.learners_updated} updated`);
    } catch (err) {
      console.error(`  → Error loading ${file}:`, err);
    }
  }

  // Then load progress CSV
  const csvFiles = fs.readdirSync(filesDir).filter(f => f.endsWith('.csv'));
  for (const file of csvFiles) {
    try {
      console.log(`Auto-loading progress: ${file}`);
      const result = await processUpload(path.join(filesDir, file), file);
      console.log(`  → ${result.rows_processed} rows, ${result.progress_records} progress records`);
    } catch (err) {
      console.error(`  → Error loading ${file}:`, err);
    }
  }
}

import { store } from './services/store.js';

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 DCLIC Backend running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  
  console.log(`\n📂 Loading stored data...`);
  const loaded = store.loadFromFile();
  if (loaded) {
    console.log(`✅ Loaded state from data.json`);
  } else {
    console.log(`📂 No existing state found. Auto-loading Moodle data...`);
    await autoLoadFiles();
  }
  
  console.log(`\n✅ Ready! Dashboard stats: http://localhost:${PORT}/api/dashboard/stats`);
});
