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
      if (trimmed.includes('Nom et Prénom') || trimmed.includes('|---|')) {
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
