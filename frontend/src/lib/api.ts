// ============================================================
// API Client — Typed wrapper for backend API calls
// ============================================================

// Use environment variable for production API URL, fallback to Render backend
const API_BASE = import.meta.env.VITE_API_URL || 'https://dclic-backend.onrender.com/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.details || `API Error: ${res.status}`);
  }

  const data = await res.json();
  return data.data;
}

// ============================================================
// Types (mirroring backend)
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

export interface LearnerWithProgress extends Learner {
  completion_rate: number;
  completed_activities: number;
  total_activities: number;
  days_inactive: number;
}

export interface LearnerDetail extends LearnerWithProgress {
  activities: ActivityProgress[];
  communications: CommunicationLog[];
}

export interface ActivityProgress {
  id: string;
  code: string;
  name: string;
  sequence: string;
  type: string;
  is_evaluated: boolean;
  display_order: number;
  status: string;
  completed_at: string | null;
  grade: number | null;
}

export interface Activity {
  code: string;
  name: string;
  sequence: string;
}

export interface HeatmapData {
  activities: Activity[];
  learners: {
    learner_id: string;
    learner_name: string;
    email: string;
    activities: Record<string, string>;
  }[];
}

export interface CommunicationLog {
  id: string;
  learner_id: string;
  channel: string;
  type: string;
  content: string;
  status: string;
  sent_at: string | null;
}

export interface Alert {
  id: string;
  learner_id: string;
  learner_name: string;
  type: string;
  message: string;
  acknowledged: boolean;
  triggered_at: string;
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

// ============================================================
// API functions
// ============================================================

export const api = {
  // Dashboard
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  // Learners
  getLearners: (params?: { search?: string; status?: string; sortBy?: string; sortDir?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.sortDir) searchParams.set('sortDir', params.sortDir);
    const qs = searchParams.toString();
    return request<LearnerWithProgress[]>(`/learners${qs ? `?${qs}` : ''}`);
  },

  getLearner: (id: string) => request<LearnerDetail>(`/learners/${id}`),

  // Activities
  getActivities: () => request<Activity[]>('/activities'),

  // Heatmap
  getHeatmap: () => request<HeatmapData>('/progress/heatmap'),

  // Alerts
  getAlerts: () => request<Alert[]>('/alerts'),
  acknowledgeAlert: (id: string) => request<void>(`/alerts/${id}/acknowledge`, { method: 'POST' }),

  // Communications
  getCommunications: (learnerId?: string) => {
    const qs = learnerId ? `?learner_id=${learnerId}` : '';
    return request<CommunicationLog[]>(`/communications${qs}`);
  },
  saveCommunication: (data: Omit<CommunicationLog, 'id'>) =>
    request<CommunicationLog>('/communications', { method: 'POST', body: JSON.stringify(data) }),

  // Upload
  uploadFile: async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `Upload failed: ${res.status}`);
    }

    const data = await res.json();
    return data.data;
  },

  // Reports
  getWeeklyReports: () => request<any[]>('/reports/weekly'),
  getCustomReport: (startDate: string, endDate: string) => 
    request<any>(`/reports/custom?start=${startDate}&end=${endDate}`),

  getUploads: () => request<any[]>('/uploads'),
  
  clearHistory: () => request<void>('/uploads', { method: 'DELETE' }),
  resetData: () => request<void>('/reset', { method: 'DELETE' }),
};
