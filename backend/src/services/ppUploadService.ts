// ============================================================
// PP Upload Service — Moodle ZIP Extraction & Stateful Processing
// Preserves already validated evaluations across uploads
// ============================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { supabase } from './store.js';
import { matchLearnerName, parseNewLearnerName } from './learnerMatchingService.js';
import { extractTextFromFile } from './textExtractor.js';
import { evaluateDeliverableWithGemini } from './geminiEvaluationService.js';

export interface PPUploadOptions {
  zipFilePath: string;
  deliverableId: 'desc' | 'strat' | 'gest' | 'budget' | 'content' | 'tdb';
  phase: 'entrainement' | 'final';
  autoEvaluate?: boolean;
  geminiApiKey?: string;
}

export interface PPUploadSummary {
  deliverableId: string;
  phase: string;
  totalSubmissionsFound: number;
  alreadyValidatedSkipped: number;
  newEvaluations: number;
  revisionsDetected: number;
  details: {
    learnerName: string;
    action: 'skipped_validated' | 'evaluated_by_ai' | 'pending_evaluation' | 'revision_detected';
    message: string;
    files: string[];
  }[];
}

export async function processPPMoodleZip(options: PPUploadOptions): Promise<PPUploadSummary> {
  const { zipFilePath, deliverableId, phase, autoEvaluate = false, geminiApiKey } = options;

  if (!fs.existsSync(zipFilePath)) {
    throw new Error(`Fichier ZIP introuvable: ${zipFilePath}`);
  }

  const tempExtractDir = path.join(process.cwd(), 'uploads', `pp_temp_${Date.now()}`);
  fs.mkdirSync(tempExtractDir, { recursive: true });

  const summary: PPUploadSummary = {
    deliverableId,
    phase,
    totalSubmissionsFound: 0,
    alreadyValidatedSkipped: 0,
    newEvaluations: 0,
    revisionsDetected: 0,
    details: [],
  };

  try {
    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(tempExtractDir, true);

    // Fetch existing PP learners from Supabase
    const { data: existingPPLearners } = await supabase.from('pp_learners').select('*');
    const ppLearnersList = existingPPLearners || [];

    // Fetch existing evaluations for this deliverable & phase
    const { data: existingEvals } = await supabase
      .from('pp_evaluations')
      .select('*')
      .eq('deliverable_id', deliverableId)
      .eq('phase', phase);
    const evalsMap = new Map((existingEvals || []).map(e => [e.learner_id, e]));

    // Find submission directories (recursively or directly)
    const submissionDirs: string[] = [];
    function scanDir(currentDir: string) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.includes('_assignsubmission_file') || entry.name.includes('_')) {
            submissionDirs.push(fullPath);
          } else {
            scanDir(fullPath);
          }
        }
      }
    }
    scanDir(tempExtractDir);

    summary.totalSubmissionsFound = submissionDirs.length;

    for (const subDir of submissionDirs) {
      const folderName = path.basename(subDir);
      const cleanFolderName = folderName.split('_')[0].trim();

      // List all files in the learner's submission folder
      const filesInFolder = fs.readdirSync(subDir).filter(f => !f.startsWith('.') && fs.statSync(path.join(subDir, f)).isFile());
      if (filesInFolder.length === 0) continue;

      // Compute composite file hash and metadata
      const fileMetaList: { name: string; size: number; mtime: string; hash: string }[] = [];
      const hashAccumulator = crypto.createHash('sha256');

      for (const f of filesInFolder) {
        const fPath = path.join(subDir, f);
        const stats = fs.statSync(fPath);
        const fileBuf = fs.readFileSync(fPath);
        const fHash = crypto.createHash('md5').update(fileBuf).digest('hex');
        hashAccumulator.update(fHash);

        fileMetaList.push({
          name: f,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          hash: fHash,
        });
      }
      const compositeHash = hashAccumulator.digest('hex');

      // Match learner or create new
      let matchedLearner = matchLearnerName(folderName, ppLearnersList);
      if (!matchedLearner) {
        const { nom, prenom, fullName } = parseNewLearnerName(cleanFolderName);
        const newId = `apprenant_${String(ppLearnersList.length + 1).padStart(2, '0')}`;
        const newLearnerRow = {
          id: newId,
          num: String(ppLearnersList.length + 1).padStart(2, '0'),
          nom,
          prenom,
          full_name: fullName,
          projet: 'Projet à préciser',
          category: 'yellow',
          category_label: 'Nouveau dépôt',
          group_id: 'G1_MN_072026',
        };
        await supabase.from('pp_learners').insert([newLearnerRow]);
        matchedLearner = newLearnerRow;
        ppLearnersList.push(newLearnerRow);
      }

      const existingEval = evalsMap.get(matchedLearner.id);

      // ============================================================
      // MEMORY & STATEFUL PERSISTENCE CHECK:
      // If already validated and the files haven't changed -> PRESERVE & SKIP!
      // ============================================================
      if (existingEval && existingEval.is_locked && existingEval.file_hash === compositeHash) {
        summary.alreadyValidatedSkipped++;
        summary.details.push({
          learnerName: matchedLearner.full_name || cleanFolderName,
          action: 'skipped_validated',
          message: 'Devoir déjà validé par le tuteur. Fichier identique conservé intact.',
          files: filesInFolder,
        });
        continue;
      }

      // If already validated but the learner uploaded a new version
      if (existingEval && existingEval.is_locked && existingEval.file_hash && existingEval.file_hash !== compositeHash) {
        summary.revisionsDetected++;
        summary.details.push({
          learnerName: matchedLearner.full_name || cleanFolderName,
          action: 'revision_detected',
          message: 'Nouvelle version du document détectée. Conserve l’ancienne note jusqu’à réévaluation.',
          files: filesInFolder,
        });
        // Update files without losing existing validated comment unless requested
        await supabase.from('pp_evaluations').update({
          files: fileMetaList,
          file_hash: compositeHash,
          updated_at: new Date().toISOString(),
        }).eq('id', existingEval.id);
        continue;
      }

      // New or unvalidated submission -> Process text & optionally evaluate with Gemini
      let extractedText = '';
      for (const f of filesInFolder) {
        const fPath = path.join(subDir, f);
        const text = await extractTextFromFile(fPath);
        extractedText += `\n--- [Fichier: ${f}] ---\n${text}\n`;
      }

      let evalDataToSave: any = {
        learner_id: matchedLearner.id,
        deliverable_id: deliverableId,
        phase,
        submitted: true,
        files: fileMetaList,
        file_hash: compositeHash,
        updated_at: new Date().toISOString(),
      };

      if (autoEvaluate) {
        const aiResult = await evaluateDeliverableWithGemini({
          learnerName: matchedLearner.full_name || cleanFolderName,
          projectName: (matchedLearner as any).projet || '',
          deliverableId,
          phase,
          fileText: extractedText,
          fileName: filesInFolder.join(', '),
          customApiKey: geminiApiKey,
        });

        evalDataToSave = {
          ...evalDataToSave,
          status: aiResult.statusBadge,
          score: aiResult.score,
          max_score: aiResult.maxScore,
          comment: aiResult.comment,
          criteria_results: {
            points_forts: aiResult.pointsForts,
            chantiers_fond: aiResult.chantiersFond,
            chantiers_forme: aiResult.chantiersForme,
            criteria: aiResult.criteriaResults,
          },
          evaluation_status: 'ai_evaluated',
          is_locked: false, // Open for tutor review & confirmation
          evaluated_at: new Date().toISOString(),
          evaluated_by: aiResult.usedAi ? 'agent_gemini' : 'system_heuristic',
        };

        summary.newEvaluations++;
        summary.details.push({
          learnerName: matchedLearner.full_name || cleanFolderName,
          action: 'evaluated_by_ai',
          message: aiResult.usedAi ? 'Évalué automatiquement par l’Agent Gemini.' : 'Pré-analysé avec grille de secours.',
          files: filesInFolder,
        });
      } else {
        evalDataToSave = {
          ...evalDataToSave,
          status: '🟡 Soumis — En attente d’évaluation',
          evaluation_status: 'pending',
          is_locked: false,
          comment: existingEval?.comment || '',
        };

        summary.newEvaluations++;
        summary.details.push({
          learnerName: matchedLearner.full_name || cleanFolderName,
          action: 'pending_evaluation',
          message: 'Fichiers enregistrés avec succès. Prêt pour l’évaluation.',
          files: filesInFolder,
        });
      }

      // Upsert into Supabase
      await supabase.from('pp_evaluations').upsert(evalDataToSave, {
        onConflict: 'learner_id,deliverable_id,phase',
      });
    }

    return summary;
  } finally {
    // Cleanup temporary extract directory
    try {
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.warn('Could not remove temp extract directory:', cleanupErr);
    }
  }
}
