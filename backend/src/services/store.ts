// ============================================================
// In-memory data store — Will be replaced by Supabase later
// Provides immediate functionality without DB setup
// ============================================================


import type {
  Learner, Activity, LearnerProgress, Upload, CommunicationLog,
  Evaluation, Report, Alert, DashboardStats, LearnerWithProgress, SequenceStat
} from '../types.js';

function genId(): string {
  return crypto.randomUUID();
}

class DataStore {
  learners: Map<string, Learner> = new Map();         // keyed by email
  activities: Map<string, Activity> = new Map();       // keyed by code
  progress: LearnerProgress[] = [];
  uploads: Upload[] = [];
  communications: CommunicationLog[] = [];
  evaluations: Evaluation[] = [];
  reports: Report[] = [];
  alerts: Alert[] = [];

  // ----------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------

  saveToFile() {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataPath = path.join(process.cwd(), 'data.json');
      const state = {
        learners: Array.from(this.learners.entries()),
        activities: Array.from(this.activities.entries()),
        progress: this.progress,
        uploads: this.uploads,
        communications: this.communications,
        evaluations: this.evaluations,
        reports: this.reports,
        alerts: this.alerts,
      };
      fs.writeFileSync(dataPath, JSON.stringify(state), 'utf-8');
    } catch (err) {
      console.error('Failed to save state to disk', err);
    }
  }

  loadFromFile(): boolean {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataPath = path.join(process.cwd(), 'data.json');
      if (fs.existsSync(dataPath)) {
        const state = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        this.learners = new Map(state.learners || []);
        this.activities = new Map(state.activities || []);
        this.progress = state.progress || [];
        this.uploads = state.uploads || [];
        this.communications = state.communications || [];
        this.evaluations = state.evaluations || [];
        this.reports = state.reports || [];
        this.alerts = state.alerts || [];
        return true;
      }
    } catch (err) {
      console.error('Failed to load state from disk', err);
    }
    return false;
  }

  // ----------------------------------------------------------
  // Learner operations
  // ----------------------------------------------------------

  upsertLearner(data: Omit<Learner, 'id' | 'created_at' | 'status'>): Learner {
    const existing = this.learners.get(data.email);
    if (existing) {
      existing.first_name = data.first_name;
      existing.last_name = data.last_name;
      existing.group_id = data.group_id;
      if (data.last_activity_at) {
        existing.last_activity_at = data.last_activity_at;
      }
      return existing;
    }

    const learner: Learner = {
      id: genId(),
      ...data,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    this.learners.set(data.email, learner);
    return learner;
  }

  getLearners(): Learner[] {
    // Only return learners that belong to the target group
    return Array.from(this.learners.values()).filter(l => l.group_id === 'G1_MN_072026');
  }

  getLearnerByEmail(email: string): Learner | undefined {
    return this.learners.get(email.toLowerCase());
  }

  getLearnerById(id: string): Learner | undefined {
    return Array.from(this.learners.values()).find(l => l.id === id);
  }

  // ----------------------------------------------------------
  // Activity operations
  // ----------------------------------------------------------

  upsertActivity(data: Omit<Activity, 'id'>): Activity {
    const existing = this.activities.get(data.code);
    if (existing) {
      Object.assign(existing, data);
      return existing;
    }

    const activity: Activity = {
      id: genId(),
      ...data,
    };
    this.activities.set(data.code, activity);
    return activity;
  }

  getActivities(): Activity[] {
    return Array.from(this.activities.values())
      .sort((a, b) => a.display_order - b.display_order);
  }

  getActivityByCode(code: string): Activity | undefined {
    return this.activities.get(code);
  }

  getActivityById(id: string): Activity | undefined {
    return Array.from(this.activities.values()).find(a => a.id === id);
  }

  // ----------------------------------------------------------
  // Progress operations
  // ----------------------------------------------------------

  addProgress(data: Omit<LearnerProgress, 'id' | 'created_at'>): LearnerProgress {
    // Check for existing
    const existing = this.progress.find(
      p => p.learner_id === data.learner_id && p.activity_id === data.activity_id
    );
    if (existing) {
      existing.status = data.status;
      existing.completed_at = data.completed_at;
      existing.grade = data.grade;
      existing.upload_id = data.upload_id;
      return existing;
    }

    const record: LearnerProgress = {
      id: genId(),
      ...data,
      created_at: new Date().toISOString(),
    };
    this.progress.push(record);
    return record;
  }

  getProgressByLearner(learnerId: string): LearnerProgress[] {
    return this.progress.filter(p => p.learner_id === learnerId);
  }

  // ----------------------------------------------------------
  // Dashboard stats
  // ----------------------------------------------------------

  getDashboardStats(): DashboardStats {
    const allLearners = this.getLearners();
    const allActivities = this.getActivities();
    const now = new Date();

    // Calculate completion rate and status for each learner
    const learnersWithProgress: LearnerWithProgress[] = allLearners.map(learner => {
      const learnerProgress = this.getProgressByLearner(learner.id);
      const completedActivities = learnerProgress.filter(
        p => p.status === 'completed' || p.status === 'passed'
      ).length;
      const totalActivities = allActivities.length;
      const completionRate = totalActivities > 0
        ? Math.round((completedActivities / totalActivities) * 100 * 10) / 10
        : 0;

      // Calculate days inactive
      const lastActivity = learnerProgress
        .filter(p => p.completed_at)
        .map(p => new Date(p.completed_at!).getTime())
        .sort((a, b) => b - a)[0];

      const daysInactive = lastActivity
        ? Math.floor((now.getTime() - lastActivity) / (1000 * 60 * 60 * 24))
        : 999; // Never active

      return {
        ...learner,
        completion_rate: completionRate,
        completed_activities: completedActivities,
        total_activities: totalActivities,
        days_inactive: daysInactive,
        progress: learnerProgress,
      };
    });

    // Update learner statuses
    for (const lwp of learnersWithProgress) {
      const learner = this.learners.get(lwp.email);
      if (learner) {
        if (lwp.days_inactive > 14) learner.status = 'dropped';
        else if (lwp.days_inactive > 7) learner.status = 'inactive';
        else learner.status = 'active';
      }
    }

    const activeLearners = learnersWithProgress.filter(l => l.days_inactive <= 7).length;
    const inactiveLearners = learnersWithProgress.filter(l => l.days_inactive > 7 && l.days_inactive <= 14).length;
    const droppedLearners = learnersWithProgress.filter(l => l.days_inactive > 14).length;

    // Completion rate
    const avgCompletion = learnersWithProgress.length > 0
      ? Math.round(learnersWithProgress.reduce((sum, l) => sum + l.completion_rate, 0) / learnersWithProgress.length * 10) / 10
      : 0;

    // Sequence stats
    const sequenceStats: SequenceStat[] = [];
    const sequences = Array.from(new Set(allActivities.map(a => a.sequence)));
    
    for (const seq of sequences) {
      const seqActivities = allActivities.filter(a => a.sequence === seq);
      let totalCompletions = 0;
      let completedCount = 0;
      let inProgressCount = 0;
      let notStartedCount = 0;

      for (const learner of allLearners) {
        const learnerProgress = this.progress.filter(p => p.learner_id === learner.id);
        
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

    // Top performers (top 10 by completion)
    const sorted = [...learnersWithProgress].sort((a, b) => b.completion_rate - a.completion_rate);
    const topPerformers = sorted.slice(0, 10);

    // At risk (inactive + low completion)
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

  getWeeklyReports() {
    const validProgress = this.progress.filter(p => p.completed_at && (p.status === 'completed' || p.status === 'passed'));
    
    const weeksMap = new Map<string, {
      week_start: string;
      week_end: string;
      total_validations: number;
      unique_learners: Set<string>;
      validations_by_sequence: Record<string, number>;
      validations_by_day: Record<string, number>;
      validations_by_learner: Record<string, number>;
    }>();

    const getMonday = (d: Date) => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
      return new Date(d.getFullYear(), d.getMonth(), diff);
    };

    for (const p of validProgress) {
      const d = new Date(p.completed_at!);
      if (isNaN(d.getTime())) continue; // Safeguard

      const monday = getMonday(d);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekKey = monday.toISOString().split('T')[0];
      const activity = this.getActivityById(p.activity_id);
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
    
    return Array.from(weeksMap.values()).map(w => {
      const topLearners = Object.entries(w.validations_by_learner)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => {
          const learner = this.getLearnerById(id);
          return {
            name: learner ? `${learner.first_name} ${learner.last_name}` : 'Unknown',
            count
          };
        });

      return {
        week_start: w.week_start,
        week_end: w.week_end,
        total_validations: w.total_validations,
        active_learners: w.unique_learners.size,
        validations_by_sequence: Object.entries(w.validations_by_sequence).map(([seq, count]) => ({
          sequence: seq,
          count,
        })),
        validations_by_day: Object.entries(w.validations_by_day).map(([day, count]) => ({
          day,
          count
        })),
        top_learners: topLearners
      };
    }).sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());
  }

  // ----------------------------------------------------------
  // Upload tracking
  // ----------------------------------------------------------

  addUpload(filename: string, fileType: 'csv' | 'xlsx'): Upload {
    const upload: Upload = {
      id: genId(),
      filename,
      file_type: fileType,
      uploaded_at: new Date().toISOString(),
      rows_processed: 0,
      status: 'pending',
    };
    this.uploads.push(upload);
    return upload;
  }

  updateUpload(id: string, data: Partial<Upload>): void {
    const upload = this.uploads.find(u => u.id === id);
    if (upload) Object.assign(upload, data);
  }

  getUploads(): Upload[] {
    return [...this.uploads].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }

  // ----------------------------------------------------------
  // Communications
  // ----------------------------------------------------------

  addCommunication(data: Omit<CommunicationLog, 'id'>): CommunicationLog {
    const comm: CommunicationLog = { id: genId(), ...data };
    this.communications.push(comm);
    return comm;
  }

  getCommunicationsByLearner(learnerId: string): CommunicationLog[] {
    return this.communications.filter(c => c.learner_id === learnerId);
  }

  // ----------------------------------------------------------
  // Alerts
  // ----------------------------------------------------------

  addAlert(data: Omit<Alert, 'id'>): Alert {
    const alert: Alert = { id: genId(), ...data };
    this.alerts.push(alert);
    return alert;
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  acknowledgeAlert(id: string): void {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) alert.acknowledged = true;
  }

  // ----------------------------------------------------------
  // Reports
  // ----------------------------------------------------------

  addReport(data: Omit<Report, 'id'>): Report {
    const report: Report = { id: genId(), ...data };
    this.reports.push(report);
    return report;
  }

  getReports(): Report[] {
    return this.reports.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

// Singleton instance
export const store = new DataStore();
