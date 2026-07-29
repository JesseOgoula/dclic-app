// ============================================================
// Supabase Data Store
// ============================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

import type {
  Learner, Activity, LearnerProgress, Upload, CommunicationLog,
  Evaluation, Report, Alert, DashboardStats, LearnerWithProgress, SequenceStat
} from '../types.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

class DataStore {
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

  async getLearners(): Promise<Learner[]> {
    const { data } = await supabase
      .from('learners')
      .select('*')
      .eq('group_id', 'G1_MN_072026');
    return data as Learner[] || [];
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
    const { data: existing } = await supabase
      .from('activities')
      .select('*')
      .eq('code', data.code)
      .single();

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

  async getActivities(): Promise<Activity[]> {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .order('display_order', { ascending: true });
    return data as Activity[] || [];
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

  async getAllProgress(): Promise<LearnerProgress[]> {
    const { data } = await supabase.from('progress').select('*');
    return data as LearnerProgress[] || [];
  }

  // ----------------------------------------------------------
  // Dashboard stats
  // ----------------------------------------------------------

  async getDashboardStats(): Promise<DashboardStats> {
    const allLearners = await this.getLearners();
    const allActivities = await this.getActivities();
    const allProgress = await this.getAllProgress();
    const now = new Date();

    const learnersWithProgress: LearnerWithProgress[] = allLearners.map(learner => {
      const learnerProgress = allProgress.filter(p => p.learner_id === learner.id);
      const completedActivities = learnerProgress.filter(
        p => p.status === 'completed' || p.status === 'passed'
      ).length;
      const totalActivities = allActivities.length;
      const completionRate = totalActivities > 0
        ? Math.round((completedActivities / totalActivities) * 100 * 10) / 10
        : 0;

      const lastActivity = learnerProgress
        .filter(p => p.completed_at)
        .map(p => new Date(p.completed_at!).getTime())
        .sort((a, b) => b - a)[0];

      const daysInactive = lastActivity
        ? Math.floor((now.getTime() - lastActivity) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        ...learner,
        completion_rate: completionRate,
        completed_activities: completedActivities,
        total_activities: totalActivities,
        days_inactive: daysInactive,
        progress: learnerProgress,
      };
    });

    for (const lwp of learnersWithProgress) {
      let status = 'active';
      if (lwp.days_inactive > 14) status = 'dropped';
      else if (lwp.days_inactive > 7) status = 'inactive';
      
      if (lwp.status !== status) {
         await supabase.from('learners').update({ status }).eq('id', lwp.id);
      }
    }

    const activeLearners = learnersWithProgress.filter(l => l.days_inactive <= 7).length;
    const inactiveLearners = learnersWithProgress.filter(l => l.days_inactive > 7 && l.days_inactive <= 14).length;
    const droppedLearners = learnersWithProgress.filter(l => l.days_inactive > 14).length;

    const avgCompletion = learnersWithProgress.length > 0
      ? Math.round(learnersWithProgress.reduce((sum, l) => sum + l.completion_rate, 0) / learnersWithProgress.length * 10) / 10
      : 0;

    const sequenceStats: SequenceStat[] = [];
    const sequences = Array.from(new Set(allActivities.map(a => a.sequence)));
    
    for (const seq of sequences) {
      const seqActivities = allActivities.filter(a => a.sequence === seq);
      let totalCompletions = 0;
      let completedCount = 0;
      let inProgressCount = 0;
      let notStartedCount = 0;

      for (const learner of allLearners) {
        const learnerProgress = allProgress.filter(p => p.learner_id === learner.id);
        
        let learnerSeqCompleted = 0;
        for (const act of seqActivities) {
          const prog = learnerProgress.find(p => p.activity_id === act.id);
          if (prog && (prog.status === 'completed' || prog.status === 'passed')) {
            learnerSeqCompleted++;
            totalCompletions++;
          }
        }
        
        if (seqActivities.length > 0) {
          if (learnerSeqCompleted === seqActivities.length) completedCount++;
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

    const sorted = [...learnersWithProgress].sort((a, b) => b.completion_rate - a.completion_rate);
    const topPerformers = sorted.slice(0, 10);

    const atRisk = learnersWithProgress
      .filter(l => l.days_inactive > 5 || l.completion_rate < 20)
      .sort((a, b) => b.days_inactive - a.days_inactive)
      .slice(0, 10);

    return {
      total_learners: allLearners.length,
      active_learners: activeLearners,
      inactive_learners: inactiveLearners,
      dropped_learners: droppedLearners,
      completion_rate: avgCompletion,
      sequence_stats: sequenceStats,
      top_performers: topPerformers,
      at_risk: atRisk,
    };
  }

  // ----------------------------------------------------------
  // Weekly Reports
  // ----------------------------------------------------------

  async getWeeklyReports() {
    const allProgress = await this.getAllProgress();
    const validProgress = allProgress.filter(p => p.completed_at && (p.status === 'completed' || p.status === 'passed'));
    
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
      const activity = await this.getActivityById(p.activity_id);
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
        const learner = await this.getLearnerById(id);
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

    return result.sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());
  }

  // ----------------------------------------------------------
  // Upload tracking
  // ----------------------------------------------------------

  async addUpload(filename: string, fileType: 'csv' | 'xlsx'): Promise<Upload> {
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

  async getUploads(): Promise<Upload[]> {
    const { data } = await supabase.from('uploads').select('*').order('uploaded_at', { ascending: false });
    return data as Upload[] || [];
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
    const { data } = await supabase.from('alerts').select('*').eq('status', 'new');
    return data as Alert[] || [];
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await supabase.from('alerts').update({ status: 'acknowledged' }).eq('id', id);
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
  // Danger Zone
  // ----------------------------------------------------------

  async clearAllData(): Promise<void> {
    await supabase.from('learners').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  async clearUploadHistory(): Promise<void> {
    await supabase.from('uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

// Singleton instance
export const store = new DataStore();
