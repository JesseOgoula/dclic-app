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
} from './parser/moodleParser.js';
import { parseParticipantsMD, parseRelativeTime } from './parser/mdParser.js';
import { store, supabase } from './store.js';
import type { UploadResult, Learner, Activity, LearnerProgress } from '../types.js';

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
