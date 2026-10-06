// ============================================================
// Supabase Data Store
// ============================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

import type {
  Learner, Activity, LearnerProgress, Upload, CommunicationLog,
  Evaluation, Report, Alert, DashboardStats, LearnerWithProgress, SequenceStat,
  ProgressionHole, LearnerPortalData, PPGradeInfo, PPStats
} from '../types.js';
import { isAssignment } from './parser/moodleParser.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

export function computeLearnerStatus(
  completionRate: number,
  daysInactive: number,
  isPhase1Completed: boolean,
  hasValidatedPP: boolean = false
): 'completed' | 'completed_phase1' | 'dropped' | 'inactive' | 'active' {
  if (completionRate >= 100 || (isPhase1Completed && hasValidatedPP)) return 'completed';
  if (isPhase1Completed) return 'completed_phase1';
  if (daysInactive > 7) return 'dropped';
  if (daysInactive >= 2) return 'inactive';
  return 'active';
}

class DataStore {
  // In-Memory High-Performance Caching
  private progressCache: { data: LearnerProgress[]; timestamp: number } | null = null;
  private learnersCache = new Map<string, { data: Learner[]; timestamp: number }>();
  private activitiesCache = new Map<string, { data: Activity[]; timestamp: number }>();
  private statsCache = new Map<string, { data: DashboardStats; timestamp: number }>();
  private weeklyReportsCache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly CACHE_TTL = 3 * 60 * 1000; // 3 minutes

  invalidateCache(formation?: string) {
    this.progressCache = null;
    this.statsCache.clear();
    this.weeklyReportsCache.clear();
    if (formation) {
      this.learnersCache.delete(formation);
      this.learnersCache.delete('all');
      this.activitiesCache.delete(formation);
      this.activitiesCache.delete('all');
    } else {
      this.learnersCache.clear();
      this.activitiesCache.clear();
    }
  }

  // ----------------------------------------------------------
  // Learner operations
  // ----------------------------------------------------------

  async upsertLearner(data: Omit<Learner, 'id' | 'created_at' | 'status'>): Promise<Learner> {
    const { data: existing } = await supabase
      .from('learners')
      .select('*')
      .eq('email', data.email.toLowerCase())
      .single();

    if (existing) {
      const updates = {
        first_name: data.first_name,
        last_name: data.last_name,
        group_id: data.group_id,
        ...(data.last_activity_at && { last_activity_at: data.last_activity_at })
      };
      const { data: updated } = await supabase
        .from('learners')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      return updated as Learner;
    }

    const { data: inserted } = await supabase
      .from('learners')
      .insert([{
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email.toLowerCase(),
        group_id: data.group_id,
        last_activity_at: data.last_activity_at,
        status: 'active'
      }])
      .select()
      .single();
    return inserted as Learner;
  }

  async getLearners(formation?: string, forceRefresh = false): Promise<Learner[]> {
    const cacheKey = formation || 'all';
    if (!forceRefresh) {
      const cached = this.learnersCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    let query = supabase.from('learners').select('*');
    if (formation === 'gp') {
      query = query.or('group_id.eq.G1_GPM_092026,group_id.ilike.%GPM%');
    } else if (formation === 'mn') {
      query = query.or('group_id.eq.G1_MN_072026,group_id.ilike.%MN%,group_id.eq.UNKNOWN');
    } else {
      query = query.or('group_id.eq.G1_MN_072026,group_id.eq.G1_GPM_092026,group_id.ilike.%G1_%');
    }
    const { data } = await query;
    const learners = (data as Learner[]) || [];
    this.learnersCache.set(cacheKey, { data: learners, timestamp: Date.now() });
    return learners;
  }

  async getLearnerByEmail(email: string): Promise<Learner | undefined> {
    const { data } = await supabase
      .from('learners')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    return data || undefined;
  }

  async getLearnerById(id: string): Promise<Learner | undefined> {
    const { data } = await supabase
      .from('learners')
      .select('*')
      .eq('id', id)
      .single();
    return data || undefined;
  }

  // ----------------------------------------------------------
  // Activity operations
  // ----------------------------------------------------------

  async upsertActivity(data: Omit<Activity, 'id'>): Promise<Activity> {
    // First try to match by exact activity name
    let { data: existing } = await supabase
      .from('activities')
      .select('*')
      .eq('name', data.name)
      .maybeSingle();

    // Fallback: match by code if not found by name
    if (!existing && data.code) {
      const { data: byCode } = await supabase
        .from('activities')
        .select('*')
        .eq('code', data.code)
        .maybeSingle();
      existing = byCode;
    }

    if (existing) {
      const { data: updated } = await supabase
        .from('activities')
        .update(data)
        .eq('id', existing.id)
        .select()
        .single();
      return updated as Activity;
    }

    const { data: inserted } = await supabase
      .from('activities')
      .insert([data])
      .select()
      .single();
    return inserted as Activity;
  }

  async getActivities(formation?: string, forceRefresh = false): Promise<Activity[]> {
    const cacheKey = formation || 'all';
    if (!forceRefresh) {
      const cached = this.activitiesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    let query = supabase.from('activities').select('*');
    if (formation === 'gp') {
      query = query.eq('formation_type', 'gp');
    } else if (formation === 'mn') {
      query = query.or('formation_type.eq.mn,formation_type.is.null');
    }
    const { data } = await query.order('display_order', { ascending: true });
    const activities = (data as Activity[]) || [];

    // Auto-alignement (spécifique formation initiale MN)
    if (!formation || formation === 'mn') {
      for (const act of activities) {
        if (act.name.toLowerCase().includes('impression') && act.sequence !== "Phase d'impressions") {
          act.sequence = "Phase d'impressions";
        }
      }
    }

    this.activitiesCache.set(cacheKey, { data: activities, timestamp: Date.now() });
    return activities;
  }

  async getActivityByCode(code: string): Promise<Activity | undefined> {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('code', code)
      .single();
    return data || undefined;
  }

  async getActivityById(id: string): Promise<Activity | undefined> {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .single();
    return data || undefined;
  }

  // ----------------------------------------------------------
  // Progress operations
  // ----------------------------------------------------------

  async addProgress(data: Omit<LearnerProgress, 'id' | 'created_at'>): Promise<LearnerProgress> {
    const { data: existing } = await supabase
      .from('progress')
      .select('*')
      .eq('learner_id', data.learner_id)
      .eq('activity_id', data.activity_id)
      .single();

    if (existing) {
      const { data: updated } = await supabase
        .from('progress')
        .update({
          status: data.status,
          completed_at: data.completed_at,
          grade: data.grade,
          upload_id: data.upload_id
        })
        .eq('id', existing.id)
        .select()
        .single();
      return updated as LearnerProgress;
    }

    const { data: inserted } = await supabase
      .from('progress')
      .insert([data])
      .select()
      .single();
    return inserted as LearnerProgress;
  }

  async getProgressByLearner(learnerId: string): Promise<LearnerProgress[]> {
    const { data } = await supabase
      .from('progress')
      .select('*')
      .eq('learner_id', learnerId);
    return data as LearnerProgress[] || [];
  }

  async getAllProgress(forceRefresh = false): Promise<LearnerProgress[]> {
    if (!forceRefresh && this.progressCache && (Date.now() - this.progressCache.timestamp < this.CACHE_TTL)) {
      return this.progressCache.data;
    }

    try {
      const { count, error: countErr } = await supabase
        .from('progress')
        .select('*', { count: 'exact', head: true });

      if (countErr || count === null || count === 0) {
        const { data } = await supabase.from('progress').select('*').limit(1000);
        const res = (data as LearnerProgress[]) || [];
        this.progressCache = { data: res, timestamp: Date.now() };
        return res;
      }

      const step = 1000;
      const chunksCount = Math.ceil(count / step);
      const ranges: [number, number][] = [];
      for (let i = 0; i < chunksCount; i++) {
        ranges.push([i * step, Math.min((i + 1) * step - 1, count - 1)]);
      }

      const results: LearnerProgress[] = [];
      const batchSize = 6;
      for (let i = 0; i < ranges.length; i += batchSize) {
        const batchRanges = ranges.slice(i, i + batchSize);
        const batchPromises = batchRanges.map(([from, to]) =>
          supabase.from('progress').select('*').range(from, to)
        );
        const batchResults = await Promise.all(batchPromises);
        for (const res of batchResults) {
          if (res.data) {
            results.push(...(res.data as LearnerProgress[]));
          }
        }
      }

      this.progressCache = { data: results, timestamp: Date.now() };
      return results;
    } catch (err) {
      console.error('[Store] getAllProgress error:', err);
      return this.progressCache ? this.progressCache.data : [];
    }
  }

  /**
   * Analyse la progression d'un apprenant pour identifier :
   * 1. L'index maximal atteint/validé
   * 2. Les trous de progression (activités non validées avant l'index max)
   * 3. Les devoirs non validés en amont (blocages majeurs pour la certification)
   */
  computeProgressionGaps(learnerProgress: LearnerProgress[], allActivities: Activity[]) {
    const sortedActivities = [...allActivities].sort((a, b) => a.display_order - b.display_order);

    const validMap = new Map<string, LearnerProgress>();
    for (const p of learnerProgress) {
      if (p.status === 'completed' || p.status === 'passed') {
        validMap.set(p.activity_id, p);
      }
    }

    let maxValidOrder = -1;
    sortedActivities.forEach(act => {
      if (validMap.has(act.id)) {
        if (act.display_order > maxValidOrder) {
          maxValidOrder = act.display_order;
        }
      }
    });

    const progressionHoles: ProgressionHole[] = [];
    const unvalidatedAssignments: ProgressionHole[] = [];

    if (maxValidOrder > -1) {
      sortedActivities.forEach(act => {
        if (act.display_order < maxValidOrder && !validMap.has(act.id)) {
          const p = learnerProgress.find(x => x.activity_id === act.id);
          const isDevoir = act.type === 'devoir' || isAssignment(act.name);
          const hole: ProgressionHole = {
            activity_id: act.id,
            code: act.code,
            name: act.name,
            sequence: act.sequence,
            type: isDevoir ? 'devoir' : act.type,
            is_evaluated: act.is_evaluated || isDevoir,
            status: p ? p.status : 'not_completed',
            completed_at: p ? p.completed_at : null,
            display_order: act.display_order,
          };
          progressionHoles.push(hole);

          if (isDevoir) {
            unvalidatedAssignments.push(hole);
          }
        }
      });
    }

    // Inclure également toute activité évaluée / devoir ayant reçu un échec (status === 'failed')
    sortedActivities.forEach(act => {
      const p = learnerProgress.find(x => x.activity_id === act.id);
      if (p && p.status === 'failed') {
        const isDevoir = act.type === 'devoir' || isAssignment(act.name);
        if (!unvalidatedAssignments.some(u => u.activity_id === act.id)) {
          const hole: ProgressionHole = {
            activity_id: act.id,
            code: act.code,
            name: act.name,
            sequence: act.sequence,
            type: isDevoir ? 'devoir' : act.type,
            is_evaluated: act.is_evaluated || isDevoir,
            status: 'failed',
            completed_at: p.completed_at,
            display_order: act.display_order,
          };
          unvalidatedAssignments.push(hole);
          if (!progressionHoles.some(h => h.activity_id === act.id)) {
            progressionHoles.push(hole);
          }
        }
      }
    });

    return {
      maxValidOrder,
      progressionHoles,
      unvalidatedAssignments,
      hasUnvalidatedAssignments: unvalidatedAssignments.length > 0,
    };
  }

  // ----------------------------------------------------------
  // Dashboard stats
  // ----------------------------------------------------------

  async getDashboardStats(formation: string = 'mn', forceRefresh = false): Promise<DashboardStats> {
    if (!forceRefresh) {
      const cached = this.statsCache.get(formation);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    const allLearners = await this.getLearners(formation);
    const allActivities = await this.getActivities(formation);
    const allProgress = await this.getAllProgress();
    const now = new Date();

    // Fast O(1) lookup Map for progress by learner_id
    const progressByLearner = new Map<string, LearnerProgress[]>();
    for (const p of allProgress) {
      let list = progressByLearner.get(p.learner_id);
      if (!list) {
        list = [];
        progressByLearner.set(p.learner_id, list);
      }
      list.push(p);
    }

    const learnersToUpdateStatus: { id: string; status: string }[] = [];

    const learnersWithProgress: LearnerWithProgress[] = allLearners.map(learner => {
      const learnerProgress = progressByLearner.get(learner.id) || [];
      const completedActivities = learnerProgress.filter(
        p => p.status === 'completed' || p.status === 'passed'
      ).length;
      const totalActivities = allActivities.length;
      const completionRate = totalActivities > 0
        ? Math.round((completedActivities / totalActivities) * 100 * 10) / 10
        : 0;

      const lastActivity = learner.last_activity_at
        ? new Date(learner.last_activity_at).getTime()
        : null;

      const daysInactive = lastActivity
        ? Math.floor((now.getTime() - lastActivity) / (1000 * 60 * 60 * 24))
        : 999;

      const { progressionHoles, unvalidatedAssignments, hasUnvalidatedAssignments } =
        this.computeProgressionGaps(learnerProgress, allActivities);

      return {
        ...learner,
        completion_rate: completionRate,
        completed_activities: completedActivities,
        total_activities: totalActivities,
        days_inactive: daysInactive,
        progress: learnerProgress,
        progression_holes: progressionHoles,
        unvalidated_assignments: unvalidatedAssignments,
        has_unvalidated_assignments: hasUnvalidatedAssignments,
      };
    });

    // Classification des statuts : la complétion prime sur l'inactivité.
    const seq5Activities = allActivities.filter(a => a.sequence.includes('Séquence 5'));
    const phase1Activities = allActivities.filter(a => a.sequence.startsWith('Séquence '));

    for (const lwp of learnersWithProgress) {
      const learnerSeq5Completed = seq5Activities.filter(act =>
        lwp.progress.some(p => p.activity_id === act.id && (p.status === 'completed' || p.status === 'passed'))
      ).length;
      const hasCompletedSeq5 = seq5Activities.length > 0 && learnerSeq5Completed === seq5Activities.length;

      const learnerPhase1Completed = phase1Activities.filter(act =>
        lwp.progress.some(p => p.activity_id === act.id && (p.status === 'completed' || p.status === 'passed'))
      ).length;
      const hasCompletedAllPhase1 = phase1Activities.length > 0 && learnerPhase1Completed === phase1Activities.length;

      const hasNoPhase1AssignmentHoles = !(lwp.unvalidated_assignments || []).some(u =>
        u.sequence.startsWith('Séquence ') || u.sequence === 'Préalable'
      );

      const isPhase1Completed = (hasCompletedSeq5 || hasCompletedAllPhase1) && hasNoPhase1AssignmentHoles;
      const ppGrade = this.getPPGradeForEmail(lwp.email);
      const hasValidatedPP = !!(ppGrade && ppGrade.validated);
      const status = computeLearnerStatus(lwp.completion_rate, lwp.days_inactive, isPhase1Completed, hasValidatedPP);

      const oldStatus = lwp.status;
      lwp.status = status as any;
      
      if (oldStatus !== status) {
        learnersToUpdateStatus.push({ id: lwp.id, status });
      }
    }

    // Non-blocking asynchronous background status update
    if (learnersToUpdateStatus.length > 0) {
      (async () => {
        try {
          for (let i = 0; i < learnersToUpdateStatus.length; i += 25) {
            const chunk = learnersToUpdateStatus.slice(i, i + 25);
            await Promise.all(
              chunk.map(u => supabase.from('learners').update({ status: u.status }).eq('id', u.id))
            );
          }
        } catch (e) {
          console.warn('[Store] Background status update error:', e);
        }
      })();
    }

    const completedPhase1Learners = learnersWithProgress.filter(l => l.status === 'completed_phase1');
    const completedLearners = learnersWithProgress.filter(l => l.status === 'completed');
    const nonCompletedLearners = learnersWithProgress.filter(l => l.status !== 'completed_phase1' && l.status !== 'completed');
    const activeLearners = nonCompletedLearners.filter(l => l.days_inactive < 2).length;
    const inactiveLearners = nonCompletedLearners.filter(l => l.days_inactive >= 2 && l.days_inactive <= 7).length;
    const droppedLearners = nonCompletedLearners.filter(l => l.days_inactive > 7).length;

    const avgCompletion = learnersWithProgress.length > 0
      ? Math.round(learnersWithProgress.reduce((sum, l) => sum + l.completion_rate, 0) / learnersWithProgress.length * 10) / 10
      : 0;

    const sequenceStats: SequenceStat[] = [];
    const sequences = Array.from(new Set(allActivities.map(a => a.sequence)));
    
    for (const seq of sequences) {
      const seqActivities = allActivities.filter(a => a.sequence === seq);
      const seqActivityIds = new Set(seqActivities.map(a => a.id));
      let totalCompletions = 0;
      let completedCount = 0;
      let inProgressCount = 0;
      let notStartedCount = 0;

      for (const learner of allLearners) {
        const learnerProgress = progressByLearner.get(learner.id) || [];
        let learnerSeqCompleted = 0;
        for (const prog of learnerProgress) {
          if (seqActivityIds.has(prog.activity_id) && (prog.status === 'completed' || prog.status === 'passed')) {
            learnerSeqCompleted++;
            totalCompletions++;
          }
        }
        
        if (seqActivities.length > 0) {
          if (learnerSeqCompleted >= seqActivities.length) completedCount++;
          else if (learnerSeqCompleted > 0) inProgressCount++;
          else notStartedCount++;
        }
      }

      const totalActivitiesPossible = seqActivities.length * allLearners.length;
      sequenceStats.push({
        sequence: seq,
        total_activities: totalActivitiesPossible,
        avg_completion: totalActivitiesPossible > 0 ? Math.round((totalCompletions / totalActivitiesPossible) * 100 * 10) / 10 : 0,
        learners_completed: completedCount,
        learners_in_progress: inProgressCount,
        learners_not_started: notStartedCount,
      });
    }

    const PROJET_PRO_START = new Date(2026, 8, 14); // 14 Septembre 2026
    const isBeforeProjetPro = now < PROJET_PRO_START;

    const sorted = [...learnersWithProgress]
      .filter(l => !(isBeforeProjetPro && (l.status === 'completed_phase1' || l.status === 'completed')))
      .sort((a, b) => b.completion_rate - a.completion_rate);
    const topPerformers = sorted.slice(0, 10);

    const atRisk = learnersWithProgress
      .filter(l => l.days_inactive > 7 && l.status !== 'completed_phase1' && l.status !== 'completed')
      .sort((a, b) => b.days_inactive - a.days_inactive)
      .slice(0, 10);

    const blockedLearners = learnersWithProgress
      .filter(l => l.progress.some(p => p.status === 'failed') || (l.unvalidated_assignments && l.unvalidated_assignments.length > 0))
      .map(l => {
        const failedProg = l.progress.filter(p => p.status === 'failed');
        const failedModulesFromProg = failedProg.map(fp => {
          const act = allActivities.find(a => a.id === fp.activity_id);
          return act ? act.name : 'Inconnu';
        });
        const unvalidatedModuleNames = (l.unvalidated_assignments || []).map(u => u.name);
        const allFailedModules = Array.from(new Set([...failedModulesFromProg, ...unvalidatedModuleNames]));
        return { ...l, failed_modules: allFailedModules };
      })
      .sort((a, b) => a.last_name.localeCompare(b.last_name));

    const uploads = await this.getUploads();
    const uploadsWithRate = uploads.filter(u => u.completion_rate !== undefined && u.completion_rate !== null);
    let completionEvolution = undefined;
    if (uploadsWithRate.length >= 2) {
      completionEvolution = Math.round((uploadsWithRate[0].completion_rate! - uploadsWithRate[1].completion_rate!) * 10) / 10;
    }

    const result: DashboardStats = {
      formation,
      formation_name: formation === 'gp'
        ? 'Module de spécialisation — Gestion de projet'
        : 'Formation initiale — Marketing numérique',
      total_learners: allLearners.length,
      active_learners: activeLearners,
      inactive_learners: inactiveLearners,
      dropped_learners: droppedLearners,
      completed_phase1_learners: completedPhase1Learners.length + completedLearners.length,
      completed_learners: completedLearners.length,
      completion_rate: avgCompletion,
      completion_evolution: completionEvolution,
      sequence_stats: sequenceStats,
      top_performers: topPerformers,
      at_risk: atRisk,
      blocked_learners: blockedLearners,
      completed_phase1_list: completedPhase1Learners.sort((a, b) => a.last_name.localeCompare(b.last_name)),
      completed_list: completedLearners.sort((a, b) => a.last_name.localeCompare(b.last_name)),
    };

    const ppData = this.getProjetProfessionnelData();
    if (ppData && ppData.statistics && (formation === 'mn' || formation === 'all' || !formation)) {
      result.pp_stats = {
        total_submitted: ppData.statistics.total_learners_submitted,
        validated_count: ppData.statistics.validated_count,
        failed_count: ppData.statistics.failed_count,
        validation_rate: ppData.statistics.validation_rate_percent,
        average_total: ppData.statistics.averages.total_general_sur_20,
        averages: ppData.statistics.averages,
        distribution: ppData.statistics.score_distribution
      };
    }

    this.statsCache.set(formation, { data: result, timestamp: Date.now() });
    return result;
  }

  // ----------------------------------------------------------
  // Projet Professionnel Data
  // ----------------------------------------------------------

  private ppDataCache: any = null;

  getProjetProfessionnelData() {
    if (this.ppDataCache) return this.ppDataCache;
    const paths = [
      path.join(process.cwd(), 'src', 'data', 'notes_projet_professionnel.json'),
      path.join(process.cwd(), 'data', 'notes_projet_professionnel.json'),
      'D:\\Project\\DCLIC\\Assistant Formation Initiale\\NOTES PP\\notes_projet_professionnel.json',
      'D:\\Project\\DCLIC\\DclicApp\\backend\\src\\data\\notes_projet_professionnel.json',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          this.ppDataCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
          return this.ppDataCache;
        } catch (err) {
          console.error('Failed reading PP data from', p, err);
        }
      }
    }
    return null;
  }

  getPPGradeForEmail(email: string): PPGradeInfo | undefined {
    const ppData = this.getProjetProfessionnelData();
    if (!ppData || !ppData.learners) return undefined;
    const cleanEmail = email.toLowerCase().trim();
    const found = ppData.learners.find((l: any) => l.email && l.email.toLowerCase().trim() === cleanEmail);
    if (!found) return undefined;

    return {
      has_pp: true,
      pp1: found.grades.pp1_strategie.score,
      pp2: found.grades.pp2_gestion.score,
      pp3: found.grades.pp3_contenus.score,
      pp4: found.grades.pp4_tableau.score,
      total_score: found.total_score,
      max_score: found.max_score,
      validated: found.validated,
      status: found.status
    };
  }

  // ----------------------------------------------------------
  // Learner Portal Data
  // ----------------------------------------------------------

  async getLearnerPortalData(query: string, requestedFormation?: string): Promise<LearnerPortalData | null> {
    const clean = query.toLowerCase().trim();
    let learner = await this.getLearnerByEmail(clean);
    if (!learner) {
      // Search across both formations to guarantee finding the learner regardless of query
      const [mnLearners, gpLearners] = await Promise.all([
        this.getLearners('mn'),
        this.getLearners('gp'),
      ]);
      const all = [...mnLearners, ...gpLearners];
      const words = clean.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
      learner = all.find(l => {
        const cleanL = l.email.toLowerCase().trim();
        const full = `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase();
        return clean === cleanL || (words.length > 0 && words.every(w => full.includes(w)));
      }) || undefined;
    }
    if (!learner) return null;

    // Detect actual formation from group_id (G1_GPM_092026 -> gp, G1_MN_072026 -> mn)
    const detectedFormation: 'mn' | 'gp' = (learner.group_id && learner.group_id.includes('GPM')) ? 'gp' : 'mn';
    // The learner's actual enrolled cohort ALWAYS dictates the syllabus
    const formation: 'mn' | 'gp' = detectedFormation;

    const allActivities = await this.getActivities(formation);
    const progress = await this.getProgressByLearner(learner.id);

    const { maxValidOrder, progressionHoles, unvalidatedAssignments, hasUnvalidatedAssignments } =
      this.computeProgressionGaps(progress, allActivities);

    const ppGrade = this.getPPGradeForEmail(learner.email);

    const sequencesMap = new Map<string, any[]>();
    for (const act of allActivities) {
      const seq = act.sequence || 'Autre';
      // In MN, skip Phase d'impressions as it was an unmonitored survey activity
      if (formation === 'mn' && seq.toLowerCase().includes('impression')) {
        continue;
      }
      if (!sequencesMap.has(seq)) {
        sequencesMap.set(seq, []);
      }
      const p = progress.find(x => x.activity_id === act.id);
      let isCompleted = p ? (p.status === 'completed' || p.status === 'passed') : false;
      let status = p ? p.status : 'not_completed';
      let completedAt = p ? p.completed_at : null;
      const isDevoir = act.type === 'devoir' || isAssignment(act.name);
      let isTrou = progressionHoles.some(h => h.activity_id === act.id);

      // If learner has submitted PP deliverables, credit the PP activities dynamically
      if (ppGrade && ppGrade.has_pp && seq.toLowerCase().includes('projet')) {
        const actLower = act.name.toLowerCase();
        if (actLower.includes('stratégie') && ppGrade.pp1 !== undefined) {
          isCompleted = true;
          status = 'completed';
          completedAt = completedAt || '2026-09-28T00:00:00Z';
          isTrou = false;
        } else if (actLower.includes('gestion') && ppGrade.pp2 !== undefined) {
          isCompleted = true;
          status = 'completed';
          completedAt = completedAt || '2026-09-28T00:00:00Z';
          isTrou = false;
        } else if (actLower.includes('contenu') && ppGrade.pp3 !== undefined) {
          isCompleted = true;
          status = 'completed';
          completedAt = completedAt || '2026-09-28T00:00:00Z';
          isTrou = false;
        } else if ((actLower.includes('tableau') || actLower.includes('indicateur')) && ppGrade.pp4 !== undefined) {
          isCompleted = true;
          status = 'completed';
          completedAt = completedAt || '2026-09-28T00:00:00Z';
          isTrou = false;
        }
      }

      sequencesMap.get(seq)!.push({
        ...act,
        type: isDevoir ? 'devoir' : act.type,
        status,
        completed_at: completedAt,
        is_devoir: isDevoir,
        is_trou: isTrou,
        is_completed: isCompleted,
      });
    }

    const allPortalActivities = Array.from(sequencesMap.values()).flat();
    const completed = allPortalActivities.filter(a => a.is_completed).length;
    const total = allPortalActivities.length;
    const completionRate = total > 0 ? Math.min(100, Math.round((completed / total) * 100 * 10) / 10) : 0;

    const sequences = Array.from(sequencesMap.entries()).map(([seqName, acts]) => ({
      sequence: seqName,
      total: acts.length,
      completed: acts.filter(a => a.is_completed).length,
      activities: acts,
    }));

    return {
      learner: {
        id: learner.id,
        first_name: learner.first_name,
        last_name: learner.last_name,
        email: learner.email,
        group_id: learner.group_id,
        status: learner.status,
        last_activity_at: learner.last_activity_at,
      },
      formation,
      formation_name: formation === 'gp'
        ? 'Module de spécialisation — Gestion de projets marketing 360°'
        : 'Formation initiale — Marketing numérique',
      certification_threshold: formation === 'gp' ? 12 : 10,
      completion_rate: completionRate,
      completed_activities: completed,
      total_activities: total,
      max_reached_order: maxValidOrder,
      unvalidated_assignments: unvalidatedAssignments,
      all_progression_holes: progressionHoles,
      has_unvalidated_assignments: hasUnvalidatedAssignments,
      pp_grades: formation === 'mn' ? this.getPPGradeForEmail(learner.email) : undefined,
      sequences,
    };
  }

  // ----------------------------------------------------------
  // Weekly Reports
  // ----------------------------------------------------------

  async getWeeklyReports(formation: string = 'mn', forceRefresh = false) {
    if (!forceRefresh) {
      const cached = this.weeklyReportsCache.get(formation);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    const allProgress = await this.getAllProgress();
    const allActivities = await this.getActivities(formation);
    const allLearners = await this.getLearners(formation);
    const learnerIdSet = new Set(allLearners.map(l => l.id));
    const activityIdSet = new Set(allActivities.map(a => a.id));
    const validProgress = allProgress.filter(p => p.completed_at && (p.status === 'completed' || p.status === 'passed') && learnerIdSet.has(p.learner_id) && activityIdSet.has(p.activity_id));
    
    const weeksMap = new Map<string, any>();

    const getMonday = (d: Date) => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
      return new Date(d.getFullYear(), d.getMonth(), diff);
    };

    for (const p of validProgress) {
      const d = new Date(p.completed_at!);
      if (isNaN(d.getTime())) continue;

      const monday = getMonday(d);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekKey = monday.toISOString().split('T')[0];
      const activity = allActivities.find(a => a.id === p.activity_id);
      if (!activity) continue;

      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, {
          week_start: monday.toISOString(),
          week_end: sunday.toISOString(),
          total_validations: 0,
          unique_learners: new Set(),
          validations_by_sequence: {},
          validations_by_day: {
            'Lundi': 0, 'Mardi': 0, 'Mercredi': 0, 'Jeudi': 0, 'Vendredi': 0, 'Samedi': 0, 'Dimanche': 0
          },
          validations_by_learner: {}
        });
      }

      const w = weeksMap.get(weekKey)!;
      w.total_validations++;
      w.unique_learners.add(p.learner_id);
      
      const seq = activity.sequence || 'Autre';
      w.validations_by_sequence[seq] = (w.validations_by_sequence[seq] || 0) + 1;

      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const dayName = days[d.getDay()];
      w.validations_by_day[dayName]++;
      
      w.validations_by_learner[p.learner_id] = (w.validations_by_learner[p.learner_id] || 0) + 1;
    }
    
    const result = [];
    for (const w of Array.from(weeksMap.values())) {
      const topLearnersRaw = Object.entries(w.validations_by_learner).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
      const topLearners = [];
      for (const [id, count] of topLearnersRaw) {
        const learner = allLearners.find(l => l.id === id);
        topLearners.push({
          name: learner ? `${learner.first_name} ${learner.last_name}` : 'Unknown',
          count
        });
      }

      result.push({
        week_start: w.week_start,
        week_end: w.week_end,
        total_validations: w.total_validations,
        active_learners: w.unique_learners.size,
        validations_by_sequence: Object.entries(w.validations_by_sequence).map(([seq, count]) => ({ sequence: seq, count })),
        validations_by_day: Object.entries(w.validations_by_day).map(([day, count]) => ({ day, count })),
        top_learners: topLearners
      });
    }

    const sortedResult = result.sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());
    this.weeklyReportsCache.set(formation, { data: sortedResult, timestamp: Date.now() });
    return sortedResult;
  }

  // ----------------------------------------------------------
  // Custom Reports
  // ----------------------------------------------------------

  async getCustomReport(startStr: string, endStr: string, formation: string = 'mn') {
    const allActivities = await this.getActivities(formation);
    const allLearners = await this.getLearners(formation);
    const learnerIdSet = new Set(allLearners.map(l => l.id));
    const activityIdSet = new Set(allActivities.map(a => a.id));

    const allProgress = await this.getAllProgress();
    const startDate = new Date(startStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endStr);
    endDate.setHours(23, 59, 59, 999);

    const validProgress = allProgress.filter(p => {
      if (!p.completed_at || (p.status !== 'completed' && p.status !== 'passed')) return false;
      if (!learnerIdSet.has(p.learner_id) || !activityIdSet.has(p.activity_id)) return false;
      const d = new Date(p.completed_at);
      if (isNaN(d.getTime())) return false;
      return d >= startDate && d <= endDate;
    });

    const report = {
      week_start: startDate.toISOString(),
      week_end: endDate.toISOString(),
      total_validations: 0,
      unique_learners: new Set<string>(),
      validations_by_sequence: {} as Record<string, number>,
      validations_by_day: {
        'Lundi': 0, 'Mardi': 0, 'Mercredi': 0, 'Jeudi': 0, 'Vendredi': 0, 'Samedi': 0, 'Dimanche': 0
      } as Record<string, number>,
      validations_by_learner: {} as Record<string, number>
    };

    for (const p of validProgress) {
      const d = new Date(p.completed_at!);
      const activity = allActivities.find(a => a.id === p.activity_id);
      if (!activity) continue;

      report.total_validations++;
      report.unique_learners.add(p.learner_id);

      const seq = activity.sequence || 'Autre';
      report.validations_by_sequence[seq] = (report.validations_by_sequence[seq] || 0) + 1;

      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const dayName = days[d.getDay()];
      report.validations_by_day[dayName]++;

      report.validations_by_learner[p.learner_id] = (report.validations_by_learner[p.learner_id] || 0) + 1;
    }

    const topLearnersRaw = Object.entries(report.validations_by_learner).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
    const topLearners = [];
    for (const [id, count] of topLearnersRaw) {
      const learner = allLearners.find(l => l.id === id);
      topLearners.push({
        name: learner ? `${learner.first_name} ${learner.last_name}` : 'Unknown',
        count
      });
    }

    return {
      week_start: report.week_start,
      week_end: report.week_end,
      total_validations: report.total_validations,
      active_learners: report.unique_learners.size,
      validations_by_sequence: Object.entries(report.validations_by_sequence).map(([seq, count]) => ({ sequence: seq, count })),
      validations_by_day: Object.entries(report.validations_by_day).map(([day, count]) => ({ day, count })),
      top_learners: topLearners
    };
  }

  // ----------------------------------------------------------
  // Upload tracking
  // ----------------------------------------------------------

  async addUpload(filename: string, fileType: 'csv' | 'xlsx' | 'md'): Promise<Upload> {
    const { data } = await supabase
      .from('uploads')
      .insert([{ filename, file_type: fileType, status: 'pending' }])
      .select()
      .single();
    return data as Upload;
  }

  async updateUpload(id: string, data: Partial<Upload>): Promise<void> {
    await supabase.from('uploads').update(data).eq('id', id);
  }

  async getUploads(formation?: string): Promise<Upload[]> {
    const { data } = await supabase.from('uploads').select('*').order('uploaded_at', { ascending: false });
    const all = (data as Upload[]) || [];
    if (!formation) return all;

    return all.filter(u => {
      const fn = u.filename.toLowerCase();
      if (formation === 'gp') {
        return fn.includes('gp') || fn.includes('gpm') || fn.includes('gestion');
      } else if (formation === 'mn') {
        return fn.includes('mn') || fn.includes('marketing') || fn.includes('courseid');
      }
      return true;
    });
  }

  // ----------------------------------------------------------
  // Communications
  // ----------------------------------------------------------

  async addCommunication(data: Omit<CommunicationLog, 'id'>): Promise<CommunicationLog> {
    const { data: inserted } = await supabase.from('communications').insert([data]).select().single();
    return inserted as CommunicationLog;
  }

  async getCommunicationsByLearner(learnerId: string): Promise<CommunicationLog[]> {
    const { data } = await supabase.from('communications').select('*').eq('learner_id', learnerId);
    return data as CommunicationLog[] || [];
  }

  // ----------------------------------------------------------
  // Alerts
  // ----------------------------------------------------------

  async addAlert(data: Omit<Alert, 'id'>): Promise<Alert> {
    const { data: inserted } = await supabase.from('alerts').insert([data]).select().single();
    return inserted as Alert;
  }

  async getActiveAlerts(): Promise<Alert[]> {
    const { data } = await supabase.from('alerts').select('*').or('status.eq.new,acknowledged.eq.false');
    return (data as Alert[] || []).map(a => ({
      ...a,
      acknowledged: a.acknowledged ?? (a.status === 'acknowledged')
    }));
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await supabase.from('alerts').update({ status: 'acknowledged', acknowledged: true }).eq('id', id);
  }

  // ----------------------------------------------------------
  // Reports
  // ----------------------------------------------------------

  async addReport(data: Omit<Report, 'id'>): Promise<Report> {
    const { data: inserted } = await supabase.from('reports').insert([data]).select().single();
    return inserted as Report;
  }

  async getReports(): Promise<Report[]> {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    return data as Report[] || [];
  }

  // ----------------------------------------------------------
  // Danger Zone — Reset data (scoped by formation or all)
  // ----------------------------------------------------------

  async clearData(formation?: string): Promise<{ deletedLearners: number; deletedActivities: number }> {
    if (!formation || formation === 'all') {
      await supabase.from('progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('communications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('learners').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return { deletedLearners: 0, deletedActivities: 0 };
    }

    const targetFormation = formation.toLowerCase() as 'mn' | 'gp';

    // 1. Fetch learners belonging to this specific formation
    const targetLearners = await this.getLearners(targetFormation);
    const targetLearnerIds = targetLearners.map(l => l.id);

    // 2. Fetch activities belonging to this specific formation
    const targetActivities = await this.getActivities(targetFormation);
    const targetActivityIds = targetActivities.map(a => a.id);

    // 3. Delete progress for these learners
    if (targetLearnerIds.length > 0) {
      for (let i = 0; i < targetLearnerIds.length; i += 200) {
        const chunk = targetLearnerIds.slice(i, i + 200);
        await supabase.from('progress').delete().in('learner_id', chunk);
      }
    }

    // 4. Delete progress for these activities
    if (targetActivityIds.length > 0) {
      for (let i = 0; i < targetActivityIds.length; i += 200) {
        const chunk = targetActivityIds.slice(i, i + 200);
        await supabase.from('progress').delete().in('activity_id', chunk);
      }
    }

    // 5. Delete communications for these learners
    if (targetLearnerIds.length > 0) {
      for (let i = 0; i < targetLearnerIds.length; i += 200) {
        const chunk = targetLearnerIds.slice(i, i + 200);
        await supabase.from('communications').delete().in('learner_id', chunk);
      }
    }

    // 6. Delete alerts for these learners
    if (targetLearnerIds.length > 0) {
      for (let i = 0; i < targetLearnerIds.length; i += 200) {
        const chunk = targetLearnerIds.slice(i, i + 200);
        await supabase.from('alerts').delete().in('learner_id', chunk);
      }
    }

    // 7. Delete activities belonging to this formation
    if (targetFormation === 'gp') {
      await supabase.from('activities').delete().eq('formation_type', 'gp');
    } else if (targetFormation === 'mn') {
      await supabase.from('activities').delete().or('formation_type.eq.mn,formation_type.is.null');
    }

    // 8. Delete learners belonging to this formation
    if (targetLearnerIds.length > 0) {
      for (let i = 0; i < targetLearnerIds.length; i += 200) {
        const chunk = targetLearnerIds.slice(i, i + 200);
        await supabase.from('learners').delete().in('id', chunk);
      }
    }

    // 9. Delete upload history for this formation
    await this.clearUploadHistory(targetFormation);

    this.invalidateCache(targetFormation);
    return { deletedLearners: targetLearners.length, deletedActivities: targetActivities.length };
  }

  async clearAllData(): Promise<void> {
    await this.clearData('all');
    this.invalidateCache();
  }

  async clearUploadHistory(formation?: string): Promise<void> {
    if (formation) {
      const { data: all } = await supabase.from('uploads').select('*');
      if (all) {
        const toDelete = all.filter(u => {
          const fn = u.filename.toLowerCase();
          if (formation === 'gp') {
            return fn.includes('gp') || fn.includes('gpm') || fn.includes('gestion');
          } else {
            return fn.includes('mn') || fn.includes('marketing') || fn.includes('courseid');
          }
        }).map(u => u.id);

        if (toDelete.length > 0) {
          for (let i = 0; i < toDelete.length; i += 100) {
            await supabase.from('uploads').delete().in('id', toDelete.slice(i, i + 100));
          }
        }
      }
    } else {
      await supabase.from('uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  }
}

// Singleton instance
export const store = new DataStore();
