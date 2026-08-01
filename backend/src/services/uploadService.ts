// ============================================================
// Upload Processing Service (Supabase Async Version)
// Orchestrates CSV/Excel parsing → data store ingestion
// ============================================================

import path from 'path';
import fs from 'fs';
import {
  parseProgressCSV,
  parseParticipantsXLSX,
  filterByGroup,
  extractActivityMetadata,
} from './parser/moodleParser.js';
import { parseParticipantsMD, parseRelativeTime } from './parser/mdParser.js';
import { store, supabase } from './store.js';
import type { UploadResult } from '../types.js';

const TARGET_GROUP = 'G1_MN_072026';

/**
 * Process an uploaded file — determines type and ingests data.
 */
export async function processUpload(filePath: string, filename: string): Promise<UploadResult> {
  const ext = path.extname(filename).toLowerCase();
  const fileTypeMap: Record<string, 'csv' | 'xlsx' | 'md'> = {
    '.csv': 'csv',
    '.xlsx': 'xlsx',
    '.xls': 'xlsx',
    '.md': 'md',
  };
  const upload = await store.addUpload(filename, fileTypeMap[ext] || 'csv');

  try {
    // Upload original file to Supabase Storage as a backup/audit
    const fileContent = fs.readFileSync(filePath);
    const storagePath = `${Date.now()}_${filename}`;
    await supabase.storage.from('uploads').upload(storagePath, fileContent);

    let result: UploadResult;

    if (ext === '.csv') {
      result = await processProgressCSV(filePath, upload.id);
    } else if (ext === '.xlsx' || ext === '.xls') {
      result = await processParticipantsXLSX(filePath, upload.id);
    } else if (ext === '.md') {
      result = await processParticipantsMD(filePath, upload.id);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    await store.updateUpload(upload.id, {
      rows_processed: result.rows_processed,
      status: 'processed',
    });

    return result;
  } catch (error) {
    await store.updateUpload(upload.id, { status: 'error' });
    throw error;
  } finally {
    // Clean up the temporary local file
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
 * Process the Moodle progress CSV.
 */
async function processProgressCSV(filePath: string, uploadId: string): Promise<UploadResult> {
  const rows = parseProgressCSV(filePath);

  if (rows.length === 0) {
    return {
      upload_id: uploadId,
      filename: path.basename(filePath),
      rows_processed: 0,
      learners_created: 0,
      learners_updated: 0,
      progress_records: 0,
      errors: ['No data rows found in CSV'],
    };
  }

  // Register activities
  const activityMeta = extractActivityMetadata(rows[0].activities.map(a => a.name));
  for (const meta of activityMeta) {
    await store.upsertActivity(meta);
  }

  let learnersCreated = 0;
  let learnersUpdated = 0;
  let progressRecords = 0;
  const errors: string[] = [];

  const allLearners = await store.getLearners();
  const allActivities = await store.getActivities();
  const allProgress = await store.getAllProgress();
  const toInsert: any[] = [];
  const toUpdate: any[] = [];

  const g1Emails = new Set(
    allLearners
      .filter(l => l.group_id === TARGET_GROUP)
      .map(l => l.email)
  );

  if (g1Emails.size === 0) {
    errors.push("⚠️ ATTENTION : La liste des participants n'a pas encore été importée. L'application va charger temporairement TOUS les apprenants du fichier CSV.");
  }

  for (const row of rows) {
    try {
      if (g1Emails.size > 0 && !g1Emails.has(row.email)) {
        continue;
      }

      const nameParts = row.name.split(/\s+/);
      const firstName = nameParts.slice(0, -1).join(' ');
      const lastName = nameParts[nameParts.length - 1] || '';

      const timestamps = row.activities
        .filter(a => a.completed_at)
        .map(a => new Date(a.completed_at!).getTime())
        .filter(t => !isNaN(t));
      const lastActivity = timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : null;

      const existingLearner = await store.getLearnerByEmail(row.email);
      const learner = await store.upsertLearner({
        first_name: existingLearner?.first_name || firstName,
        last_name: existingLearner?.last_name || lastName,
        email: row.email,
        group_id: existingLearner?.group_id || 'UNKNOWN',
        last_activity_at: lastActivity,
      });

      if (existingLearner) learnersUpdated++;
      else learnersCreated++;

      for (const act of row.activities) {
        const activityCode = activityMeta.find(m => m.name === act.name)?.code;
        if (!activityCode) continue;

        const activity = allActivities.find(a => a.code === activityCode);
        if (!activity) continue;

        const status = act.status as 'completed' | 'not_completed' | 'passed';
        const existingProgress = allProgress.find(p => p.learner_id === learner.id && p.activity_id === activity.id);

        if (!existingProgress) {
          toInsert.push({
            learner_id: learner.id,
            activity_id: activity.id,
            status,
            completed_at: act.completed_at,
            grade: null,
            upload_id: uploadId,
          });
          allProgress.push({
            id: `temp-${Date.now()}-${Math.random()}`,
            learner_id: learner.id,
            activity_id: activity.id,
            status,
            completed_at: act.completed_at || null,
            grade: null,
            upload_id: uploadId,
            created_at: new Date().toISOString(),
          } as any);
        } else if (existingProgress.status !== status || existingProgress.completed_at !== act.completed_at) {
          toUpdate.push({
            ...existingProgress,
            status,
            completed_at: act.completed_at,
            upload_id: uploadId,
          });
        }
      }
    } catch (err) {
      errors.push(`Error processing row for ${row.email}: ${err}`);
    }
  }

  if (toInsert.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      await supabase.from('progress').insert(toInsert.slice(i, i + chunkSize));
    }
    progressRecords += toInsert.length;
  }

  if (toUpdate.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      await supabase.from('progress').upsert(toUpdate.slice(i, i + chunkSize), { onConflict: 'id' });
    }
    progressRecords += toUpdate.length;
  }

  return {
    upload_id: uploadId,
    filename: path.basename(filePath),
    rows_processed: rows.length,
    learners_created: learnersCreated,
    learners_updated: learnersUpdated,
    progress_records: progressRecords,
    errors,
  };
}

/**
 * Process the participants XLSX
 */
async function processParticipantsXLSX(filePath: string, uploadId: string): Promise<UploadResult> {
  const allParticipants = parseParticipantsXLSX(filePath);
  const g1Participants = filterByGroup(allParticipants, TARGET_GROUP);

  let learnersCreated = 0;
  let learnersUpdated = 0;
  const errors: string[] = [];

  for (const p of g1Participants) {
    try {
      const existing = await store.getLearnerByEmail(p.email);
      await store.upsertLearner({
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        group_id: p.group,
        last_activity_at: null,
      });
      if (existing) learnersUpdated++;
      else learnersCreated++;
    } catch (err) {
      errors.push(`Error processing participant ${p.email}: ${err}`);
    }
  }

  return {
    upload_id: uploadId,
    filename: path.basename(filePath),
    rows_processed: g1Participants.length,
    learners_created: learnersCreated,
    learners_updated: learnersUpdated,
    progress_records: 0,
    errors,
  };
}

/**
 * Process the participants MD
 */
async function processParticipantsMD(filePath: string, uploadId: string): Promise<UploadResult> {
  const allParticipants = parseParticipantsMD(filePath);
  const g1Participants = filterByGroup(allParticipants, TARGET_GROUP);

  let learnersCreated = 0;
  let learnersUpdated = 0;
  const errors: string[] = [];

  for (const p of g1Participants) {
    try {
      const existing = await store.getLearnerByEmail(p.email);
      // Last access time is passed in the parser output or we can add it to ParsedParticipant.
      // Wait, parseParticipantsMD doesn't return last access time yet. Let me check the type of ParsedParticipant.
      // Actually, since ParsedParticipant from types.ts doesn't have last_access, let me just set it to null 
      // or update ParsedParticipant type later if needed. For now I'll just put null for now, 
      // wait, the mdParser can extract it but the type doesn't have it.
      await store.upsertLearner({
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        group_id: p.group,
        last_activity_at: (p as any).last_access ? parseRelativeTime((p as any).last_access) : null,
      });
      if (existing) learnersUpdated++;
      else learnersCreated++;
    } catch (err) {
      errors.push(`Error processing participant ${p.email}: ${err}`);
    }
  }

  return {
    upload_id: uploadId,
    filename: path.basename(filePath),
    rows_processed: g1Participants.length,
    learners_created: learnersCreated,
    learners_updated: learnersUpdated,
    progress_records: 0,
    errors,
  };
}
