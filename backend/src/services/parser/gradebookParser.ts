// ============================================================
// Moodle Gradebook ("Rapport de l'évaluateur") Raw Text Parser
// Handles noisy copy-paste from Moodle Grader Report (Markdown links,
// multi-line blocks, or TSV tab-separated browser selections)
// ============================================================

export interface ParsedGradebookActivityGrade {
  activity_name: string;
  activity_index: number;
  raw_value: string;
  grade: number | null; // null when '-' (not evaluated), numeric when '0,00', '15,00', etc.
}

export interface ParsedGradebookLearner {
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  grades: ParsedGradebookActivityGrade[];
  total_course_grade: number | null;
}

export interface ParsedGradebookResult {
  formation_hint: 'gp' | 'mn' | null;
  activity_headers: string[];
  learners: ParsedGradebookLearner[];
}

/**
 * Strip Markdown links `[Label](https://...)` -> `Label` and unescape brackets.
 */
function stripMarkdownLinks(str: string): string {
  return str
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .trim();
}

/**
 * Clean Moodle learner name from copy-paste noise:
 * - Markdown links `[Name](url)`
 * - Profile picture alt texts (`Une photo d'identité de...`, `Photo de profil...`)
 * - Duplicated names caused by alt text + visible text concatenation
 * - 2-letter Moodle avatar initials glued to the first name (`HAHawa Abdoulaye` -> `Hawa Abdoulaye`)
 */
export function cleanMoodleLearnerName(rawName: string): {
  full_name: string;
  first_name: string;
  last_name: string;
} {
  let s = stripMarkdownLinks(rawName)
    .replace(/^Une photo d['’]identité de\s+/i, '')
    .replace(/^Photo d['’]identité ou de profil\.?\s*/i, '')
    .replace(/^Ma\s+photo\s+de\s+profil\.?\s*/i, '')
    .replace(/^Photo de profil\.?\s*/i, '')
    .replace(/^Apprenant\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Deduplicate repeated prefix from image alt text concatenation:
  // e.g. "Mahuna Raphaël DominiqueMahuna Raphaël Dominique MEDJE MEDJE"
  const dupMatch = s.match(/^(.{4,}?)\s*\1\b/i);
  if (dupMatch) {
    s = s.slice(dupMatch[1].length).trim();
  }
  const endDup = s.match(/^(.+?)\s+(\b[A-ZÀ-Ÿ-]{2,})\s+\2$/);
  if (endDup) {
    s = `${endDup[1]} ${endDup[2]}`.trim();
  }

  // Strip 2-letter Moodle avatar initials prefix when glued to the first name:
  // Rule: First 3 characters are uppercase letters (C0, C1, C2),
  // C0 (unaccented) === C2 (unaccented), AND C1 (unaccented) matches the initial of a subsequent word.
  const words = s.split(/\s+/);
  const noAccent = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  if (words.length >= 2 && words[0].length >= 3) {
    const w0 = words[0];
    const c0 = w0[0];
    const c1 = w0[1];
    const c2 = w0[2];
    const isUpper = (ch: string) => /[A-ZÀ-Ÿ]/.test(ch);

    if (isUpper(c0) && isUpper(c1) && isUpper(c2) && noAccent(c0) === noAccent(c2)) {
      const otherInitials = words.slice(1).map(w => noAccent(w[0] || ''));
      if (otherInitials.includes(noAccent(c1))) {
        s = s.slice(2).trim();
      }
    }
  }

  const finalWords = s.split(/\s+/).filter(Boolean);
  let firstName = '';
  let lastName = '';

  if (finalWords.length > 1) {
    const upperParts = finalWords.filter(
      p => p === p.toUpperCase() && p.length > 1 && /[A-ZÀ-Ÿ]/.test(p)
    );
    if (upperParts.length > 0 && upperParts.length < finalWords.length) {
      lastName = upperParts.join(' ');
      firstName = finalWords.filter(p => !upperParts.includes(p)).join(' ');
    } else {
      lastName = finalWords[finalWords.length - 1];
      firstName = finalWords.slice(0, -1).join(' ');
    }
  } else {
    firstName = s || 'Apprenant';
  }

  return {
    full_name: s || 'Apprenant',
    first_name: firstName.trim() || 'Apprenant',
    last_name: lastName.trim(),
  };
}

/**
 * Clean Moodle activity header from copy-paste noise:
 * - Markdown links `[Label](url)`
 * - Leading Moodle activity type or aggregation icon alt texts (`Paquetage SCORM`, `Devoir`, `Naturelle`, etc.)
 *   that browsers include when copying plain text directly from the Moodle Grader Report table.
 */
export function cleanMoodleActivityHeader(rawHeader: string): string {
  return stripMarkdownLinks(rawHeader)
    .replace(
      /^(?:Paquetage\s+SCORM|Activit[ée]\s+SCORM|SCORM\s+package|Devoir|Assignment|Test|Quiz|Questionnaire|Feedback|Forum|Atelier|Workshop|Le[çc]on|Lesson|Glossaire|Glossary|Contenu\s+interactif|Activit[ée]\s+H5P|H5P|Outil\s+externe|External\s+tool|Ressource|Fichier|Page|URL|Dossier|[ÉE]tiquette|Wiki|Sondage|Choice|Base\s+de\s+donn[ée]es|Database|Chat|Naturelle|Natural|Moyenne\s+pond[ée]r[ée]e(?:\s+simple)?\s+des\s+notes|Moyenne\s+des\s+notes|Somme\s+des\s+notes|Tendance\s+centrale)\s*/i,
      ''
    )
    .trim();
}

/**
 * Normalize activity name for resilient matching (collapses multiple spaces, lowercases, strips accents/punctuation differences).
 */
export function normalizeActivityNameForMatch(name: string): string {
  return cleanMoodleActivityHeader(name)
    .toLowerCase()
    .replace(/\[suppression en cours\]/gi, '')
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a single grade token ('-', '0,00', '15,00', '14.5') into number | null.
 */
function parseGradeValue(token: string): number | null {
  const t = token.trim();
  if (!t || t === '-' || t === '—') return null;
  const normalized = t.replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const val = parseFloat(normalized);
  return isNaN(val) ? null : val;
}

/**
 * Main parser for Moodle Grader Report raw copy-paste text.
 */
export function parseRawGradebookText(rawText: string): ParsedGradebookResult {
  if (!rawText || !rawText.trim()) {
    return { formation_hint: null, activity_headers: [], learners: [] };
  }

  const rawLines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Detect formation hint from text
  let formationHint: 'gp' | 'mn' | null = null;
  const lowerFull = rawText.toLowerCase();
  if (
    lowerFull.includes('gp_2026') ||
    lowerFull.includes('gestion de projet marketing 360') ||
    lowerFull.includes('posture stratégique') ||
    lowerFull.includes('mission direction de projet')
  ) {
    formationHint = 'gp';
  } else if (
    lowerFull.includes('mn_072026') ||
    lowerFull.includes('mn_122025') ||
    lowerFull.includes('m1a.') ||
    lowerFull.includes("lettre d'engagement")
  ) {
    formationHint = 'mn';
  }

  // 1. Extract activity headers between "Adresse de courriel" and "Total du cours"
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  let inHeaders = false;
  const extractedHeaders: string[] = [];

  for (const line of rawLines) {
    const rawStripped = stripMarkdownLinks(line);
    const cleaned = cleanMoodleActivityHeader(line);

    // Handle case where headers are tab-separated on a single line
    if (
      rawStripped.toLowerCase().includes('adresse de courriel') &&
      rawStripped.toLowerCase().includes('total du cours') &&
      line.includes('\t')
    ) {
      const parts = line
        .split('\t')
        .map(p => cleanMoodleActivityHeader(p))
        .filter(Boolean);
      const emailIdx = parts.findIndex(p => p.toLowerCase().includes('adresse de courriel'));
      const totalIdx = parts.findIndex(p => p.toLowerCase().includes('total du cours'));
      if (emailIdx !== -1 && totalIdx !== -1 && totalIdx > emailIdx) {
        extractedHeaders.push(...parts.slice(emailIdx + 1, totalIdx));
        break;
      }
    }

    if (rawStripped.toLowerCase() === 'adresse de courriel') {
      inHeaders = true;
      continue;
    }

    if (inHeaders) {
      if (
        cleaned.toLowerCase() === 'total du cours' ||
        cleaned.toLowerCase().startsWith('total du cours') ||
        rawStripped.toLowerCase().includes('total du cours')
      ) {
        inHeaders = false;
        break;
      }
      // Safety stop if we ever hit a student email line (in case "Total du cours" was omitted from selection)
      if (emailRegex.test(line) && !line.toLowerCase().includes('sortitemid=email')) {
        if (extractedHeaders.length > 0) {
          extractedHeaders.pop(); // Remove the student's name line that preceded the email
        }
        inHeaders = false;
        break;
      }
      // If a header line has tabs, split by tab
      if (line.includes('\t')) {
        const subParts = line
          .split('\t')
          .map(p => cleanMoodleActivityHeader(p))
          .filter(Boolean);
        for (const sp of subParts) {
          if (sp.toLowerCase().includes('total du cours')) {
            inHeaders = false;
            break;
          }
          extractedHeaders.push(sp);
        }
        if (!inHeaders) break;
      } else if (cleaned) {
        extractedHeaders.push(cleaned);
      }
    }
  }

  // Filter out headers marked "[Suppression en cours]" since Moodle renders empty cells for them in student rows
  let activeHeaders = extractedHeaders.filter(
    h => !h.toLowerCase().includes('suppression en cours')
  );

  // 2. Parse student blocks
  const pureGradeTokenRegex = /^(?:-|\d+(?:[.,]\d+)?)$/;

  interface RawStudentBlock {
    rawName: string;
    email: string;
    tokens: string[];
  }

  const rawBlocks: RawStudentBlock[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Stop if we hit summary rows at the bottom of the gradebook
    if (/^moyenne du groupe|^moyenne globale/i.test(line)) {
      break;
    }

    const emailMatch = line.match(emailRegex);
    if (!emailMatch) continue;

    // Skip header lines or teacher/footer lines
    if (line.toLowerCase().includes('sortitemid=email')) continue;
    if (/connecté sous le nom/i.test(line)) continue;

    const email = emailMatch[1].toLowerCase().trim();
    if (email === 'adirignoogoula@gmail.com') continue;

    let rawName = 'Apprenant';
    const tokens: string[] = [];

    // Check if the line itself is tab-separated (Name \t Email \t grade1 \t grade2 ...)
    if (line.includes('\t')) {
      const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
      const eIdx = parts.findIndex(p => emailRegex.test(p));
      if (eIdx > 0) {
        rawName = parts.slice(0, eIdx).join(' ');
      } else if (i > 0) {
        rawName = rawLines[i - 1];
      }
      for (let k = eIdx + 1; k < parts.length; k++) {
        if (pureGradeTokenRegex.test(parts[k])) {
          tokens.push(parts[k]);
        }
      }
    } else {
      // Multi-line format: student name is on line i - 1
      if (i > 0) {
        rawName = rawLines[i - 1];
      }
    }

    // Collect subsequent lines that are grade tokens ('-' or '15,00' or tab-separated grade tokens)
    let j = i + 1;
    while (j < rawLines.length) {
      const nextLine = rawLines[j];
      if (/^moyenne du groupe|^moyenne globale/i.test(nextLine)) {
        break;
      }
      if (emailRegex.test(nextLine)) {
        break;
      }

      const subTokens = nextLine.split('\t').map(t => t.trim()).filter(Boolean);
      if (subTokens.length > 0 && subTokens.every(t => pureGradeTokenRegex.test(t))) {
        tokens.push(...subTokens);
        j++;
      } else {
        break;
      }
    }

    // Advance loop index to last consumed grade line
    i = j - 1;

    rawBlocks.push({
      rawName,
      email,
      tokens,
    });
  }

  // Determine the standard number of tokens per student (e.g. 43 = 42 activities + 1 Total du cours)
  const tokenCounts = rawBlocks.map(b => b.tokens.length).filter(c => c > 0);
  const mostCommonCount =
    tokenCounts.length > 0
      ? tokenCounts.sort(
          (a, b) =>
            tokenCounts.filter(v => v === b).length - tokenCounts.filter(v => v === a).length
        )[0]
      : 0;

  // If each student has N tokens (e.g. 43), the last token is "Total du cours", so N - 1 are activity tokens (42).
  // If activeHeaders has 43 items (because "Description du projet" is ungraded and has no student cell),
  // remove "Description du projet" so activeHeaders aligns 1-to-1 with the 42 activity tokens!
  const expectedActivityCount = mostCommonCount > 1 ? mostCommonCount - 1 : activeHeaders.length;
  if (
    activeHeaders.length === expectedActivityCount + 1 &&
    activeHeaders.some(h => h.toLowerCase().includes('description du projet'))
  ) {
    activeHeaders = activeHeaders.filter(h => !h.toLowerCase().includes('description du projet'));
  }

  const learners: ParsedGradebookLearner[] = rawBlocks.map(block => {
    const cleanedName = cleanMoodleLearnerName(block.rawName);
    const hasTotalToken =
      activeHeaders.length > 0 && block.tokens.length === activeHeaders.length + 1;
    const activityTokens = hasTotalToken
      ? block.tokens.slice(0, activeHeaders.length)
      : block.tokens.slice(0, Math.max(0, block.tokens.length - 1));
    const totalToken =
      block.tokens.length > 0 ? block.tokens[block.tokens.length - 1] : '-';

    const grades: ParsedGradebookActivityGrade[] = activityTokens.map((tok, idx) => ({
      activity_name: activeHeaders[idx] || `Activité ${idx + 1}`,
      activity_index: idx,
      raw_value: tok,
      grade: parseGradeValue(tok),
    }));

    return {
      full_name: cleanedName.full_name,
      first_name: cleanedName.first_name,
      last_name: cleanedName.last_name,
      email: block.email,
      grades,
      total_course_grade: parseGradeValue(totalToken),
    };
  });

  return {
    formation_hint: formationHint,
    activity_headers: activeHeaders,
    learners,
  };
}
