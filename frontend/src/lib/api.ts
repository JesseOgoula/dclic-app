// ============================================================
// API Client — Typed wrapper for backend API calls
// ============================================================

// Use environment variable for production API URL, fallback to Render backend
const API_BASE = import.meta.env.VITE_API_URL || 'https://dclic-backend.onrender.com/api';

const TOKEN_KEY = 'dclic_admin_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(TOKEN_KEY),
  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY),
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && !path.includes('/auth/')) {
      authStorage.removeToken();
    }
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
  completed_phase1_learners: number;
  completed_learners: number;
  completion_rate: number;
  completion_evolution?: number;
  sequence_stats: SequenceStat[];
  top_performers: LearnerWithProgress[];
  at_risk: LearnerWithProgress[];
  blocked_learners: LearnerWithProgress[];
  completed_phase1_list: LearnerWithProgress[];
  completed_list: LearnerWithProgress[];
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
  status: 'active' | 'inactive' | 'dropped' | 'completed_phase1' | 'completed';
  last_activity_at: string | null;
  created_at: string;
}

export interface ProgressionHole {
  activity_id: string;
  code: string;
  name: string;
  sequence: string;
  type: string;
  is_evaluated: boolean;
  status: string;
  completed_at: string | null;
  display_order: number;
}

export interface LearnerWithProgress extends Learner {
  completion_rate: number;
  completed_activities: number;
  total_activities: number;
  days_inactive: number;
  failed_modules?: string[];
  progression_holes?: ProgressionHole[];
  unvalidated_assignments?: ProgressionHole[];
  has_unvalidated_assignments?: boolean;
  is_blocked?: boolean;
}

export interface LearnerDetail extends LearnerWithProgress {
  activities: ActivityProgress[];
  communications: CommunicationLog[];
  max_reached_order?: number;
}

export interface LearnerPortalData {
  learner: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    group_id: string;
    status: string;
    last_activity_at: string | null;
  };
  completion_rate: number;
  completed_activities: number;
  total_activities: number;
  max_reached_order: number;
  unvalidated_assignments: ProgressionHole[];
  all_progression_holes: ProgressionHole[];
  has_unvalidated_assignments: boolean;
  sequences: {
    sequence: string;
    total: number;
    completed: number;
    activities: (ActivityProgress & {
      is_devoir: boolean;
      is_trou: boolean;
    })[];
  }[];
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
  learner_name?: string;
  type: string;
  message: string;
  status?: string;
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

export type FormationType = 'mn' | 'gp';

export interface FormationInfo {
  id: FormationType;
  name: string;
  subtitle: string;
  group_id: string;
  learner_count: number;
  period: string;
}

const FORMATION_KEY = 'dclic_selected_formation';

export const formationStorage = {
  getFormation: (): FormationType | null => {
    return (localStorage.getItem(FORMATION_KEY) as FormationType) || null;
  },
  setFormation: (formation: FormationType) => {
    localStorage.setItem(FORMATION_KEY, formation);
  },
  hasSelectedFormation: (): boolean => {
    return !!localStorage.getItem(FORMATION_KEY);
  },
  clearFormation: () => {
    localStorage.removeItem(FORMATION_KEY);
  },
};

export const api = {
  // Formations
  getFormations: () => request<FormationInfo[]>('/formations'),

  // Dashboard
  getDashboardStats: (formation?: string) => {
    const qs = formation ? `?formation=${encodeURIComponent(formation)}` : '';
    return request<DashboardStats>(`/dashboard/stats${qs}`);
  },

  // Learners
  getLearners: (params?: { search?: string; status?: string; sortBy?: string; sortDir?: string; formation?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.sortDir) searchParams.set('sortDir', params.sortDir);
    if (params?.formation) searchParams.set('formation', params.formation);
    const qs = searchParams.toString();
    return request<LearnerWithProgress[]>(`/learners${qs ? `?${qs}` : ''}`);
  },

  getLearner: (id: string, formation?: string) => {
    const qs = formation ? `?formation=${encodeURIComponent(formation)}` : '';
    return request<LearnerDetail>(`/learners/${id}${qs}`);
  },

  getLearnerPortal: (email: string, formation?: string) => {
    const params = new URLSearchParams({ email });
    if (formation) params.set('formation', formation);
    return request<LearnerPortalData>(`/portal/learner?${params.toString()}`);
  },

  // Activities
  getActivities: (formation?: string) => {
    const qs = formation ? `?formation=${encodeURIComponent(formation)}` : '';
    return request<Activity[]>(`/activities${qs}`);
  },

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

    const token = authStorage.getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `Upload failed: ${res.status}`);
    }

    const data = await res.json();
    return data.data;
  },

  // Auth
  login: (password: string) =>
    request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  checkAuth: () => request<{ authenticated: boolean }>('/auth/check'),
  logout: () => authStorage.removeToken(),
  isAuthenticated: () => authStorage.isAuthenticated(),

  // Reports
  getWeeklyReports: (formation?: string) => {
    const qs = formation ? `?formation=${encodeURIComponent(formation)}` : '';
    return request<any[]>(`/reports/weekly${qs}`);
  },
  getCustomReport: (startDate: string, endDate: string, formation?: string) => {
    const params = new URLSearchParams({ start: startDate, end: endDate });
    if (formation) params.set('formation', formation);
    return request<any>(`/reports/custom?${params.toString()}`);
  },

  getUploads: () => request<any[]>('/uploads'),
  
  clearHistory: () => request<void>('/uploads', { method: 'DELETE' }),
  resetData: () => request<void>('/reset', { method: 'DELETE' }),
};
