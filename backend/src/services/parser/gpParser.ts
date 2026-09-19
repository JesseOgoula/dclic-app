import { isAssignment } from './moodleParser.js';

export function isGPAssignment(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('livrable') ||
    lower.includes('portfolio')
  );
}

export function extractGPActivityMetadata(activityNames: string[]): Array<{
  code: string;
  name: string;
  sequence: string;
  type: 'exercise' | 'quiz' | 'devoir' | 'documentation';
  is_evaluated: boolean;
  display_order: number;
  formation_type: string;
}> {
  return activityNames.map((name, index) => {
    const code = `GP_ACT_${index}`;
    const lowerName = name.toLowerCase();
    
    let sequence = 'Autre';
    if (
      lowerName.includes('posture stratégique') ||
      lowerName.includes('posture strategique') ||
      lowerName.includes('audit 360') ||
      lowerName.includes('données comportementales') ||
      lowerName.includes('donnees comportementales') ||
      lowerName.includes('plateforme de marque') ||
      lowerName.includes('mission direction de projet') ||
      lowerName.includes("rapport d'audit et de recommandations") ||
      lowerName.includes("document de plateforme de marque")
    ) {
      sequence = 'Séquence 1 : Diagnostic & Positionnement';
    } else if (
      (lowerName.includes("plan d'action") && !lowerName.includes("plan de lancement")) ||
      lowerName.includes('planning') ||
      lowerName.includes('gantt') ||
      lowerName.includes('budget') ||
      lowerName.includes('tableurs') ||
      lowerName.includes('mission chiffrage') ||
      lowerName.includes('fichier de suivi budgétaire') ||
      lowerName.includes('fichier de suivi budgetaire')
    ) {
      sequence = 'Séquence 2 : Planification & Budget';
    } else if (
      lowerName.includes('brief créatif') ||
      lowerName.includes('brief creatif') ||
      lowerName.includes('cahier des charges') ||
      lowerName.includes('prestataires') ||
      lowerName.includes('suivi collaboratif') ||
      lowerName.includes('réunions') ||
      lowerName.includes('reunions') ||
      lowerName.includes("mission chef d'orchestre") ||
      lowerName.includes('document créatif complet') ||
      lowerName.includes('document creatif complet') ||
      lowerName.includes('animation de réunion') ||
      lowerName.includes('animation de reunion') ||
      lowerName.includes('compte rendu')
    ) {
      sequence = 'Séquence 3 : Pilotage opérationnel';
    } else if (
      lowerName.includes('penser à 360') ||
      lowerName.includes('penser a 360') ||
      lowerName.includes('relations publiques') ||
      lowerName.includes('événementiel') ||
      lowerName.includes('evenementiel') ||
      lowerName.includes('partenariats') ||
      lowerName.includes('mission plan de lancement') ||
      lowerName.includes('plan de lancement 360') ||
      lowerName.includes('retroplanning')
    ) {
      sequence = 'Séquence 4 : Déploiement 360°';
    } else if (
      lowerName.includes('indicateurs') ||
      lowerName.includes('rentabilité') ||
      lowerName.includes('rentabilite') ||
      lowerName.includes('construire son tableau de bord') ||
      lowerName.includes('présenter un rapport') ||
      lowerName.includes('presenter un rapport') ||
      lowerName.includes('mission bilan') ||
      (lowerName.includes('tableau de bord') && lowerName.includes('livrable')) ||
      lowerName.includes("rapport d'activité") ||
      lowerName.includes("rapport d'activite")
    ) {
      sequence = 'Séquence 5 : Mesure & Reporting';
    } else if (
      lowerName.includes('description du projet') ||
      lowerName.includes("livrable d'entraînement") ||
      lowerName.includes("livrable d'entrainement") ||
      lowerName.includes('livrable final') ||
      lowerName.includes('portfolio')
    ) {
      sequence = 'Projet professionnel';
    } else if (lowerName.includes('tableau de bord') && !lowerName.includes('construire')) {
      sequence = 'Séquence 5 : Mesure & Reporting'; // Fallback
    }

    let type: 'exercise' | 'quiz' | 'devoir' | 'documentation' = 'exercise';
    let is_evaluated = false;

    if (isGPAssignment(name)) {
      type = 'devoir';
      is_evaluated = true;
    } else if (lowerName.includes('description du projet')) {
      type = 'documentation';
      is_evaluated = false;
    } else if (lowerName.includes('mission') || lowerName.includes('module')) {
      type = 'exercise';
      is_evaluated = false;
    }

    return {
      code,
      name: name.trim(),
      sequence,
      type,
      is_evaluated,
      display_order: index,
      formation_type: 'gp'
    };
  });
}
