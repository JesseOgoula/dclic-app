// ============================================================
// Text Extractor Service for Student Deliverable Files
// Supports: .docx, .odt, .pdf, .txt, .md, .csv
// ============================================================

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.txt' || ext === '.md' || ext === '.csv') {
      return fs.readFileSync(filePath, 'utf-8');
    }

    if (ext === '.docx') {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    if (ext === '.odt') {
      // ODT is a zip archive containing content.xml
      const zip = new AdmZip(filePath);
      const contentEntry = zip.getEntry('content.xml');
      if (contentEntry) {
        const xml = contentEntry.getData().toString('utf-8');
        // Simple XML tag stripper for text extraction
        const text = xml
          .replace(/<text:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim();
        return text;
      }
      return '';
    }

    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const data = await pdf(buffer);
      return data.text || '';
    }

    // For other types (images, presentations, video links, etc.), return filename metadata
    return `[Fichier joint: ${path.basename(filePath)} (${ext})]`;
  } catch (err) {
    console.warn(`Could not extract text from ${filePath}:`, err);
    return `[Erreur lecture fichier: ${path.basename(filePath)}]`;
  }
}
