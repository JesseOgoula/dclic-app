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

import { store, supabase } from './services/store.js';

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 DCLIC Backend running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  
  // Test Supabase connection
  try {
    const { error } = await supabase.from('learners').select('id').limit(1);
    if (error) throw error;
    console.log(`✅ Connected to Supabase PostgreSQL successfully!`);
  } catch (err) {
    console.error(`❌ Failed to connect to Supabase:`, err);
  }
  
  console.log(`\n✅ Ready! Dashboard stats: http://localhost:${PORT}/api/dashboard/stats`);
});
