// ============================================================
// Moodle CSV/Excel Parser — Handles UTF-16 TSV progress exports
// and XLSX participant lists, filtered to G1 only
// ============================================================

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedCSVRow, ParsedParticipant } from '../../types.js';

// The Moodle progress CSV is UTF-16 LE with BOM, tab-separated
// Columns alternate: ActivityName, Status, (empty header), Timestamp

const STATUS_MAP: Record<string, string> = {
  'Terminé': 'completed',
  'Termine': 'completed',
  'Termin': 'completed',
  'Terminé (note minimale de réussite atteinte)': 'passed',
  'Termine (note minimale de reussite atteinte)': 'passed',
  'Termin (note minimale de russite atteinte)': 'passed',
  'Terminé (n\'a pas atteint la note minimale de réussite)': 'failed',
  'Termine (n\'a pas atteint la note minimale de reussite)': 'failed',
  'Termin (n\'a pas atteint la note minimale de russite)': 'failed',
  'Pas terminé': 'not_completed',
  'Pas termine': 'not_completed',
  'Pas termin': 'not_completed',
};

/**
 * Parse the Moodle progress CSV (TSV, UTF-16 LE).
 * Returns structured rows with learner name, email, and activity statuses.
 */
export function parseProgressCSV(filePath: string): ParsedCSVRow[] {
  // Read as UTF-16 LE (the Moodle export format)
  const buffer = fs.readFileSync(filePath);
  let content: string;

  // Detect BOM: UTF-16 LE starts with FF FE
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    content = buffer.toString('utf16le');
  } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16 BE
    const swapped = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length - 1; i += 2) {
      swapped[i] = buffer[i + 1];
      swapped[i + 1] = buffer[i];
    }
    content = swapped.toString('utf16le');
  } else {
    content = buffer.toString('utf-8');
  }

  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
  }

  // Parse TSV
  const parsed = Papa.parse(content.trim(), {
    delimiter: '\t',
    quoteChar: '"',
    header: false,
    skipEmptyLines: true,
  });

  const rows = parsed.data as string[][];
  if (rows.length < 2) {
    throw new Error('CSV file has no data rows');
  }

  // First row is the header
  const headers = rows[0];

  // The CSV structure is:
  // Data rows:
  // Col 0: Name
  // Col 1: "Adresse de courriel" (Email)
  // Col 2: Activity 1 Status, Col 3: Activity 1 Timestamp
  // Col 4: Activity 2 Status, Col 5: Activity 2 Timestamp
  //
  // Header row has 1 column less than data rows (missing Name header).
  // Col 0: "Adresse de courriel"
  // Col 1: Activity 1 Name, Col 2: ""
  // Col 3: Activity 2 Name, Col 4: ""

  const activityNames: string[] = [];
  // Start from index 1 in headers (which corresponds to index 2 in data rows)
  for (let i = 1; i < headers.length; i += 2) {
    const name = headers[i]?.trim();
    if (name) {
      activityNames.push(name);
    }
  }

  const results: ParsedCSVRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 3) continue;

    const name = (row[0] || '').trim().replace(/^"|"$/g, '');
    const email = (row[1] || '').trim().replace(/^"|"$/g, '').toLowerCase();

    if (!email) continue;

    const activities: ParsedCSVRow['activities'] = [];

    for (let a = 0; a < activityNames.length; a++) {
      const statusCol = 2 + a * 2;
      const dateCol = statusCol + 1;

      const rawStatus = (row[statusCol] || '').trim();
      const rawDate = (row[dateCol] || '').trim();

      // Normalize status (handle encoding issues)
      let normalizedStatus = rawStatus;
      for (const [key, value] of Object.entries(STATUS_MAP)) {
        if (rawStatus.includes(key) || rawStatus.replace(/[éèêë]/g, 'e').includes(key.replace(/[éèêë]/g, 'e'))) {
          normalizedStatus = value;
          break;
        }
      }

      // If still not mapped, try fuzzy matching
      if (!['completed', 'not_completed', 'passed', 'failed'].includes(normalizedStatus)) {
        if (rawStatus.toLowerCase().includes('termin') && !rawStatus.toLowerCase().includes('pas')) {
          normalizedStatus = rawStatus.toLowerCase().includes('réussite') || rawStatus.toLowerCase().includes('reussite') || rawStatus.toLowerCase().includes('russite')
            ? 'passed' : 'completed';
        } else {
          normalizedStatus = 'not_completed';
        }
      }

      // Parse date — handle "1970-01-01" as null
      let completedAt: string | null = null;
      if (rawDate && !rawDate.includes('1970-01-01') && rawDate.length > 4) {
        // Try ISO-like first (YYYY-MM-DD HH:MM:SS)
        const isoRegex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
        const isoMatch = rawDate.match(isoRegex);
        
        if (isoMatch) {
          const [_, year, month, day, h, m, s] = isoMatch;
          const d = new Date(`${year}-${month}-${day}T${h}:${m}:${s}Z`);
          completedAt = d.toISOString();
        } else {
          // Try parsing French format like "mercredi 24 juillet 2026, 17:10"
          const months: Record<string, number> = {
            'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
            'juillet': 6, 'août': 7, 'aout': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
          };
          const regex = /(\d+)\s+([a-zA-ZÀ-ÿ]+)\s+(\d{4}),?\s+(\d{1,2})[h:](\d{2})/;
          const match = rawDate.match(regex);
          if (match) {
            const [_, day, month, year, h, m] = match;
            const cleanMonth = month.toLowerCase().replace('', 'u'); // basic fix for août/aot
            const mIndex = months[cleanMonth] || 0;
            const d = new Date(parseInt(year), mIndex, parseInt(day), parseInt(h), parseInt(m));
            completedAt = d.toISOString();
          } else {
            // Fallback
            completedAt = rawDate;
          }
        }
      }

      activities.push({
        name: activityNames[a],
        status: normalizedStatus,
        completed_at: completedAt,
      });
    }

    results.push({ name, email, activities });
  }

  return results;
}

/**
 * Parse the Moodle participants Excel file.
 * Returns structured participant data with group info.
 */
export function parseParticipantsXLSX(filePath: string): ParsedParticipant[] {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const results: ParsedParticipant[] = [];

  for (const row of data) {
    // Column names may vary (encoding issues), try multiple
    const firstName = row['Prénom'] || row['Prenom'] || row['First name'] || '';
    const lastName = row['Nom de famille'] || row['Nom'] || row['Last name'] || '';
    const email = (row['Adresse de courriel'] || row['Email'] || row['email'] || '').toLowerCase().trim();
    const group = row['Groupes'] || row['Groups'] || '';

    if (!email) continue;

    results.push({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email,
      group: group.trim(),
    });
  }

  return results;
}

/**
 * Filter participants to a specific group.
 */
export function filterByGroup(participants: ParsedParticipant[], groupId: string): ParsedParticipant[] {
  return participants.filter(p => p.group === groupId);
}

/**
 * Extract activity metadata from the parsed CSV column names.
 * Maps activity codes (M1A, M2B, etc.) to sequences and types.
 */
export function extractActivityMetadata(activityNames: string[]): Array<{
  code: string;
  name: string;
  sequence: string;
  type: 'exercise' | 'quiz' | 'devoir' | 'documentation';
  is_evaluated: boolean;
  display_order: number;
}> {
  const seqMap: Record<string, string> = {
    '1': 'Séquence 1 : Introduction au marketing numérique',
    '2': 'Séquence 2 : Découverte des méthodes et outils',
    '3': 'Séquence 3 : Gestion d\'une campagne marketing',
    '4': 'Séquence 4 : Production et diffusion des contenus',
    '5': 'Séquence 5 : Analyse des résultats et veille',
  };

  return activityNames.map((name, index) => {
    // Extract code like "M1A", "M2B", "M10C" etc.
    const codeMatch = name.match(/M(\d+)([A-C])\./);
    const baseCode = codeMatch ? `M${codeMatch[1]}${codeMatch[2]}` : `ACT`;
    const code = `${baseCode}_${index}`;

    // Determine sequence from module number
    let sequence = 'Autre';
    if (codeMatch) {
      const moduleNum = parseInt(codeMatch[1]);
      if (moduleNum <= 2) sequence = seqMap['1'];
      else if (moduleNum <= 3) sequence = seqMap['2'];
      else if (moduleNum <= 7) sequence = seqMap['3'];
      else if (moduleNum <= 10) sequence = seqMap['4'];
      else if (moduleNum <= 12) sequence = seqMap['5'];
    }

    // Special cases
    if (name.includes('Lettre d\'engagement') || name.includes('Lettre d')) {
      sequence = 'Préalable';
    }
    if (name.includes('Livrable final') || name.includes('Document de strat') || name.includes('Projet')) {
      sequence = 'Projet professionnel';
    }

    // Determine type
    let type: 'exercise' | 'quiz' | 'devoir' | 'documentation' = 'exercise';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('quiz')) type = 'quiz';
    else if (lowerName.includes('devoir') || lowerName.includes('livrable')) type = 'devoir';
    else if (lowerName.includes('documentation') || lowerName.includes('correction') || lowerName.includes('présentation')) type = 'documentation';

    // Determine if evaluated
    const isEvaluated = lowerName.includes('évalué') || lowerName.includes('devoir') || lowerName.includes('livrable');

    return {
      code,
      name: name.trim(),
      sequence: sequence || 'Autre',
      type,
      is_evaluated: isEvaluated,
      display_order: index,
    };
  });
}
