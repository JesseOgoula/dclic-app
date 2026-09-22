// ============================================================
// Learner Matching & Name Normalization Service
// Ported and enhanced from sync_pp_evaluations.py
// ============================================================

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’\-]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export interface MatchableLearner {
  id: string;
  nom?: string;
  prenom?: string;
  full_name: string;
  email?: string;
}

export function matchLearnerName(rawFolderName: string, learners: MatchableLearner[]): MatchableLearner | null {
  // Folder pattern: "NOM PRENOM_123456_assignsubmission_file"
  const cleanFolder = rawFolderName.split('_')[0].trim();
  const normFolder = normalizeText(cleanFolder);
  const folderWords = new Set(normFolder.split(' ').filter(Boolean));

  let bestMatch: MatchableLearner | null = null;
  let maxOverlap = 0;

  for (const l of learners) {
    const normFull = normalizeText(l.full_name || `${l.nom || ''} ${l.prenom || ''}`);
    const fullWords = new Set(normFull.split(' ').filter(Boolean));

    // Exact full name match
    if (normFolder === normFull) {
      return l;
    }

    const overlap = [...folderWords].filter(w => fullWords.has(w)).length;

    // Check if surname and at least one firstname match
    const normNom = normalizeText(l.nom || '');
    const nomWords = new Set(normNom.split(' ').filter(Boolean));
    if (nomWords.size > 0 && [...nomWords].every(w => folderWords.has(w))) {
      if (overlap > maxOverlap) {
        bestMatch = l;
        maxOverlap = overlap;
      }
    }

    if (overlap >= 2 && overlap > maxOverlap) {
      bestMatch = l;
      maxOverlap = overlap;
    }
  }

  return bestMatch;
}

export function parseNewLearnerName(rawName: string): { nom: string; prenom: string; fullName: string } {
  const words = rawName.trim().split(/\s+/);
  if (!words.length || words[0] === '') {
    return { nom: 'INCONNU', prenom: 'Apprenant', fullName: 'INCONNU Apprenant' };
  }

  // Detect words in all uppercase (surname) vs mixed case (first name)
  const nomWords = words.filter(w => w.replace('.', '').toUpperCase() === w.replace('.', '') && w.replace('.', '').length > 1);
  const prenomWords = words.filter(w => !(w.replace('.', '').toUpperCase() === w.replace('.', '') && w.replace('.', '').length > 1));

  let nom = '';
  let prenom = '';

  if (nomWords.length > 0 && prenomWords.length > 0) {
    nom = nomWords.join(' ');
    prenom = prenomWords.join(' ');
  } else if (nomWords.length > 1 && prenomWords.length === 0) {
    nom = nomWords[nomWords.length - 1];
    prenom = nomWords.slice(0, -1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  } else {
    nom = words[words.length - 1].toUpperCase();
    prenom = words.slice(0, -1).join(' ');
  }

  const fullName = `${nom} ${prenom}`.trim();
  return { nom, prenom, fullName };
}
