// ============================================================
// Upload Processing Service
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
import { store } from './store.js';
import type { UploadResult } from '../types.js';

const TARGET_GROUP = 'G1_MN_072026';

/**
 * Process an uploaded file — determines type and ingests data.
 */
export async function processUpload(filePath: string, filename: string): Promise<UploadResult> {
  const ext = path.extname(filename).toLowerCase();
  const upload = store.addUpload(filename, ext === '.csv' ? 'csv' : 'xlsx');

  try {
    let result: UploadResult;

    if (ext === '.csv') {
      result = await processProgressCSV(filePath, upload.id);
    } else if (ext === '.xlsx' || ext === '.xls') {
      result = await processParticipantsXLSX(filePath, upload.id);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    store.updateUpload(upload.id, {
      rows_processed: result.rows_processed,
      status: 'processed',
    });

    store.saveToFile();

    return result;
  } catch (error) {
    store.updateUpload(upload.id, { status: 'error' });
    throw error;
  } finally {
    // Clean up the temporary file to avoid cluttering the uploads folder
    // ONLY delete if it's in the uploads directory (not the original auto-loaded files)
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

  // Extract activity metadata from the first row's activities
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
    store.upsertActivity(meta);
  }

  let learnersCreated = 0;
  let learnersUpdated = 0;
  let progressRecords = 0;
  const errors: string[] = [];

  // Get the set of G1 emails for filtering
  const g1Emails = new Set(
    store.getLearners()
      .filter(l => l.group_id === TARGET_GROUP)
      .map(l => l.email)
  );

  if (g1Emails.size === 0) {
    errors.push("⚠️ ATTENTION : La liste des participants (XLSX) n'a pas encore été importée. L'application va charger temporairement TOUS les apprenants du fichier CSV. Pensez à importer le fichier XLSX ensuite pour que le Dashboard se focalise uniquement sur le Groupe 1.");
  }

  for (const row of rows) {
    try {
      // If we have participants loaded, filter by G1 only
      if (g1Emails.size > 0 && !g1Emails.has(row.email)) {
        continue;
      }


      // Split name into first/last
      const nameParts = row.name.split(/\s+/);
      const firstName = nameParts.slice(0, -1).join(' ');
      const lastName = nameParts[nameParts.length - 1] || '';

      // Find last activity timestamp
      const timestamps = row.activities
        .filter(a => a.completed_at)
        .map(a => new Date(a.completed_at!).getTime())
        .filter(t => !isNaN(t));
      const lastActivity = timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : null;

      const existingLearner = store.getLearnerByEmail(row.email);
      const learner = store.upsertLearner({
        first_name: existingLearner?.first_name || firstName,
        last_name: existingLearner?.last_name || lastName,
        email: row.email,
        group_id: existingLearner?.group_id || 'UNKNOWN',
        last_activity_at: lastActivity,
      });

      if (existingLearner) learnersUpdated++;
      else learnersCreated++;

      // Process each activity
      for (const act of row.activities) {
        // Find the activity in store by matching name
        const activityCode = activityMeta.find(m => m.name === act.name)?.code;
        if (!activityCode) continue;

        const activity = store.getActivityByCode(activityCode);
        if (!activity) continue;

        store.addProgress({
          learner_id: learner.id,
          activity_id: activity.id,
          status: act.status as 'completed' | 'not_completed' | 'passed',
          completed_at: act.completed_at,
          grade: null,
          upload_id: uploadId,
        });
        progressRecords++;
      }
    } catch (err) {
      errors.push(`Error processing row for ${row.email}: ${err}`);
    }
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
 * Process the participants XLSX — load learners with group info.
 */
async function processParticipantsXLSX(filePath: string, uploadId: string): Promise<UploadResult> {
  const allParticipants = parseParticipantsXLSX(filePath);

  // Filter to G1 only
  const g1Participants = filterByGroup(allParticipants, TARGET_GROUP);

  let learnersCreated = 0;
  let learnersUpdated = 0;
  const errors: string[] = [];

  for (const p of g1Participants) {
    try {
      const existing = store.getLearnerByEmail(p.email);
      store.upsertLearner({
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
