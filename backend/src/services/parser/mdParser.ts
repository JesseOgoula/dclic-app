import fs from 'fs';
import type { ParsedParticipant } from '../../types.js';

/**
 * Parse the Moodle participants Markdown file.
 * Returns structured participant data with group info.
 */
export function parseParticipantsMD(filePath: string): ParsedParticipant[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const results: ParsedParticipant[] = [];

  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      inTable = true;
      // Skip header and separator rows
      if (trimmed.includes('Nom') || trimmed.includes('Courriel') || trimmed.includes('---')) {
        continue;
      }

      const columns = trimmed.split('|').map(col => col.trim()).filter((_, index, arr) => index > 0 && index < arr.length - 1);
      
      if (columns.length >= 5) {
        const [fullName, emailStr, role, groupStr, lastAccess] = columns;
        
        // Skip formateurs/teachers
        if (role.toLowerCase().includes('formateur')) {
          continue;
        }

        const email = emailStr.toLowerCase().trim();
        if (!email) continue;

        // Split name: Last word in uppercase (or just last word) is often the last name
        const nameParts = fullName.split(/\s+/);
        let firstName = '';
        let lastName = '';
        
        if (nameParts.length > 1) {
            // Check if any parts are all uppercase (typically last name in French conventions)
            const upperParts = nameParts.filter(p => p === p.toUpperCase() && p.length > 1);
            if (upperParts.length > 0) {
                lastName = upperParts.join(' ');
                firstName = nameParts.filter(p => !upperParts.includes(p)).join(' ');
            } else {
                lastName = nameParts[nameParts.length - 1];
                firstName = nameParts.slice(0, -1).join(' ');
            }
        } else {
            firstName = fullName;
        }

        results.push({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email,
          group: groupStr.trim(),
          last_access: lastAccess.trim(),
        } as ParsedParticipant & { last_access: string });
      }
    } else if (inTable && trimmed === '') {
        // End of table
        inTable = false;
    }
  }

  return results;
}

export interface ParsedParticipantWithAccess extends ParsedParticipant {
  last_access?: string | null;
}

function isAccessString(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  if (/G1_|GPM|MN/i.test(s)) return false;
  if (/étudiant|apprenant|enseignant|formateur|tuteur/i.test(s)) return false;
  return /jour|heure|min|\b\d+\s*s\b|seconde|jamais|maintenant|en ligne|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}/i.test(s);
}

/**
 * Universal raw text parser for Moodle participants.
 * Handles:
 * 1. Direct browser copy/paste (TSV tab-separated columns)
 * 2. Markdown tables (| column | column |)
 * 3. Semicolon/comma separated values
 * 4. Multi-line contiguous student blocks
 */
export function parseRawParticipantsText(content: string): ParsedParticipantWithAccess[] {
  if (!content || !content.trim()) return [];

  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const results: ParsedParticipantWithAccess[] = [];
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

  // Strategy 1: Check if lines have '|' (Markdown table)
  const isMarkdown = lines.some(l => l.includes('|') && emailRegex.test(l));
  if (isMarkdown) {
    for (const line of lines) {
      if (!line.includes('|') || !emailRegex.test(line)) continue;
      // Skip header lines
      if (line.includes('---') || (line.toLowerCase().includes('courriel') && line.toLowerCase().includes('nom'))) continue;

      const cols = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cols.length >= 2) {
        const emailIdx = cols.findIndex(c => emailRegex.test(c));
        if (emailIdx === -1) continue;
        const email = cols[emailIdx].match(emailRegex)![1].toLowerCase();

        // Check if teacher/formateur
        const isTeacher = cols.some(c => /formateur|enseignant|tuteur/i.test(c));
        if (isTeacher) continue;

        const nameStr = cols.slice(0, emailIdx).join(' ').trim() || cols[0];
        const group = cols.find(c => /G1_|GPM|MN/i.test(c)) || '';
        const lastAccess = cols.find((c, idx) => idx > emailIdx && isAccessString(c)) || '';

        const nameParts = nameStr.split(/\s+/);
        let firstName = '';
        let lastName = '';
        if (nameParts.length > 1) {
          const upperParts = nameParts.filter(p => p === p.toUpperCase() && p.length > 1);
          if (upperParts.length > 0) {
            lastName = upperParts.join(' ');
            firstName = nameParts.filter(p => !upperParts.includes(p)).join(' ');
          } else {
            lastName = nameParts[nameParts.length - 1];
            firstName = nameParts.slice(0, -1).join(' ');
          }
        } else {
          firstName = nameStr;
        }

        results.push({
          first_name: firstName.trim() || 'Apprenant',
          last_name: lastName.trim(),
          email,
          group: group.trim(),
          last_access: lastAccess.trim() || null,
        });
      }
    }
    if (results.length > 0) return results;
  }

  // Strategy 2: Tab-separated or delimiter-separated rows (Browser table copy/paste)
  for (const line of lines) {
    if (!emailRegex.test(line)) continue;
    // Skip header line if present
    if (line.toLowerCase().includes('courriel') && line.toLowerCase().includes('nom')) continue;

    let delimiter = '\t';
    if (!line.includes('\t')) {
      if (line.includes(';')) delimiter = ';';
      else if (line.includes(',')) delimiter = ',';
    }

    const parts = line.split(delimiter).map(p => p.trim()).filter(p => p.length > 0);
    const emailIdx = parts.findIndex(p => emailRegex.test(p));
    if (emailIdx === -1) continue;

    const email = parts[emailIdx].match(emailRegex)![1].toLowerCase();

    // Skip teacher
    if (parts.some(p => /formateur|enseignant|tuteur/i.test(p))) continue;

    let nameStr = parts.slice(0, emailIdx).join(' ').trim();
    if (!nameStr && parts.length > 0 && emailIdx > 0) {
      nameStr = parts[0];
    }
    if (!nameStr) nameStr = 'Apprenant';

    const group = parts.find(p => /G1_|GPM|MN/i.test(p)) || '';
    const lastAccess = parts.find((p, idx) => idx !== emailIdx && isAccessString(p)) || '';

    const nameParts = nameStr.split(/\s+/);
    let firstName = '';
    let lastName = '';
    if (nameParts.length > 1) {
      const upperParts = nameParts.filter(p => p === p.toUpperCase() && p.length > 1);
      if (upperParts.length > 0) {
        lastName = upperParts.join(' ');
        firstName = nameParts.filter(p => !upperParts.includes(p)).join(' ');
      } else {
        lastName = nameParts[nameParts.length - 1];
        firstName = nameParts.slice(0, -1).join(' ');
      }
    } else {
      firstName = nameStr;
    }

    results.push({
      first_name: firstName.trim() || 'Apprenant',
      last_name: lastName.trim(),
      email,
      group: group.trim(),
      last_access: lastAccess.trim() || null,
    });
  }

  if (results.length > 0) return results;

  // Strategy 3: Multi-line chunk parsing
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(emailRegex);
    if (match) {
      const email = match[1].toLowerCase();
      const prevLine = i > 0 ? lines[i - 1] : '';
      const nameStr = prevLine && !emailRegex.test(prevLine) && !prevLine.includes('---') ? prevLine : 'Apprenant';

      let isTeacher = false;
      let group = '';
      let lastAccess = '';

      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const nextLine = lines[j];
        if (emailRegex.test(nextLine)) break;
        if (/formateur|enseignant|tuteur/i.test(nextLine)) isTeacher = true;
        if (/G1_|GPM|MN/i.test(nextLine)) group = nextLine;
        if (isAccessString(nextLine)) lastAccess = nextLine;
      }

      if (!isTeacher) {
        const nameParts = nameStr.split(/\s+/);
        let firstName = '';
        let lastName = '';
        if (nameParts.length > 1) {
          const upperParts = nameParts.filter(p => p === p.toUpperCase() && p.length > 1);
          if (upperParts.length > 0) {
            lastName = upperParts.join(' ');
            firstName = nameParts.filter(p => !upperParts.includes(p)).join(' ');
          } else {
            lastName = nameParts[nameParts.length - 1];
            firstName = nameParts.slice(0, -1).join(' ');
          }
        } else {
          firstName = nameStr;
        }

        results.push({
          first_name: firstName.trim() || 'Apprenant',
          last_name: lastName.trim(),
          email,
          group: group.trim(),
          last_access: lastAccess.trim() || null,
        });
      }
    }
  }

  return results;
}

/**
 * Parse a relative time string like "2 jours 13 heures", "27 min 4 s", "Jamais"
 * into an absolute ISO string date based on current time.
 */
export function parseRelativeTime(relativeStr: string): string | null {
    if (!relativeStr || relativeStr.toLowerCase() === 'jamais') {
        return null;
    }

    const now = new Date();
    let days = 0;
    let hours = 0;
    let mins = 0;
    let secs = 0;

    const daysMatch = relativeStr.match(/(\d+)\s*jour/);
    if (daysMatch) days = parseInt(daysMatch[1], 10);

    const hoursMatch = relativeStr.match(/(\d+)\s*heure/);
    if (hoursMatch) hours = parseInt(hoursMatch[1], 10);

    const minsMatch = relativeStr.match(/(\d+)\s*min/);
    if (minsMatch) mins = parseInt(minsMatch[1], 10);

    const secsMatch = relativeStr.match(/(\d+)\s*s/);
    if (secsMatch) secs = parseInt(secsMatch[1], 10);

    const totalMs = (days * 24 * 60 * 60 * 1000) +
                    (hours * 60 * 60 * 1000) +
                    (mins * 60 * 1000) +
                    (secs * 1000);

    if (totalMs === 0) return null;

    const pastDate = new Date(now.getTime() - totalMs);
    return pastDate.toISOString();
}
