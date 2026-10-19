// ============================================================
// Upload Processing Service (Supabase High-Performance Async Version)
// Orchestrates CSV/Excel/MD parsing → batch data store ingestion
// ============================================================

import path from 'path';
import fs from 'fs';
import {
  parseProgressCSV,
  parseParticipantsXLSX,
  extractActivityMetadata,
  isAssignment,
} from './parser/moodleParser.js';
import { parseParticipantsMD, parseRelativeTime, parseRawParticipantsText } from './parser/mdParser.js';
import {
  parseRawGradebookText,
  cleanMoodleLearnerName,
  normalizeActivityNameForMatch,
} from './parser/gradebookParser.js';
import { store, supabase } from './store.js';
import type { UploadResult, Learner, Activity, LearnerProgress, GradebookComparison } from '../types.js';

const TARGET_GROUPS = ['G1_MN_072026', 'G1_GPM_092026'];

/**
 * Helper to resolve formation accurately:
 * 1. Checks filename markers (Strongest signal: a file named progress.mn... is always MN)
 * 2. Checks distinctive activity names
 * 3. Falls back to targetFormation from UI if provided
 * 4. Default fallback: 'mn'
 */
function resolveFormation(
  targetFormation?: 'mn' | 'gp',
  filename?: string,
  activityNames?: string[]
): 'mn' | 'gp' {
  const lowerName = (filename || '').toLowerCase();

  // 1. Strong filename signals take priority over UI dropdown selection
  if (lowerName.includes('gpm') || lowerName.includes('gp_2026') || lowerName.includes('gp_') || lowerName.includes('gestion') || lowerName.includes('projet')) {
    return 'gp';
  }
  if (lowerName.includes('mn_') || lowerName.includes('mn.') || lowerName.includes('courseidmn') || lowerName.includes('marketing')) {
    return 'mn';
  }

  // 2. Activity content markers
  if (activityNames && activityNames.length > 0) {
    const isGP = activityNames.some(n =>
      n.includes('posture stratégique') ||
      n.includes('Mission direction de projet') ||
      n.includes('plan de lancement 360') ||
      n.includes("Livrable d'entraînement") ||
      n.includes("Livrable d’entraînement") ||
      n.startsWith('Module 1 :')
    );
    if (isGP) return 'gp';

    const isMN = activityNames.some(n =>
      n.startsWith('M1A.') ||
      n.startsWith('M1B.') ||
      n.startsWith('M2A.') ||
      n.startsWith('M3A.') ||
      n.startsWith('M4A.') ||
      n.includes('marketing numérique')
    );
    if (isMN) return 'mn';
  }

  // 3. Fallback to user UI selection if provided
  if (targetFormation === 'gp' || targetFormation === 'mn') {
    return targetFormation;
  }

  return 'mn'; // Default fallback
}

/**
 * Process an uploaded file — determines type and ingests data with high throughput.
 */
export async function processUpload(
  filePath: string,
  filename: string,
  targetFormation?: 'mn' | 'gp'
): Promise<UploadResult> {
  const ext = path.extname(filename).toLowerCase();
  const fileTypeMap: Record<string, 'csv' | 'xlsx' | 'md'> = {
    '.csv': 'csv',
    '.xlsx': 'xlsx',
    '.xls': 'xlsx',
    '.md': 'md',
  };
  const upload = await store.addUpload(filename, fileTypeMap[ext] || 'csv');

  try {
    // Non-blocking upload to Supabase storage
    try {
      const fileContent = fs.readFileSync(filePath);
      const storagePath = `${Date.now()}_${filename}`;
      await supabase.storage.from('uploads').upload(storagePath, fileContent);
    } catch (storageErr) {
      // Storage backup failure is non-fatal
    }

    let result: UploadResult;

    if (ext === '.csv') {
      result = await processProgressCSV(filePath, upload.id, targetFormation, filename);
    } else if (ext === '.xlsx' || ext === '.xls') {
      result = await processParticipantsXLSX(filePath, upload.id, targetFormation, filename);
    } else if (ext === '.md') {
      result = await processParticipantsMD(filePath, upload.id, targetFormation, filename);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const resolvedFormation = result.formation || targetFormation || 'mn';
    const stats = await store.getDashboardStats(resolvedFormation);

    await store.updateUpload(upload.id, {
      rows_processed: result.rows_processed,
      status: 'processed',
      completion_rate: stats.completion_rate,
    });

    return result;
  } catch (error) {
    console.error('[UploadService] Error:', error);
    await store.updateUpload(upload.id, { status: 'error' });
    throw error;
  } finally {
    // Clean up local temp file
    if (fs.existsSync(filePath) && filePath.includes('uploads')) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete temporary file ${filePath}:`, err);
      }
    }
  }
}

/**
 * High-performance batch processing for Moodle progress CSV.
 */
async function processProgressCSV(
  filePath: string,
  uploadId: string,
  targetFormation?: 'mn' | 'gp',
  originalFilename?: string
): Promise<UploadResult> {
  const rows = parseProgressCSV(filePath);

  if (rows.length === 0) {
    return {
      upload_id: uploadId,
      filename: originalFilename || path.basename(filePath),
      rows_processed: 0,
      learners_created: 0,
      learners_updated: 0,
      progress_records: 0,
      errors: ['No data rows found in CSV'],
      formation: targetFormation,
    };
  }

  // 1. Detect formation accurately
  const rawActivityNames = rows[0].activities.map(a => a.name);
  const detectedFormation = resolveFormation(targetFormation, originalFilename || filePath, rawActivityNames);
  const targetGroup = detectedFormation === 'gp' ? 'G1_GPM_092026' : 'G1_MN_072026';

  // 2. Fetch existing activities and safely insert/update
  const existingActivities = await store.getActivities(detectedFormation, true);
  const existingByName = new Map(existingActivities.map(a => [a.name, a]));
  const existingByCode = new Map(existingActivities.map(a => [a.code, a]));

  const activityMeta = extractActivityMetadata(rawActivityNames, detectedFormation);
  const activitiesToInsert: any[] = [];
  const activitiesToUpdate: any[] = [];

  for (const meta of activityMeta) {
    const existing = existingByName.get(meta.name) || existingByCode.get(meta.code);
    if (!existing) {
      activitiesToInsert.push({
        ...meta,
        formation_type: detectedFormation,
      });
    } else {
      activitiesToUpdate.push({
        id: existing.id,
        ...meta,
        formation_type: detectedFormation,
      });
    }
  }

  if (activitiesToInsert.length > 0) {
    for (let i = 0; i < activitiesToInsert.length; i += 50) {
      const chunk = activitiesToInsert.slice(i, i + 50);
      const { error: actInsErr } = await supabase.from('activities').insert(chunk);
      if (actInsErr) {
        console.warn('[Upload] Activity insert warning:', actInsErr.message);
      }
    }
  }

  if (activitiesToUpdate.length > 0) {
    for (let i = 0; i < activitiesToUpdate.length; i += 50) {
      const chunk = activitiesToUpdate.slice(i, i + 50);
      const { error: actUpErr } = await supabase.from('activities').upsert(chunk, { onConflict: 'id' });
      if (actUpErr) {
        console.warn('[Upload] Activity update warning:', actUpErr.message);
      }
    }
  }

  let learnersCreated = 0;
  let learnersUpdated = 0;
  let progressRecords = 0;
  const errors: string[] = [];

  // 3. Load existing learners for this formation
  const allLearners = await store.getLearners(detectedFormation, true);
  const learnerMap = new Map<string, Learner>(
    allLearners.map(l => [l.email.trim().toLowerCase(), l])
  );

  // 4. Batch prepare learners to upsert from CSV (authoritative source of enrolled learners)
  const learnersToUpsert: any[] = [];
  const rowsToProcess: typeof rows = [];

  for (const row of rows) {
    const emailNorm = row.email.trim().toLowerCase();
    if (!emailNorm || !emailNorm.includes('@')) continue;

    rowsToProcess.push(row);

    const nameParts = row.name.trim().split(/\s+/);
    const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0] || 'Apprenant';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    const timestamps = row.activities
      .filter(a => a.completed_at)
      .map(a => new Date(a.completed_at!).getTime())
      .filter(t => !isNaN(t));
    const lastActivity = timestamps.length > 0
      ? new Date(Math.max(...timestamps)).toISOString()
      : null;

    const existing = learnerMap.get(emailNorm);
    const learnerObj = {
      ...(existing?.id ? { id: existing.id } : {}),
      first_name: existing?.first_name || firstName,
      last_name: existing?.last_name || lastName,
      email: emailNorm,
      group_id: targetGroup,
      last_activity_at: lastActivity || existing?.last_activity_at || null,
      status: existing?.status || 'active',
    };

    learnersToUpsert.push(learnerObj);
    if (existing) learnersUpdated++;
    else learnersCreated++;
  }

  // 5. Batch upsert learners into Supabase
  for (let i = 0; i < learnersToUpsert.length; i += 50) {
    const chunk = learnersToUpsert.slice(i, i + 50);
    const { error: lErr } = await supabase.from('learners').upsert(chunk, { onConflict: 'email' });
    if (lErr) {
      errors.push(`Erreur enregistrement apprenants: ${lErr.message}`);
    }
  }

  // 6. Refresh learners & activities to map IDs
  const refreshedLearners = await store.getLearners(detectedFormation, true);
  const refreshedLearnerMap = new Map<string, Learner>(
    refreshedLearners.map(l => [l.email.trim().toLowerCase(), l])
  );

  const allActivities = await store.getActivities(detectedFormation, true);
  const activityByName = new Map<string, Activity>(allActivities.map(a => [a.name, a]));
  const activityByCode = new Map<string, Activity>(allActivities.map(a => [a.code, a]));

  // 7. Load all existing progress records into memory map
  const allExistingProgress = await store.getAllProgress(true);
  const existingProgressMap = new Map<string, LearnerProgress>();
  for (const p of allExistingProgress) {
    existingProgressMap.set(`${p.learner_id}:${p.activity_id}`, p);
  }

  // 8. Build progress lists: toInsert and toUpdate
  const toInsertProgress: any[] = [];
  const toUpdateProgress: any[] = [];
  let totalMatchedProgress = 0;

  for (const row of rowsToProcess) {
    const emailNorm = row.email.trim().toLowerCase();
    const learner = refreshedLearnerMap.get(emailNorm);
    if (!learner) continue;

    for (const act of row.activities) {
      const meta = activityMeta.find(m => m.name === act.name);
      const activity = activityByName.get(act.name) || (meta ? activityByCode.get(meta.code) : undefined);
      if (!activity) continue;

      totalMatchedProgress++;
      const status = act.status as 'completed' | 'not_completed' | 'passed';
      const key = `${learner.id}:${activity.id}`;
      const existing = existingProgressMap.get(key);

      if (!existing) {
        toInsertProgress.push({
          learner_id: learner.id,
          activity_id: activity.id,
          status,
          completed_at: act.completed_at || null,
          grade: null,
          upload_id: uploadId,
        });
      } else if (existing.status !== status || existing.completed_at !== act.completed_at) {
        toUpdateProgress.push({
          id: existing.id,
          learner_id: learner.id,
          activity_id: activity.id,
          status,
          completed_at: act.completed_at || null,
          grade: existing.grade,
          upload_id: uploadId,
        });
      }
    }
  }

  // 9. Batch insert/update progress records with parallel chunk execution
  const chunkSize = 500;
  const BATCH_CONCURRENCY = 4;

  if (toInsertProgress.length > 0) {
    const insertChunks: any[][] = [];
    for (let i = 0; i < toInsertProgress.length; i += chunkSize) {
      insertChunks.push(toInsertProgress.slice(i, i + chunkSize));
    }
    for (let i = 0; i < insertChunks.length; i += BATCH_CONCURRENCY) {
      const batch = insertChunks.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.all(batch.map(c => supabase.from('progress').insert(c)));
      for (const res of results) {
        if (res.error) {
          console.error('[Upload] Progress insert error:', res.error.message);
          errors.push(`Erreur insertion progression: ${res.error.message}`);
        }
      }
    }
  }

  if (toUpdateProgress.length > 0) {
    const updateChunks: any[][] = [];
    for (let i = 0; i < toUpdateProgress.length; i += chunkSize) {
      updateChunks.push(toUpdateProgress.slice(i, i + chunkSize));
    }
    for (let i = 0; i < updateChunks.length; i += BATCH_CONCURRENCY) {
      const batch = updateChunks.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.all(batch.map(c => supabase.from('progress').upsert(c, { onConflict: 'id' })));
      for (const res of results) {
        if (res.error) {
          console.error('[Upload] Progress update error:', res.error.message);
          errors.push(`Erreur mise à jour progression: ${res.error.message}`);
        }
      }
    }
  }

  progressRecords = (toInsertProgress.length + toUpdateProgress.length) || totalMatchedProgress;

  // 10. Invalidate cache for instantaneous subsequent page loads
  store.invalidateCache(detectedFormation);

  return {
    upload_id: uploadId,
    filename: originalFilename || path.basename(filePath),
    rows_processed: rowsToProcess.length,
    learners_created: learnersCreated,
    learners_updated: learnersUpdated,
    progress_records: progressRecords,
    errors,
    formation: detectedFormation,
  };
}

/**
 * Fast batch processing for participants XLSX.
 */
async function processParticipantsXLSX(
  filePath: string,
  uploadId: string,
  targetFormation?: 'mn' | 'gp',
  originalFilename?: string
): Promise<UploadResult> {
  const allParticipants = parseParticipantsXLSX(filePath);
  const detectedFormation = resolveFormation(targetFormation, originalFilename || filePath);
  const targetGroup = detectedFormation === 'gp' ? 'G1_GPM_092026' : 'G1_MN_072026';

  const g1Participants = allParticipants.filter(p =>
    TARGET_GROUPS.includes(p.group) ||
    p.group.startsWith('G1_') ||
    !p.group ||
    p.group.includes(detectedFormation.toUpperCase())
  );

  let learnersCreated = 0;
  let learnersUpdated = 0;
  const errors: string[] = [];

  const existingLearners = await store.getLearners(detectedFormation, true);
  const existingMap = new Map(existingLearners.map(l => [l.email.trim().toLowerCase(), l]));

  const learnersToUpsert = g1Participants.map(p => {
    const emailNorm = p.email.trim().toLowerCase();
    const existing = existingMap.get(emailNorm);
    const groupToAssign = p.group && p.group.startsWith('G1_') ? p.group : targetGroup;
    if (existing) learnersUpdated++;
    else learnersCreated++;

    return {
      ...(existing?.id ? { id: existing.id } : {}),
      first_name: p.first_name,
      last_name: p.last_name,
      email: emailNorm,
      group_id: groupToAssign,
      last_activity_at: existing?.last_activity_at || null,
      status: existing?.status || 'active',
    };
  });

  for (let i = 0; i < learnersToUpsert.length; i += 50) {
    const chunk = learnersToUpsert.slice(i, i + 50);
    const { error: upsertErr } = await supabase
      .from('learners')
      .upsert(chunk, { onConflict: 'email' });
    if (upsertErr) {
      errors.push(`Erreur enregistrement apprenants: ${upsertErr.message}`);
    }
  }

  store.invalidateCache(detectedFormation);

  return {
    upload_id: uploadId,
    filename: originalFilename || path.basename(filePath),
    rows_processed: g1Participants.length,
    learners_created: learnersCreated,
    learners_updated: learnersUpdated,
    progress_records: 0,
    errors,
    formation: detectedFormation,
  };
}

/**
 * Fast batch processing for participants MD.
 */
async function processParticipantsMD(
  filePath: string,
  uploadId: string,
  targetFormation?: 'mn' | 'gp',
  originalFilename?: string
): Promise<UploadResult> {
  const allParticipants = parseParticipantsMD(filePath);
  const detectedFormation = resolveFormation(targetFormation, originalFilename || filePath);
  const targetGroup = detectedFormation === 'gp' ? 'G1_GPM_092026' : 'G1_MN_072026';

  const g1Participants = allParticipants.filter(p =>
    TARGET_GROUPS.includes(p.group) ||
    p.group.startsWith('G1_') ||
    !p.group ||
    p.group.includes(detectedFormation.toUpperCase())
  );

  let learnersCreated = 0;
  let learnersUpdated = 0;
  const errors: string[] = [];

  const existingLearners = await store.getLearners(detectedFormation, true);
  const existingMap = new Map(existingLearners.map(l => [l.email.trim().toLowerCase(), l]));

  const learnersToUpsert = g1Participants.map(p => {
    const emailNorm = p.email.trim().toLowerCase();
    const existing = existingMap.get(emailNorm);
    const groupToAssign = p.group && p.group.startsWith('G1_') ? p.group : targetGroup;
    if (existing) learnersUpdated++;
    else learnersCreated++;

    return {
      ...(existing?.id ? { id: existing.id } : {}),
      first_name: p.first_name,
      last_name: p.last_name,
      email: emailNorm,
      group_id: groupToAssign,
      last_activity_at: p.last_access ? parseRelativeTime(p.last_access) : (existing?.last_activity_at || null),
      status: existing?.status || 'active',
    };
  });

  for (let i = 0; i < learnersToUpsert.length; i += 50) {
    const chunk = learnersToUpsert.slice(i, i + 50);
    const { error: upsertErr } = await supabase
      .from('learners')
      .upsert(chunk, { onConflict: 'email' });
    if (upsertErr) {
      errors.push(`Erreur enregistrement apprenants: ${upsertErr.message}`);
    }
  }

  store.invalidateCache(detectedFormation);

  return {
    upload_id: uploadId,
    filename: originalFilename || path.basename(filePath),
    rows_processed: g1Participants.length,
    learners_created: learnersCreated,
    learners_updated: learnersUpdated,
    progress_records: 0,
    errors,
    formation: detectedFormation,
  };
}

/**
 * Fast processing for raw text / pasted content (Moodle participants table or selection).
 */
export async function processRawTextImport(
  rawText: string,
  targetFormation?: 'mn' | 'gp'
): Promise<UploadResult> {
  // Auto-detect if the user pasted a Moodle Grader Report ("Rapport de l'évaluateur")
  if (
    rawText.includes('sortitemid=') ||
    rawText.includes('Rapport de l’évaluateur') ||
    rawText.includes("Rapport de l'évaluateur") ||
    rawText.includes('Affichage des notes et tendances centrales') ||
    rawText.includes('Total du cours')
  ) {
    const gbTest = parseRawGradebookText(rawText);
    if (gbTest.learners.length > 0 && gbTest.activity_headers.length > 0) {
      return processGradebookTextImport(rawText, targetFormation);
    }
  }

  const participants = parseRawParticipantsText(rawText);
  if (participants.length === 0) {
    throw new Error('Aucun apprenant détecté dans le texte collé. Vérifiez le format (e-mail valide requis).');
  }

  const detectedFormation = targetFormation || 'gp';
  const targetGroup = detectedFormation === 'gp' ? 'G1_GPM_092026' : 'G1_MN_072026';

  const upload = await store.addUpload(`Sélection Moodle (${participants.length} apprenants)`, 'md');

  let learnersCreated = 0;
  let learnersUpdated = 0;
  const errors: string[] = [];

  const existingLearners = await store.getLearners(detectedFormation, true);
  const existingMap = new Map(existingLearners.map(l => [l.email.trim().toLowerCase(), l]));

  const learnersToUpsert = participants.map(p => {
    const emailNorm = p.email.trim().toLowerCase();
    const existing = existingMap.get(emailNorm);
    const groupToAssign = p.group && p.group.startsWith('G1_') ? p.group : targetGroup;
    if (existing) learnersUpdated++;
    else learnersCreated++;

    const parsedDate = p.last_access ? parseRelativeTime(p.last_access) : null;

    return {
      ...(existing?.id ? { id: existing.id } : {}),
      first_name: p.first_name,
      last_name: p.last_name,
      email: emailNorm,
      group_id: groupToAssign,
      last_activity_at: parsedDate || existing?.last_activity_at || null,
      status: existing?.status || 'active',
    };
  });

  for (let i = 0; i < learnersToUpsert.length; i += 50) {
    const chunk = learnersToUpsert.slice(i, i + 50);
    const { error: upsertErr } = await supabase
      .from('learners')
      .upsert(chunk, { onConflict: 'email' });
    if (upsertErr) {
      errors.push(`Erreur enregistrement apprenants: ${upsertErr.message}`);
    }
  }

  store.invalidateCache(detectedFormation);

  await store.updateUpload(upload.id, {
    rows_processed: participants.length,
    status: 'processed',
  });

  return {
    upload_id: upload.id,
    filename: `Sélection collée (${participants.length} apprenants)`,
    rows_processed: participants.length,
    learners_created: learnersCreated,
    learners_updated: learnersUpdated,
    progress_records: 0,
    errors,
    formation: detectedFormation,
  };
}

/**
 * Process raw pasted text from Moodle's Grader Report ("Rapport de l'évaluateur"):
 * 1. Cleans all Moodle UI noise, avatar initials, profile photo prefixes, and deleted activities
 * 2. Reconciles and compares the pasted learner list with the normal cohort learner list
 * 3. Cleans polluted learner names in Supabase
 * 4. Stores every deliverable grade (including null for ungraded '-' items) while preserving completion status
 *    so that any graded deliverable marked "not_completed" is surfaced as a Moodle Incoherence
 */
export async function processGradebookTextImport(
  rawText: string,
  targetFormation?: 'mn' | 'gp'
): Promise<UploadResult> {
  const parsed = parseRawGradebookText(rawText);
  if (parsed.learners.length === 0) {
    throw new Error(
      "Aucun apprenant ni note détecté dans le texte collé. Assurez-vous de copier le tableau depuis le « Rapport de l'évaluateur » Moodle."
    );
  }

  const detectedFormation = resolveFormation(targetFormation, undefined, parsed.activity_headers);
  const targetGroup = detectedFormation === 'gp' ? 'G1_GPM_092026' : 'G1_MN_072026';

  const upload = await store.addUpload(
    `Carnet de notes Moodle (${parsed.learners.length} apprenants)`,
    'md'
  );

  let learnersCreated = 0;
  let learnersUpdated = 0;
  const errors: string[] = [];

  // 1. Load existing cohort learners and compare lists
  const existingLearners = await store.getLearners(detectedFormation, true);
  const existingMap = new Map<string, Learner>(
    existingLearners.map(l => [l.email.trim().toLowerCase(), l])
  );
  const gradebookMap = new Map(
    parsed.learners.map(l => [l.email.trim().toLowerCase(), l])
  );

  const missingInCohort: { name: string; email: string }[] = [];
  let matchedCount = 0;

  for (const gbLearner of parsed.learners) {
    const emailNorm = gbLearner.email.trim().toLowerCase();
    if (existingMap.has(emailNorm)) {
      matchedCount++;
    } else {
      missingInCohort.push({ name: gbLearner.full_name, email: emailNorm });
    }
  }

  const missingInGradebook: { first_name: string; last_name: string; email: string }[] = [];
  for (const cohortLearner of existingLearners) {
    const emailNorm = cohortLearner.email.trim().toLowerCase();
    if (!gradebookMap.has(emailNorm)) {
      const cleaned = cleanMoodleLearnerName(`${cohortLearner.first_name} ${cohortLearner.last_name}`);
      missingInGradebook.push({
        first_name: cleaned.first_name || cohortLearner.first_name,
        last_name: cleaned.last_name || cohortLearner.last_name,
        email: emailNorm,
      });
    }
  }

  // 2. Prepare learner upserts (both Gradebook learners and cleaning any polluted names in existing cohort)
  const learnersToUpsert: any[] = [];
  const upsertedEmails = new Set<string>();

  for (const gbLearner of parsed.learners) {
    const emailNorm = gbLearner.email.trim().toLowerCase();
    const existing = existingMap.get(emailNorm);
    if (existing) learnersUpdated++;
    else learnersCreated++;

    upsertedEmails.add(emailNorm);
    learnersToUpsert.push({
      ...(existing?.id ? { id: existing.id } : {}),
      first_name: gbLearner.first_name,
      last_name: gbLearner.last_name,
      email: emailNorm,
      group_id: existing?.group_id || targetGroup,
      last_activity_at: existing?.last_activity_at || null,
      status: existing?.status || 'active',
    });
  }

  // Also sanitize any remaining cohort learners whose names in DB still have Moodle photo/avatar pollution
  for (const cohortLearner of existingLearners) {
    const emailNorm = cohortLearner.email.trim().toLowerCase();
    if (upsertedEmails.has(emailNorm)) continue;
    const rawCombined = `${cohortLearner.first_name} ${cohortLearner.last_name}`.trim();
    const cleaned = cleanMoodleLearnerName(rawCombined);
    if (
      cleaned.first_name &&
      (cleaned.first_name !== cohortLearner.first_name || cleaned.last_name !== cohortLearner.last_name)
    ) {
      learnersToUpsert.push({
        id: cohortLearner.id,
        first_name: cleaned.first_name,
        last_name: cleaned.last_name,
        email: emailNorm,
        group_id: cohortLearner.group_id || targetGroup,
        last_activity_at: cohortLearner.last_activity_at || null,
        status: cohortLearner.status || 'active',
      });
    }
  }

  for (let i = 0; i < learnersToUpsert.length; i += 50) {
    const chunk = learnersToUpsert.slice(i, i + 50);
    const { error: upsertErr } = await supabase
      .from('learners')
      .upsert(chunk, { onConflict: 'email' });
    if (upsertErr) {
      errors.push(`Erreur enregistrement apprenants: ${upsertErr.message}`);
    }
  }

  // 3. Refresh learners & activities to map grades to progress records
  const refreshedLearners = await store.getLearners(detectedFormation, true);
  const refreshedLearnerMap = new Map<string, Learner>(
    refreshedLearners.map(l => [l.email.trim().toLowerCase(), l])
  );

  const allActivities = await store.getActivities(detectedFormation, true);
  const activityByNormName = new Map<string, Activity>();
  for (const act of allActivities) {
    activityByNormName.set(normalizeActivityNameForMatch(act.name), act);
  }

  // Helper to resolve a Gradebook column header to its Activity in Supabase
  const resolveGradebookActivity = (headerName: string): Activity | undefined => {
    const norm = normalizeActivityNameForMatch(headerName);
    const direct = activityByNormName.get(norm);
    if (direct) return direct;

    // Fallback for Sequence 6 deliverables ("... - Livrable final" <-> "... - Livrable d'entraînement")
    if (norm.includes('- livrable final')) {
      const altNorm = norm.replace('- livrable final', "- livrable d'entrainement");
      const alt = activityByNormName.get(altNorm);
      if (alt) return alt;
    }
    return undefined;
  };

  // 4. Load all existing progress records
  const allExistingProgress = await store.getAllProgress(true);
  const existingProgressMap = new Map<string, LearnerProgress>();
  for (const p of allExistingProgress) {
    existingProgressMap.set(`${p.learner_id}:${p.activity_id}`, p);
  }

  const toInsertProgress: any[] = [];
  const toUpdateProgress: any[] = [];
  let gradesRecorded = 0;
  let ungradedRecorded = 0;

  for (const gbLearner of parsed.learners) {
    const emailNorm = gbLearner.email.trim().toLowerCase();
    const learner = refreshedLearnerMap.get(emailNorm);
    if (!learner) continue;

    for (const actEntry of gbLearner.grades) {
      const activity = resolveGradebookActivity(actEntry.activity_name);
      if (!activity) continue;

      const isDevoir =
        activity.type === 'devoir' ||
        activity.is_evaluated ||
        isAssignment(activity.name);

      // Only store grades on evaluated deliverables / assignments
      if (!isDevoir) continue;

      const gradeVal = actEntry.grade; // number | null
      if (gradeVal !== null) {
        gradesRecorded++;
      } else {
        ungradedRecorded++;
      }

      const key = `${learner.id}:${activity.id}`;
      const existing = existingProgressMap.get(key);

      if (!existing) {
        toInsertProgress.push({
          learner_id: learner.id,
          activity_id: activity.id,
          status: 'not_completed',
          completed_at: null,
          grade: gradeVal,
          upload_id: upload.id,
        });
      } else if (existing.grade !== gradeVal) {
        toUpdateProgress.push({
          id: existing.id,
          learner_id: learner.id,
          activity_id: activity.id,
          status: existing.status, // Preserve Moodle completion status so incoherences are accurately detected
          completed_at: existing.completed_at,
          grade: gradeVal,
          upload_id: upload.id,
        });
      }
    }
  }

  // 5. Batch insert/update progress records
  const chunkSize = 500;
  const BATCH_CONCURRENCY = 4;

  if (toInsertProgress.length > 0) {
    const insertChunks: any[][] = [];
    for (let i = 0; i < toInsertProgress.length; i += chunkSize) {
      insertChunks.push(toInsertProgress.slice(i, i + chunkSize));
    }
    for (let i = 0; i < insertChunks.length; i += BATCH_CONCURRENCY) {
      const batch = insertChunks.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.all(batch.map(c => supabase.from('progress').insert(c)));
      for (const res of results) {
        if (res.error) {
          errors.push(`Erreur insertion notes: ${res.error.message}`);
        }
      }
    }
  }

  if (toUpdateProgress.length > 0) {
    const updateChunks: any[][] = [];
    for (let i = 0; i < toUpdateProgress.length; i += chunkSize) {
      updateChunks.push(toUpdateProgress.slice(i, i + chunkSize));
    }
    for (let i = 0; i < updateChunks.length; i += BATCH_CONCURRENCY) {
      const batch = updateChunks.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.all(
        batch.map(c => supabase.from('progress').upsert(c, { onConflict: 'id' }))
      );
      for (const res of results) {
        if (res.error) {
          errors.push(`Erreur mise à jour notes: ${res.error.message}`);
        }
      }
    }
  }

  // 6. Recompute stats & incoherences
  store.invalidateCache(detectedFormation);
  const stats = await store.getDashboardStats(detectedFormation);

  await store.updateUpload(upload.id, {
    rows_processed: parsed.learners.length,
    status: 'processed',
    completion_rate: stats.completion_rate,
  });

  const comparison: GradebookComparison = {
    total_in_gradebook: parsed.learners.length,
    total_in_cohort: refreshedLearners.length,
    matched_count: matchedCount,
    missing_in_cohort: missingInCohort,
    missing_in_gradebook: missingInGradebook,
    grades_recorded: gradesRecorded,
    ungraded_recorded: ungradedRecorded,
    incoherences_detected: stats.total_incoherences_count || 0,
    passing_incoherences_detected: stats.passing_incoherences_count || 0,
    affected_learners_count: (stats.grade_incoherences || []).length,
  };

  return {
    upload_id: upload.id,
    filename: `Carnet de notes Moodle (${parsed.learners.length} apprenants)`,
    rows_processed: parsed.learners.length,
    learners_created: learnersCreated,
    learners_updated: learnersUpdated,
    progress_records: toInsertProgress.length + toUpdateProgress.length,
    errors,
    formation: detectedFormation,
    gradebook_comparison: comparison,
  };
}

