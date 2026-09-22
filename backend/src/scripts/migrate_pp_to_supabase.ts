// ============================================================
// Migration script: Import pp_evaluations_state.json into Supabase
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const STATE_FILE = path.join(PROJECT_ROOT, 'pp_evaluations_state.json');

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’\-]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

async function runMigration() {
  console.log('🚀 Starting PP Data Migration to Supabase...');

  if (!fs.existsSync(STATE_FILE)) {
    console.error('❌ State file not found at:', STATE_FILE);
    process.exit(1);
  }

  const raw = fs.readFileSync(STATE_FILE, 'utf-8');
  const learnersData = JSON.parse(raw);
  console.log(`📊 Found ${learnersData.length} learners in pp_evaluations_state.json`);

  // Fetch MN learners from Supabase to match mn_learner_id
  const { data: mnLearners, error: mnErr } = await supabase.from('learners').select('id, first_name, last_name, email');
  if (mnErr) {
    console.warn('⚠️ Could not fetch MN learners:', mnErr.message);
  }

  const mnList = mnLearners || [];
  console.log(`📋 Found ${mnList.length} learners in 'learners' table for concordance.`);

  let matchedCount = 0;
  const learnerRows: any[] = [];
  const evalRows: any[] = [];

  for (const item of learnersData) {
    // Attempt concordance
    const normFull = normalizeText(item.full_name || `${item.nom} ${item.prenom}`);
    const normNom = normalizeText(item.nom || '');
    const normPrenom = normalizeText(item.prenom || '');

    let matchedMnId: string | null = null;
    const match = mnList.find(mn => {
      const mnFull = normalizeText(`${mn.first_name} ${mn.last_name}`);
      const mnReverse = normalizeText(`${mn.last_name} ${mn.first_name}`);
      if (mnFull === normFull || mnReverse === normFull) return true;
      if (normNom && normalizeText(mn.last_name).includes(normNom) && normPrenom && normalizeText(mn.first_name).includes(normPrenom)) return true;
      return false;
    });

    if (match) {
      matchedMnId = match.id;
      matchedCount++;
    }

    const learnerRow = {
      id: item.id,
      num: item.num || '',
      nom: item.nom || '',
      prenom: item.prenom || '',
      full_name: item.full_name || `${item.nom} ${item.prenom}`.trim(),
      projet: item.projet || '',
      category: item.category || 'yellow',
      category_label: item.category_label || '',
      status_priority: item.status_priority || '',
      synthesis: item.synthesis || {},
      mn_learner_id: matchedMnId,
      group_id: 'G1_MN_072026',
      updated_at: new Date().toISOString(),
    };

    learnerRows.push(learnerRow);

    // Prepare evaluations
    const deliverables = item.deliverables || {};
    for (const [delivId, delivEntry] of Object.entries<any>(deliverables)) {
      for (const phase of ['entrainement', 'final'] as const) {
        const phaseData = delivEntry[phase];
        if (!phaseData) continue;

        evalRows.push({
          learner_id: item.id,
          deliverable_id: delivId,
          phase,
          submitted: !!phaseData.submitted,
          status: phaseData.status || '',
          evaluation_status: phaseData.submitted && phaseData.comment ? 'validated' : (phaseData.submitted ? 'pending' : 'pending'),
          is_locked: phaseData.submitted && !!phaseData.comment,
          score: phaseData.score !== undefined ? phaseData.score : null,
          max_score: phaseData.max_score || (delivId === 'desc' ? 0 : (['strat', 'gest', 'budget'].includes(delivId) ? 6 : 4)),
          comment: phaseData.comment || '',
          audit_v1: phaseData.audit_v1 || '',
          criteria_results: phaseData.criteria_results || {},
          files: phaseData.files || [],
          evaluated_by: phaseData.comment ? 'coordinateur' : '',
          evaluated_at: phaseData.comment ? new Date().toISOString() : null,
          validated_by: phaseData.comment ? 'coordinateur' : '',
          validated_at: phaseData.comment ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  // 1. Batch upsert learners
  console.log(`⏳ Batch upserting ${learnerRows.length} learners...`);
  const { error: lBatchErr } = await supabase.from('pp_learners').upsert(learnerRows, { onConflict: 'id' });
  if (lBatchErr) throw lBatchErr;
  console.log(`✅ ${learnerRows.length} learners upserted.`);

  // 2. Batch upsert evaluations in chunks of 100
  console.log(`⏳ Batch upserting ${evalRows.length} evaluations in chunks...`);
  const chunkSize = 100;
  for (let i = 0; i < evalRows.length; i += chunkSize) {
    const chunk = evalRows.slice(i, i + chunkSize);
    const { error: eBatchErr } = await supabase.from('pp_evaluations').upsert(chunk, {
      onConflict: 'learner_id,deliverable_id,phase'
    });
    if (eBatchErr) throw eBatchErr;
    console.log(`  ✓ Inserted chunk ${i + 1} - ${Math.min(i + chunkSize, evalRows.length)}`);
  }

  console.log(`\n✅ Migration Finished Successfully!`);
  console.log(`👤 PP Learners migrated: ${learnerRows.length}`);
  console.log(`🔗 Concordance matches with MN: ${matchedCount} / ${learnerRows.length}`);
  console.log(`📝 Deliverable evaluations saved: ${evalRows.length}`);
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
