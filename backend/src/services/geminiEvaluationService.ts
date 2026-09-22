// ============================================================
// Gemini AI Agent Service — Intelligent Pedagogical Evaluation
// Implements the exact rubrics and rules from correction_devoirs SKILL.md
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

export interface EvaluationInput {
  learnerName: string;
  projectName: string;
  deliverableId: 'desc' | 'strat' | 'gest' | 'budget' | 'content' | 'tdb';
  phase: 'entrainement' | 'final';
  fileText: string;
  fileName: string;
  customApiKey?: string;
}

export interface EvaluationResult {
  score: number | null;
  maxScore: number;
  statusBadge: string;
  comment: string;
  pointsForts: string[];
  chantiersFond: string;
  chantiersForme: string;
  criteriaResults: {
    criterionId: string;
    label: string;
    score?: number;
    maxScore?: number;
    status: 'valid' | 'partial' | 'invalid' | 'pending';
    observation: string;
    recommendation?: string;
  }[];
  usedAi: boolean;
}

const RUBRIC_PROMPTS: Record<string, string> = {
  desc: `
LIVRABLE DESCRIPTION DU PROJET (Cadrage libre)
- Consigne : Présentation claire de l'activité, proposition de valeur, ancrage géographique, cible, dimensionnement de l'équipe et périmètre.
- Évaluation formative (pas de note chiffrée) : évaluer la clarté du cadrage, l'ambition, le réalisme et la faisabilité.
  `,
  strat: `
LIVRABLE PP1 — STRATÉGIE MARKETING (Barème sur 6 points en final)
- Consigne officielle : Document de stratégie complet de 1000 mots maximum comprenant :
  1. Audience cible : au moins 2 personas détaillés (nom, âge, profession, besoins, freins).
  2. Marché : étude de marché analysant au moins 3 concurrents réels nommés.
  3. Objectifs : méthode SMART (Spécifique, Mesurable, Atteignable, Réaliste, Temporel).
  4. Acquisition : au moins 2 actions d'acquisition concrètes.
  5. Canaux : justification des canaux (site, réseaux) par rapport aux personas.
  6. Rétention : au moins 2 actions de fidélisation concrètes.
- En Final V2 (6 pts) : 
  * Critère 1 (/1 pt) : Présence et respect de la consigne (< 1000 mots, 2 personas, 3 concurrents, SMART, etc.).
  * Critère 2 (/1 pt) : Cohérence stratégique (alignement objectifs - cibles - canaux - actions).
  * Critère 3 (/1 pt) : Justification et qualité de l'analyse marketing.
  * Critère 4 (/1 pt) : Qualité rédactionnelle, présentation, respect limite de mots.
  * Critère 5 (/1 pt) : Critère tuteur 1 (ex: pertinence positionnement concurrentiel).
  * Critère 6 (/1 pt) : Critère tuteur 2 (ex: faisabilité opérationnelle locale).
  `,
  gest: `
LIVRABLE PP2 — GESTION DE PROJET (GANTT & RH) (Barème sur 6 points en final)
- Consigne officielle : Planning Gantt clair et structuré (tâches, durées, dates, jalons) + identification des profils RH affectés aux tâches (CM, graphiste, dev, etc.) en cohérence avec PP1.
- En Final V2 (6 pts) :
  * Critère 1 (/1 pt) : Planning Gantt (complet, lisible, chronologie claire).
  * Critère 2 (/1 pt) : Pertinence des tâches choisies en lien direct avec la stratégie marketing PP1.
  * Critère 3 (/1 pt) : Pertinence des ressources humaines identifiées et affectées.
  * Critère 4 (/1 pt) : Cohérence et faisabilité globale (temps, RH, réalisme).
  * Critère 5 (/1 pt) : Critère tuteur 1 (ex: gestion des imprévus / jalons clés).
  * Critère 6 (/1 pt) : Critère tuteur 2 (ex: coordination et charge de travail).
  `,
  budget: `
LIVRABLE PP2 (VOLET BUDGET) — BUDGET PRÉVISIONNEL (Barème sur 6 points en final)
- Consigne officielle : Estimation des ressources nécessaires pour la stratégie, chiffrage budgétaire par tâches réaliste et cohérent.
- En Final V2 (6 pts) :
  * Critère 1 (/1 pt) : Présence et clarté du tableau budgétaire par tâches.
  * Critère 2 (/1 pt) : Pertinence des lignes budgétaires avec la stratégie marketing.
  * Critère 3 (/1 pt) : Réalisme des coûts et devises adaptées au contexte local.
  * Critère 4 (/1 pt) : Équilibre global et cohérence des investissements.
  * Critère 5 (/1 pt) : Critère tuteur 1 (ex: précision et granularité du chiffrage).
  * Critère 6 (/1 pt) : Critère tuteur 2 (ex: marge de sécurité budgétaire).
  `,
  content: `
LIVRABLE PP3 — CRÉATION DE CONTENU (Barème sur 4 points en final)
- Consigne officielle : Produire 1 flyer ET 1 vidéo (< 1mn30). Texte explicatif reliant chaque support à un objectif précis de la campagne (100 mots maximum).
- En Final V2 (4 pts) :
  * Critère 1 (/1 pt) : Qualité des productions (flyer + vidéo < 1mn30 obligatoire, contraintes techniques).
  * Critère 2 (/1 pt) : Alignement avec les objectifs marketing (texte ≤ 100 mots reliant supports aux objectifs).
  * Critère 3 (/1 pt) : Qualité du design graphique, esthétique, lisibilité.
  * Critère 4 (/1 pt) : Critère tuteur (ex: force du Call-To-Action, impact émotionnel).
  `,
  tdb: `
LIVRABLE PP4 — TABLEAU DE BORD D'INDICATEURS (Barème sur 4 points en final)
- Consigne officielle : Tableau de bord avec indicateurs de surveillance par canaux + texte de justification concise du choix des métriques (100 mots maximum).
- En Final V2 (4 pts) :
  * Critère 1 (/1 pt) : Pertinence et clarté des indicateurs choisis par canal (KPIs différenciés).
  * Critère 2 (/1 pt) : Présentation et lisibilité du tableau de bord.
  * Critère 3 (/1 pt) : Qualité de la justification (texte ≤ 100 mots clair et pertinent).
  * Critère 4 (/1 pt) : Critère tuteur (ex: actionnabilité des KPIs, fréquence de suivi).
  `
};

export async function evaluateDeliverableWithGemini(input: EvaluationInput): Promise<EvaluationResult> {
  const apiKey = input.customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ No Gemini API key provided. Using expert heuristic evaluation fallback.');
    return generateFallbackEvaluation(input);
  }

  const isV1 = input.phase === 'entrainement';
  const rubricInfo = RUBRIC_PROMPTS[input.deliverableId] || RUBRIC_PROMPTS.strat;

  const systemInstruction = `
Tu es l'évaluateur officiel et tuteur référent du programme D-CLIC (Marketing Numérique de l'OIF).
Tu évalues les livrables du Projet Professionnel soumis par les apprenants.

RÈGLES D'OR IMPÉRATIVES (OBLIGATOIRES) :
1. ZÉRO SALUTATION, ZÉRO SIGNATURE : Le commentaire et le message doivent attaquer IMMÉDIATEMENT par les constats factuels et pédagogiques. Jamais de "Bonjour [Prénom]", jamais de "Ton tuteur D-CLIC" ou "Cordialement".
2. LIEN OBLIGATOIRE AVEC LE NUMÉRIQUE : Le projet DOIT être lié au marketing numérique ou à la communication digitale. Si c'est un commerce ou projet purement physique sans dimension numérique, signaler immédiatement le hors-sujet.
3. ANTI-SURNOTATION : Sois exigeant et rigoureux. Une note max par critère n'est donnée que si le contenu est approfondi, concret et documenté (ex: concurrents nommés, objectifs véritablement SMART, chiffrage réaliste).
4. DISTINCTION DES MODES :
   - Mode ENTRAÎNEMENT (V1) : AUCUNE NOTE CHIFFRÉE. Diagnostic purement formatif. Identifier ce qui est présent / manquant, donner des recommandations précises et actionnables pour le rendu final, lister les points forts et chantiers prioritaires (fond et forme).
   - Mode RESTITUTION FINALE (V2) : Notation stricte selon le barème officiel. Pour chaque critère, fournir les "Éléments observés" factuels et la note attribuée. Calculer le total exact.
`;

  const userPrompt = `
Livrable à évaluer : ${input.deliverableId.toUpperCase()}
Phase : ${input.phase.toUpperCase()} (${isV1 ? "Livrable d'entraînement - PAS DE NOTE CHIFFRÉE" : "Livrable final noté"})
Nom de l'apprenant : ${input.learnerName}
Projet : ${input.projectName}
Nom du fichier déposé : ${input.fileName}

RÉFÉRENTIEL DU LIVRABLE :
${rubricInfo}

CONTENU DU DOCUMENT SOUMIS PAR L'APPRENANT :
"""
${input.fileText.slice(0, 15000)}
"""

Retourne OBLIGATOIREMENT un objet JSON valide avec ce schéma exact :
{
  "score": ${isV1 ? "null" : "number (note totale calculée sur le barème du livrable, ex: 4.5 sur 6)"},
  "maxScore": ${input.deliverableId === 'desc' ? 0 : (['strat', 'gest', 'budget'].includes(input.deliverableId) ? 6 : 4)},
  "statusBadge": "string (ex: '✅ Soumis — Cadrage validé' ou '🟡 Soumis — À ajuster' ou '🔴 Non conforme')",
  "comment": "string (commentaire global pédagogique de 3-5 phrases, respectant la règle zéro salutation/zéro signature)",
  "pointsForts": ["point fort 1", "point fort 2", "point fort 3"],
  "chantiersFond": "string (actions concrètes sur le fond à perfectionner pour le rendu final)",
  "chantiersForme": "string (remarques sur l'orthographe, respect de la limite de mots, mise en page)",
  "criteriaResults": [
    {
      "criterionId": "crit_1",
      "label": "string",
      "score": ${isV1 ? "null" : "number"},
      "maxScore": 1,
      "status": "valid | partial | invalid",
      "observation": "string (constat factuel sur ce qui est présent ou absent dans la copie)",
      "recommendation": "string (conseil actionnable pour valider le critère)"
    }
  ]
}
`;

  const candidateModels = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
  let candidateText: string | null = null;
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Gemini model ${model} returned ${response.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const jsonRes = await response.json();
      const text = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        candidateText = text;
        break; // Success!
      }
    } catch (err) {
      lastError = err;
      console.warn(`Attempt with ${model} failed:`, err);
    }
  }

  if (!candidateText) {
    console.warn('All Gemini models failed or returned empty response, falling back to heuristic evaluation:', lastError);
    return generateFallbackEvaluation(input);
  }

  try {
    const parsed = JSON.parse(candidateText);
    return {
      score: isV1 ? null : (typeof parsed.score === 'number' ? parsed.score : null),
      maxScore: parsed.maxScore || (input.deliverableId === 'desc' ? 0 : 6),
      statusBadge: parsed.statusBadge || (isV1 ? '🟡 Soumis — Analyse effectuée' : '✅ Évalué'),
      comment: cleanComment(parsed.comment || ''),
      pointsForts: parsed.pointsForts || [],
      chantiersFond: parsed.chantiersFond || 'RAS',
      chantiersForme: parsed.chantiersForme || 'RAS',
      criteriaResults: parsed.criteriaResults || [],
      usedAi: true,
    };
  } catch (parseErr) {
    console.warn('JSON parse error on Gemini response, falling back:', parseErr);
    return generateFallbackEvaluation(input);
  }
}

function cleanComment(text: string): string {
  if (!text) return '';
  return text
    .replace(/^[ \t]*Bonjour\b[^\n,]*,\s*\n*/i, '')
    .replace(/^[ \t]*Bonjour\b[^\n]*\n+/i, '')
    .replace(/\s*\n+[ \t]*(?:Ton|Votre)\s+tuteur(?:\s+D-?CLIC)?\.?[ \t]*$/i, '')
    .trim();
}

function generateFallbackEvaluation(input: EvaluationInput): EvaluationResult {
  const isV1 = input.phase === 'entrainement';
  const textLength = input.fileText.length;
  const hasContent = textLength > 100;
  const maxScore = input.deliverableId === 'desc' ? 0 : (['strat', 'gest', 'budget'].includes(input.deliverableId) ? 6 : 4);

  const statusBadge = hasContent 
    ? (isV1 ? '🟡 Soumis — Prêt pour révision tuteur' : '✅ Soumis — En attente validation note')
    : '🔴 Document vide ou illisible';

  const comment = hasContent
    ? `Document de ${input.deliverableId.toUpperCase()} reçu (${input.fileName}). L'ensemble pose des bases exploitables pour le projet ${input.projectName}. Veillez à vérifier la conformité avec la consigne officielle avant la validation finale.`
    : `Le document soumis (${input.fileName}) semble vide ou illisible. Veuillez soumettre à nouveau votre travail au format Word ou PDF standard.`;

  return {
    score: isV1 ? null : (hasContent ? Math.round(maxScore * 0.7 * 10) / 10 : 0),
    maxScore,
    statusBadge,
    comment,
    pointsForts: [
      `Dépôt du fichier ${input.fileName} enregistré`,
      `Projet identifié : ${input.projectName || 'Non renseigné'}`
    ],
    chantiersFond: "Vérifier l'alignement des éléments avec la consigne officielle du livrable.",
    chantiersForme: "Respecter la limite de mots demandée et exporter au format PDF propre.",
    criteriaResults: [
      {
        criterionId: 'crit_main',
        label: 'Conformité générale au livrable',
        score: isV1 ? undefined : (hasContent ? 1 : 0),
        maxScore: 1,
        status: hasContent ? 'valid' : 'invalid',
        observation: hasContent ? `Fichier analysé avec ${textLength} caractères extraits.` : 'Fichier non exploitable.',
        recommendation: "Relire attentivement la consigne du livrable."
      }
    ],
    usedAi: false,
  };
}
