// ============================================================
// DCLIC Backend — Shared Types
// ============================================================

export interface Learner {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  group_id: string;
  status: 'active' | 'inactive' | 'dropped';
  last_activity_at: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  session_id: string;
  tutor_name: string;
  tutor_email: string;
  learner_count: number;
}

export interface Session {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  formation_type: 'bases' | 'projet' | 'specialisation';
}

export interface Activity {
  id: string;
  code: string;        // M1A, M2B, etc.
  name: string;
  sequence: string;    // Séquence 1, 2, etc.
  type: 'exercise' | 'quiz' | 'devoir' | 'documentation';
  is_evaluated: boolean;
  display_order: number;
}

export interface LearnerProgress {
  id: string;
  learner_id: string;
  activity_id: string;
  status: 'completed' | 'not_completed' | 'passed' | 'failed';
  completed_at: string | null;
  grade: number | null;
  upload_id: string | null;
  created_at: string;
}

export interface Upload {
  id: string;
  filename: string;
  file_type: 'csv' | 'xlsx' | 'md';
  uploaded_at: string;
  rows_processed: number;
  status: 'pending' | 'processed' | 'error';
  completion_rate?: number;
}

export interface CommunicationLog {
  id: string;
  learner_id: string;
  channel: 'email' | 'whatsapp' | 'platform';
  type: 'relance' | 'felicitation' | 'annonce' | 'cloture';
  content: string;
  status: 'draft' | 'sent' | 'delivered';
  sent_at: string | null;
}

export interface Evaluation {
  id: string;
  learner_id: string;
  activity_id: string;
  grading_details: {
    strategie?: { note: number; commentaire: string };
    gestion_projet?: { note: number; commentaire: string };
    contenus?: { note: number; commentaire: string };
    tableau_bord?: { note: number; commentaire: string };
  };
  total_grade: number;
  feedback_text: string;
  status: 'pending' | 'reviewed' | 'published';
  evaluated_at: string;
}

export interface Report {
  id: string;
  type: 'weekly' | 'final';
  group_id: string;
  session_id: string;
  period_start: string;
  period_end: string;
  content: Record<string, unknown>;
  generated_by: 'ai' | 'manual';
  created_at: string;
}

export interface Alert {
  id: string;
  learner_id: string;
  type: 'inactivity' | 'deadline' | 'dropout_risk';
  message: string;
  acknowledged: boolean;
  triggered_at: string;
}

// ============================================================
// API Response types
// ============================================================

export interface DashboardStats {
  total_learners: number;
  active_learners: number;
  inactive_learners: number;
  dropped_learners: number;
  completion_rate: number;
  completion_evolution?: number;
  sequence_stats: SequenceStat[];
  top_performers: LearnerWithProgress[];
  at_risk: LearnerWithProgress[];
  blocked_learners: LearnerWithProgress[];
}

export interface SequenceStat {
  sequence: string;
  total_activities: number;
  avg_completion: number;
  learners_completed: number;
  learners_in_progress: number;
  learners_not_started: number;
}

export interface LearnerWithProgress extends Learner {
  completion_rate: number;
  completed_activities: number;
  total_activities: number;
  days_inactive: number;
  progress: LearnerProgress[];
}

// ============================================================
// Parser types
// ============================================================

export interface ParsedCSVRow {
  name: string;
  email: string;
  activities: {
    name: string;
    status: string;
    completed_at: string | null;
  }[];
}

export interface ParsedParticipant {
  first_name: string;
  last_name: string;
  email: string;
  group: string;
}

export interface UploadResult {
  upload_id: string;
  filename: string;
  rows_processed: number;
  learners_created: number;
  learners_updated: number;
  progress_records: number;
  errors: string[];
}
