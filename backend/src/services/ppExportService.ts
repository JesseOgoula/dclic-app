// ============================================================
// PP Export Service — Excel XLSX Matrix & Report Generation
// ============================================================

import xlsx from 'xlsx';
import { supabase } from './store.js';

export async function generatePPExcelReport(): Promise<Buffer> {
  // Fetch all PP learners with their evaluations
  const { data: learners } = await supabase
    .from('pp_learners')
    .select('*')
    .order('num', { ascending: true });

  const { data: evaluations } = await supabase
    .from('pp_evaluations')
    .select('*');

  const evals = evaluations || [];
  const learnersList = learners || [];

  // Group evals by learner_id -> deliverable_id -> phase
  const evalLookup = new Map<string, any>();
  for (const e of evals) {
    const key = `${e.learner_id}_${e.deliverable_id}_${e.phase}`;
    evalLookup.set(key, e);
  }

  // ------------------------------------------------------------
  // Sheet 1: General Matrix
  // ------------------------------------------------------------
  const matrixRows = learnersList.map(l => {
    const getScore = (delivId: string, phase: 'entrainement' | 'final') => {
      const entry = evalLookup.get(`${l.id}_${delivId}_${phase}`);
      if (!entry || !entry.submitted) return '—';
      if (phase === 'final') return entry.score !== null ? entry.score : 'Soumis (non noté)';
      return entry.status?.includes('✅') ? 'Validé' : (entry.status?.includes('🟡') ? 'À ajuster' : 'Soumis');
    };

    const stratV2 = evalLookup.get(`${l.id}_strat_final`)?.score ?? 0;
    const gestV2 = evalLookup.get(`${l.id}_gest_final`)?.score ?? 0;
    const budgetV2 = evalLookup.get(`${l.id}_budget_final`)?.score ?? 0;
    const contentV2 = evalLookup.get(`${l.id}_content_final`)?.score ?? 0;
    const tdbV2 = evalLookup.get(`${l.id}_tdb_final`)?.score ?? 0;

    const totalV2 = (stratV2 + gestV2 + budgetV2 + contentV2 + tdbV2);

    return {
      'N°': l.num,
      'Nom': l.nom,
      'Prénom': l.prenom,
      'Projet Professionnel': l.projet || 'Non renseigné',
      'Catégorie': l.category === 'green' ? 'Complet (Vert)' : (l.category === 'yellow' ? 'Partiel (Jaune)' : 'En retard (Rouge)'),
      'Desc (V1)': getScore('desc', 'entrainement'),
      'Stratégie PP1 (V1)': getScore('strat', 'entrainement'),
      'Gantt PP2 (V1)': getScore('gest', 'entrainement'),
      'Budget PP2 (V1)': getScore('budget', 'entrainement'),
      'Contenu PP3 (V1)': getScore('content', 'entrainement'),
      'Tableau Bord PP4 (V1)': getScore('tdb', 'entrainement'),
      'Stratégie PP1 (/6)': getScore('strat', 'final'),
      'Gantt PP2 (/6)': getScore('gest', 'final'),
      'Budget PP2 (/6)': getScore('budget', 'final'),
      'Contenu PP3 (/4)': getScore('content', 'final'),
      'Tableau Bord PP4 (/4)': getScore('tdb', 'final'),
      'Note Finale (/20)': totalV2 > 0 ? totalV2 : 'En attente',
      'Statut / Orientation': l.status_priority || '',
    };
  });

  // ------------------------------------------------------------
  // Sheet 2: Detailed Feedbacks
  // ------------------------------------------------------------
  const feedbackRows: any[] = [];
  const delivTitles: Record<string, string> = {
    desc: 'Description du projet',
    strat: 'Stratégie Marketing (PP1)',
    gest: 'Gestion de Projet Gantt & RH (PP2)',
    budget: 'Budget Prévisionnel (PP2)',
    content: 'Création de Contenu (PP3)',
    tdb: 'Tableau de Bord (PP4)',
  };

  for (const l of learnersList) {
    for (const delivId of ['desc', 'strat', 'gest', 'budget', 'content', 'tdb']) {
      for (const phase of ['entrainement', 'final'] as const) {
        const entry = evalLookup.get(`${l.id}_${delivId}_${phase}`);
        if (!entry || !entry.submitted) continue;

        feedbackRows.push({
          'N°': l.num,
          'Apprenant': l.full_name,
          'Projet': l.projet,
          'Livrable': delivTitles[delivId] || delivId,
          'Phase': phase === 'entrainement' ? 'Phase 1 — Entraînement (V1)' : 'Phase 2 — Restitution Finale (V2)',
          'Statut Validation': entry.is_locked ? 'Validé par le tuteur' : (entry.evaluation_status === 'ai_evaluated' ? 'Évalué par IA (à valider)' : 'En attente'),
          'Note': entry.score !== null ? `${entry.score} / ${entry.max_score}` : '— (Sans note)',
          'Commentaire / Diagnostic': entry.comment || 'Aucun commentaire',
          'Fichiers joints': (entry.files || []).map((f: any) => f.name).join(', '),
        });
      }
    }
  }

  const wb = xlsx.utils.book_new();
  const wsMatrix = xlsx.utils.json_to_sheet(matrixRows);
  const wsFeedbacks = xlsx.utils.json_to_sheet(feedbackRows);

  xlsx.utils.book_append_sheet(wb, wsMatrix, 'Matrice_des_Notes');
  xlsx.utils.book_append_sheet(wb, wsFeedbacks, 'Feedbacks_Détaillés');

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
