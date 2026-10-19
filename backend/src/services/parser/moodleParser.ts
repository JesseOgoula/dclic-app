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
  'Terminé (n\u2019a pas atteint la note minimale de réussite)': 'failed',
  'Termine (n\u2019a pas atteint la note minimale de reussite)': 'failed',
  'Termin (n\u2019a pas atteint la note minimale de russite)': 'failed',
  'Pas terminé': 'not_completed',
  'Pas termine': 'not_completed',
  'Pas termin': 'not_completed',
};

import { cleanMoodleLearnerName } from './gradebookParser.js';

/**
 * Parse delimited text (TSV, semicolon-CSV, or comma-CSV) into a 2D array of strings.
 * Preserves leading empty cells on the header row so column alignment is never shifted.
 */
function parseDelimitedTextToRows(rawContent: string): string[][] {
  const content = rawContent.replace(/^\uFEFF/, '').replace(/[\r\n]+$/, '');
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  const firstLines = lines.slice(0, 4).join('\n');

  const tabCount = (firstLines.match(/\t/g) || []).length;
  const semiCount = (firstLines.match(/;/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;

  let delimiter = '\t';
  if (semiCount > tabCount && semiCount >= commaCount) {
    delimiter = ';';
  } else if (commaCount > tabCount && commaCount > semiCount) {
    delimiter = ',';
  }

  let parsed = Papa.parse(content, {
    delimiter,
    quoteChar: '"',
    header: false,
    skipEmptyLines: true,
  });

  let data = parsed.data as string[][];
  if (data.length < 2 && lines.length >= 2) {
    // Fallback if unbalanced quotes caused PapaParse to merge lines
    parsed = Papa.parse(content, {
      delimiter,
      quoteChar: '\0',
      header: false,
      skipEmptyLines: true,
    });
    data = parsed.data as string[][];
  }

  return data
    .map(r => (Array.isArray(r) ? r.map(c => String(c ?? '').trim().replace(/^"|"$/g, '').trim()) : []))
    .filter(r => r.some(c => c !== ''));
}

/**
 * Universal reader for .csv, .xlsx, and .xls files into a clean 2D array of rows.
 * Handles:
 * - Native Excel workbooks (.xlsx ZIP / .xls OLE)
 * - Excel workbooks where each CSV/TSV line was saved inside Column A
 * - UTF-16 LE / UTF-16 BE / UTF-8 CSV and TSV files
 */
export function parseSpreadsheetRows(filePath: string): string[][] {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length === 0) return [];

  const isZipXlsx = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOleXls = buffer[0] === 0xd0 && buffer[1] === 0xcf;

  if (isZipXlsx || isOleXls) {
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
    let bestAoa: any[][] = [];
    let bestEmailRowCount = -1;

    for (const sName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sName];
      const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      });
      const nonEmptyAoa = aoa.filter(
        r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== '')
      );
      if (nonEmptyAoa.length < 2) continue;

      const emailRowCount = nonEmptyAoa.filter(r =>
        r.some(c => String(c ?? '').includes('@'))
      ).length;

      if (emailRowCount > bestEmailRowCount || (emailRowCount === bestEmailRowCount && nonEmptyAoa.length > bestAoa.length)) {
        bestEmailRowCount = emailRowCount;
        bestAoa = nonEmptyAoa;
      }
    }

    if (bestAoa.length === 0) return [];

    // Check if Excel stored each entire delimited CSV/TSV line inside Column A (or with tabs inside cells)
    // BEFORE stripping quotes or leading tabs
    const sampleRaw = bestAoa.slice(0, 10);
    const hasTabsInCells = sampleRaw.some(r => r.some(c => String(c ?? '').includes('\t')));
    if (hasTabsInCells) {
      const joined = bestAoa
        .map(r =>
          r
            .map(c => String(c ?? ''))
            .filter(c => c !== '')
            .join('\t')
        )
        .join('\n');
      return parseDelimitedTextToRows(joined);
    }

    const isSingleColumnPacked =
      sampleRaw.length >= 2 &&
      sampleRaw.every(r => {
        const nonEmpty = r.filter(c => String(c ?? '').trim() !== '');
        const c0 = String(r[0] ?? '');
        return (
          nonEmpty.length <= 2 &&
          (c0.split(';').length >= 5 || c0.split(',').length >= 5)
        );
      });

    if (isSingleColumnPacked) {
      const joined = bestAoa.map(r => String(r[0] ?? '')).join('\n');
      return parseDelimitedTextToRows(joined);
    }

    return bestAoa.map(r =>
      r.map(c => String(c ?? '').trim().replace(/^"|"$/g, '').trim())
    );
  }

  // Text CSV / TSV (UTF-16 LE, UTF-16 BE, or UTF-8)
  let content: string;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    content = buffer.toString('utf16le');
  } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length - 1; i += 2) {
      swapped[i] = buffer[i + 1];
      swapped[i + 1] = buffer[i];
    }
    content = swapped.toString('utf16le');
  } else if (buffer.length > 20 && buffer[1] === 0x00 && buffer[3] === 0x00 && buffer[5] === 0x00) {
    content = buffer.toString('utf16le');
  } else {
    content = buffer.toString('utf-8');
  }

  return parseDelimitedTextToRows(content);
}

/**
 * Auto-detects whether a spreadsheet (.csv, .xlsx, .xls) is a Moodle Activity Progression
 * export (rather than a simple Participants list).
 */
export function isProgressionSpreadsheet(filePath: string): boolean {
  try {
    const rows = parseSpreadsheetRows(filePath);
    if (rows.length < 2) return false;

    const sample = rows.slice(0, 12);
    for (const row of sample) {
      const nonEmptyCount = row.filter(c => c !== '' && !c.startsWith('__EMPTY')).length;
      if (nonEmptyCount >= 8) return true;

      const joined = row.join(' ').toLowerCase();
      if (
        joined.includes('module 1') ||
        joined.includes('module 2') ||
        joined.includes('livrable') ||
        joined.includes('m1a.') ||
        joined.includes('m2a.') ||
        joined.includes("lettre d'engagement") ||
        joined.includes('lettre d’engagement') ||
        joined.includes("rapport d'audit") ||
        joined.includes("plan d'action") ||
        joined.includes('pas terminé') ||
        joined.includes('pas termine') ||
        joined.includes('note minimale de réussite') ||
        joined.includes('note minimale de reussite')
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Parse a Moodle progress file (.csv, .xlsx, or .xls).
 * Returns structured rows with learner name, email, and activity statuses.
 */
export function parseProgressCSV(filePath: string): ParsedCSVRow[] {
  const rows = parseSpreadsheetRows(filePath);
  if (rows.length < 2) {
    throw new Error('Progress file has no data rows');
  }

  // 1. Locate the header row (scans first 10 rows in case of title/blank rows)
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(10, rows.length - 1); r++) {
    const rowText = rows[r].join(' ').toLowerCase();
    if (
      rowText.includes('courriel') ||
      rowText.includes('email') ||
      rowText.includes('module 1') ||
      rowText.includes('livrable') ||
      rowText.includes('m1a.') ||
      rowText.includes('lettre d')
    ) {
      headerRowIdx = r;
      break;
    }
  }

  const headers = rows[headerRowIdx];

  // 2. Locate the email column index in the data rows
  let emailColIdx = 1;
  for (let r = headerRowIdx + 1; r < Math.min(headerRowIdx + 25, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    const idx = row.findIndex(cell => cell && cell.includes('@') && cell.includes('.'));
    if (idx !== -1) {
      emailColIdx = idx;
      break;
    }
  }

  // 3. Locate the email header index and compute offset between header columns and data columns
  const headerEmailIdx = headers.findIndex(h => {
    const low = (h || '').toLowerCase();
    return low.includes('courriel') || low.includes('email') || low.includes('e-mail') || low === 'mail';
  });

  const startHeaderCol = headerEmailIdx !== -1 ? headerEmailIdx + 1 : emailColIdx + 1;
  const headerOffset = headerEmailIdx !== -1 ? emailColIdx - headerEmailIdx : 0;

  const activityCols: Array<{ name: string; statusCol: number; dateCol: number }> = [];
  let hCol = startHeaderCol;

  while (hCol < headers.length) {
    const rawHeader = (headers[hCol] || '').trim().replace(/^"|"$/g, '');
    if (!rawHeader || rawHeader.startsWith('__EMPTY')) {
      hCol++;
      continue;
    }

    const statusCol = hCol + headerOffset;
    const nextHeader = (headers[hCol + 1] || '').trim().replace(/^"|"$/g, '');
    const hasDateCol =
      hCol + 1 >= headers.length ||
      !nextHeader ||
      nextHeader.startsWith('__EMPTY') ||
      nextHeader.toLowerCase().includes('date') ||
      nextHeader.toLowerCase().includes('achèvement') ||
      nextHeader.toLowerCase().includes('achevement');

    const dateCol = hasDateCol ? statusCol + 1 : -1;
    activityCols.push({
      name: rawHeader,
      statusCol,
      dateCol,
    });
    hCol += hasDateCol ? 2 : 1;
  }

  const results: ParsedCSVRow[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    let email = (row[emailColIdx] || '').trim().replace(/^"|"$/g, '').toLowerCase();
    let actualEmailCol = emailColIdx;

    if (!email || !email.includes('@')) {
      const foundIdx = row.findIndex(c => c && c.includes('@') && c.includes('.'));
      if (foundIdx === -1) continue;
      actualEmailCol = foundIdx;
      email = row[foundIdx].trim().replace(/^"|"$/g, '').toLowerCase();
    }

    const rawName = row
      .slice(0, actualEmailCol)
      .map(c => (c || '').trim().replace(/^"|"$/g, ''))
      .filter(Boolean)
      .join(' ');
    const cleanedName = cleanMoodleLearnerName(rawName);
    const name = cleanedName.full_name || rawName || 'Apprenant';

    const activities: ParsedCSVRow['activities'] = [];

    for (let a = 0; a < activityCols.length; a++) {
      const { name: actName, statusCol, dateCol } = activityCols[a];
      const rawStatus = (row[statusCol] || '').trim();
      const rawDate = dateCol >= 0 ? (row[dateCol] || '').trim() : '';

      // Normalize status (handle encoding issues)
      let normalizedStatus = rawStatus;
      const normalizedRaw = rawStatus.replace(/[\u2018\u2019\u2032]/g, "'");
      const sortedEntries = Object.entries(STATUS_MAP).sort((a, b) => b[0].length - a[0].length);
      for (const [key, value] of sortedEntries) {
        if (
          normalizedRaw.includes(key) ||
          normalizedRaw.replace(/[éèêë]/g, 'e').includes(key.replace(/[éèêë]/g, 'e'))
        ) {
          normalizedStatus = value;
          break;
        }
      }

      // If still not mapped, try fuzzy matching
      if (!['completed', 'not_completed', 'passed', 'failed'].includes(normalizedStatus)) {
        if (rawStatus.toLowerCase().includes('termin') && !rawStatus.toLowerCase().includes('pas termin')) {
          if (rawStatus.toLowerCase().includes('pas atteint')) {
            normalizedStatus = 'failed';
          } else if (
            rawStatus.toLowerCase().includes('réussite') ||
            rawStatus.toLowerCase().includes('reussite') ||
            rawStatus.toLowerCase().includes('russite')
          ) {
            normalizedStatus = 'passed';
          } else {
            normalizedStatus = 'completed';
          }
        } else {
          normalizedStatus = 'not_completed';
        }
      }

      // Parse date — handle "1970-01-01", Excel serial numbers (e.g. 46287.45), ISO, and French dates
      let completedAt: string | null = null;
      if (rawDate && !rawDate.includes('1970-01-01') && rawDate.length >= 4) {
        const serialMatch = rawDate.match(/^(\d{4,5})(?:[.,](\d+))?$/);
        if (serialMatch) {
          // Excel serial date (days since 1900-01-01; 25569 = 1970-01-01)
          const serialNum = parseFloat(rawDate.replace(',', '.'));
          if (serialNum > 40000 && serialNum < 60000) {
            const d = new Date(Math.round((serialNum - 25569) * 86400 * 1000));
            if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 2020 && d.getUTCFullYear() <= 2035) {
              completedAt = d.toISOString();
            }
          }
        } else {
          const isoRegex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
          const isoMatch = rawDate.match(isoRegex);

          if (isoMatch) {
            const [_, year, month, day, h, m, s] = isoMatch;
            const d = new Date(
              `${year}-${month}-${day}T${h.padStart(2, '0')}:${m}:${(s || '00').padStart(2, '0')}Z`
            );
            if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 2020 && d.getUTCFullYear() <= 2035) {
              completedAt = d.toISOString();
            }
          } else {
            const months: Record<string, number> = {
              janvier: 0,
              fevrier: 1,
              mars: 2,
              avril: 3,
              mai: 4,
              juin: 5,
              juillet: 6,
              aout: 7,
              septembre: 8,
              octobre: 9,
              novembre: 10,
              decembre: 11,
            };
            const regex = /(\d+)\s+([a-zA-ZÀ-ÿ]+)\s+(\d{4}),?\s+(\d{1,2})[h:](\d{2})/;
            const match = rawDate.match(regex);
            if (match) {
              const [_, day, month, year, h, m] = match;
              const cleanMonth = month
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z]/g, '');
              const mIndex = months[cleanMonth] !== undefined ? months[cleanMonth] : 0;
              const d = new Date(Date.UTC(parseInt(year), mIndex, parseInt(day), parseInt(h), parseInt(m)));
              if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 2020 && d.getUTCFullYear() <= 2035) {
                completedAt = d.toISOString();
              }
            } else {
              // Handle DD/MM/YYYY HH:MM or standard Date parse
              const slashMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
              if (slashMatch) {
                let [_, p1, p2, yr, h, m, s] = slashMatch;
                let yearNum = parseInt(yr);
                if (yearNum < 100) yearNum += 2000;
                let dayNum = parseInt(p1);
                let monthNum = parseInt(p2);
                if (monthNum > 12 && dayNum <= 12) {
                  // US format M/D/Y
                  const tmp = dayNum;
                  dayNum = monthNum;
                  monthNum = tmp;
                }
                const d = new Date(
                  Date.UTC(yearNum, monthNum - 1, dayNum, parseInt(h || '0'), parseInt(m || '0'), parseInt(s || '0'))
                );
                if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 2020 && d.getUTCFullYear() <= 2035) {
                  completedAt = d.toISOString();
                }
              } else {
                const parsedD = new Date(rawDate);
                if (!isNaN(parsedD.getTime()) && parsedD.getUTCFullYear() >= 2020 && parsedD.getUTCFullYear() <= 2035) {
                  completedAt = parsedD.toISOString();
                }
              }
            }
          }
        }
      }

      // Special rule for Lettre d'engagement
      const isEngagement =
        actName.toLowerCase().includes("lettre d'engagement") || actName.toLowerCase().includes('lettre d');
      if (isEngagement && completedAt) {
        normalizedStatus = 'completed';
      }

      activities.push({
        name: actName,
        status: normalizedStatus,
        completed_at: completedAt,
      });
    }

    results.push({ name, email, activities });
  }

  return results;
}

/**
 * Parse the Moodle participants Excel/CSV file.
 * Returns structured participant data with group info.
 */
export function parseParticipantsXLSX(filePath: string): ParsedParticipant[] {
  const rows = parseSpreadsheetRows(filePath);
  if (rows.length < 2) return [];

  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(10, rows.length - 1); r++) {
    const rowText = rows[r].join(' ').toLowerCase();
    if (rowText.includes('courriel') || rowText.includes('email') || rowText.includes('prénom') || rowText.includes('prenom')) {
      headerRowIdx = r;
      break;
    }
  }

  const headers = rows[headerRowIdx].map(h => (h || '').trim().toLowerCase());
  const firstIdx = headers.findIndex(h => h.includes('prénom') || h.includes('prenom') || h.includes('first name'));
  const lastIdx = headers.findIndex(h => h === 'nom de famille' || h === 'nom' || h === 'last name');
  const emailIdx = headers.findIndex(h => h.includes('courriel') || h.includes('email') || h === 'mail');
  const groupIdx = headers.findIndex(h => h.includes('groupe') || h.includes('group'));

  const results: ParsedParticipant[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let email = emailIdx !== -1 ? (row[emailIdx] || '').trim().toLowerCase() : '';
    let actualEmailCol = emailIdx;
    if (!email || !email.includes('@')) {
      actualEmailCol = row.findIndex(c => c && c.includes('@') && c.includes('.'));
      if (actualEmailCol === -1) continue;
      email = row[actualEmailCol].trim().toLowerCase();
    }

    let firstName = firstIdx !== -1 ? (row[firstIdx] || '').trim() : '';
    let lastName = lastIdx !== -1 ? (row[lastIdx] || '').trim() : '';

    if (!firstName && !lastName && actualEmailCol > 0) {
      const combined = row.slice(0, actualEmailCol).filter(Boolean).join(' ');
      const cleaned = cleanMoodleLearnerName(combined);
      firstName = cleaned.first_name;
      lastName = cleaned.last_name;
    } else {
      const cleaned = cleanMoodleLearnerName(`${firstName} ${lastName}`);
      firstName = cleaned.first_name || firstName;
      lastName = cleaned.last_name || lastName;
    }

    const group = groupIdx !== -1 ? (row[groupIdx] || '').trim() : '';

    results.push({
      first_name: firstName,
      last_name: lastName,
      email,
      group,
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
 * Identifie si une activité est un Devoir officiel (selon le programme DCLIC MN ou GP).
 */
export function isAssignment(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes('correction') || lower.includes('exercice évalué sur les débouchés') || lower.includes('exercice evalue sur les debouches')) {
    return false;
  }
  // GP Livrables (Module de spécialisation)
  if (lower.includes('livrable')) {
    return true;
  }
  // MN Livrables & Devoirs (Formation initiale)
  return (
    lower.includes("lettre d'engagement") ||
    lower.includes("lettre d") ||
    lower.includes("débouchés professionnels") ||
    lower.includes("debouches professionnels") ||
    lower.includes("devoir de conception d'une stratégie marketing") ||
    lower.includes("devoir de conception d'une strategie marketing") ||
    lower.includes("entraînez-vous à rédiger pour le web") ||
    lower.includes("entrainez-vous a rediger pour le web") ||
    lower.includes("production d'un contenu audiovisuel") ||
    lower.includes("utiliser l'intelligence artificielle pour produire un contenu") ||
    lower.includes("utiliser l'ia pour produire") ||
    lower.includes("rapport d'interprétation des indicateurs") ||
    lower.includes("rapport d'interpretation des indicateurs") ||
    lower.includes("livrable final")
  );
}

/**
 * Extract activity metadata from the parsed CSV column names.
 * Maps activity codes to sequences and types for both MN and GP.
 */
export function extractActivityMetadata(
  activityNames: string[],
  forcedFormationType?: 'mn' | 'gp'
): Array<{
  code: string;
  name: string;
  sequence: string;
  type: 'exercise' | 'quiz' | 'devoir' | 'documentation';
  is_evaluated: boolean;
  display_order: number;
  formation_type: string;
}> {
  let isGP = false;
  if (forcedFormationType) {
    isGP = forcedFormationType === 'gp';
  } else {
    isGP = activityNames.some(n =>
      n.includes('posture stratégique') ||
      n.includes('Mission direction de projet') ||
      n.includes('plan de lancement 360') ||
      n.includes("Livrable d'entraînement") ||
      n.includes("Livrable d’entraînement") ||
      n.startsWith('Module 1 : La posture')
    );
  }

  if (isGP) {
    return activityNames.map((name, index) => {
      const lowerName = name.toLowerCase();
      let sequence = 'Autre';
      let code = `GP_ACT_${index}`;
      let type: 'exercise' | 'quiz' | 'devoir' | 'documentation' = 'exercise';
      let isEvaluated = false;

      // Group 1: 0 to 6
      if (index <= 6) {
        sequence = "Séquence 1 : L'analyse et la stratégie marketing";
        if (index <= 4) {
          code = `GP_S1_M${index + 1}`;
          type = 'exercise';
        } else {
          code = `GP_S1_L${index - 4}`;
          type = 'devoir';
          isEvaluated = true;
        }
      }
      // Group 2: 7 to 13
      else if (index <= 13) {
        sequence = 'Séquence 2 : Planification opérationnelle et budgétaire';
        if (index <= 11) {
          code = `GP_S2_M${index - 6}`;
          type = 'exercise';
        } else {
          code = `GP_S2_L${index - 11}`;
          type = 'devoir';
          isEvaluated = true;
        }
      }
      // Group 3: 14 to 21
      else if (index <= 21) {
        sequence = 'Séquence 3 : Pilotage de projet et coordination';
        if (index <= 18) {
          code = `GP_S3_M${index - 13}`;
          type = 'exercise';
        } else {
          code = `GP_S3_L${index - 18}`;
          type = 'devoir';
          isEvaluated = true;
        }
      }
      // Group 4: 22 to 28
      else if (index <= 28) {
        sequence = 'Séquence 4 : Communication 360° et Événementiel';
        if (index <= 26) {
          code = `GP_S4_M${index - 21}`;
          type = 'exercise';
        } else {
          code = `GP_S4_L${index - 26}`;
          type = 'devoir';
          isEvaluated = true;
        }
      }
      // Group 5: 29 to 35
      else if (index <= 35) {
        sequence = 'Séquence 5 : Pilotage de la performance et Reporting';
        if (index <= 33) {
          code = `GP_S5_M${index - 28}`;
          type = 'exercise';
        } else {
          code = `GP_S5_L${index - 33}`;
          type = 'devoir';
          isEvaluated = true;
        }
      }
      // Projet de spécialisation et portfolio: 36 to 48
      else {
        sequence = 'Séquence 6 : Projet de spécialisation et portfolio';
        if (index === 36) {
          code = 'GP_S6_DESC';
          type = 'documentation';
        } else if (index <= 42) {
          code = `GP_S6_ENT_${index - 36}`;
          type = 'devoir';
          isEvaluated = true;
        } else {
          code = `GP_S6_FIN_${index - 42}`;
          type = 'devoir';
          isEvaluated = true;
        }
      }

      if (isAssignment(name)) {
        type = 'devoir';
        isEvaluated = true;
      }

      return {
        code,
        name: name.trim(),
        sequence,
        type,
        is_evaluated: isEvaluated,
        display_order: index,
        formation_type: 'gp',
      };
    });
  }

  // Formation Initiale - Marketing Numérique (MN)
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
    const lowerName = name.toLowerCase();
    if (name.includes('Lettre d\'engagement') || name.includes('Lettre d')) {
      sequence = 'Préalable';
    } else if (lowerName.includes('impression')) {
      sequence = "Phase d'impressions";
    } else if (name.includes('Livrable final') || name.includes('Document de strat') || name.includes('Projet')) {
      sequence = 'Projet professionnel';
    }

    // Determine type
    const isDevoir = isAssignment(name);
    let type: 'exercise' | 'quiz' | 'devoir' | 'documentation' = 'exercise';

    if (isDevoir) {
      type = 'devoir';
    } else if (lowerName.includes('quiz')) {
      type = 'quiz';
    } else if (lowerName.includes('documentation') || lowerName.includes('correction') || lowerName.includes('présentation') || lowerName.includes('presentation')) {
      type = 'documentation';
    }

    // Determine if evaluated
    const isEvaluated = isDevoir || lowerName.includes('évalué') || lowerName.includes('evalue');

    return {
      code,
      name: name.trim(),
      sequence: sequence || 'Autre',
      type,
      is_evaluated: isEvaluated,
      display_order: index,
      formation_type: 'mn',
    };
  });
}
