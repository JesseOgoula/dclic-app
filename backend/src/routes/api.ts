// ============================================================
// API Routes — Express Router
// ============================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { processUpload } from '../services/uploadService.js';
import { store } from '../services/store.js';

const router = Router();

// File upload config
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported. Use CSV or XLSX.`));
    }
  },
});

// ============================================================
// Upload endpoints
// ============================================================

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await processUpload(req.file.path, req.file.originalname);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/uploads', (_req: Request, res: Response) => {
  res.json({ success: true, data: store.getUploads() });
});

// ============================================================
// Reports endpoints
// ============================================================

router.get('/reports/weekly', (_req: Request, res: Response) => {
  const reports = store.getWeeklyReports();
  res.json({ success: true, data: reports });
});

// ============================================================
// Dashboard endpoints
// ============================================================

router.get('/dashboard/stats', (_req: Request, res: Response) => {
  const stats = store.getDashboardStats();
  res.json({ success: true, data: stats });
});

// ============================================================
// Learner endpoints
// ============================================================

router.get('/learners', (req: Request, res: Response) => {
  let learners = store.getLearners();

  // Filter by status
  const status = req.query.status as string;
  if (status) {
    learners = learners.filter(l => l.status === status);
  }

  // Search by name or email
  const search = (req.query.search as string || '').toLowerCase();
  if (search) {
    learners = learners.filter(l =>
      l.first_name.toLowerCase().includes(search) ||
      l.last_name.toLowerCase().includes(search) ||
      l.email.toLowerCase().includes(search)
    );
  }

  // Enrich with progress
  const activities = store.getActivities();
  const enriched = learners.map(l => {
    const progress = store.getProgressByLearner(l.id);
    const completed = progress.filter(p => p.status === 'completed' || p.status === 'passed').length;
    const total = activities.length;
    const timestamps = progress
      .filter(p => p.completed_at)
      .map(p => new Date(p.completed_at!).getTime())
      .filter(t => !isNaN(t));
    const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : null;
    const daysInactive = lastActivity
      ? Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24))
      : 999;

    return {
      ...l,
      completion_rate: total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0,
      completed_activities: completed,
      total_activities: total,
      days_inactive: daysInactive,
    };
  });

  // Sort
  const sortBy = req.query.sortBy as string || 'last_name';
  const sortDir = req.query.sortDir === 'desc' ? -1 : 1;
  enriched.sort((a, b) => {
    if (sortBy === 'completion_rate') return (a.completion_rate - b.completion_rate) * sortDir;
    if (sortBy === 'days_inactive') return (a.days_inactive - b.days_inactive) * sortDir;
    return (a[sortBy as keyof typeof a] || '').toString()
      .localeCompare((b[sortBy as keyof typeof b] || '').toString()) * sortDir;
  });

  res.json({ success: true, data: enriched, total: enriched.length });
});

router.get('/learners/:id', (req: Request, res: Response) => {
  const param = req.params.id;
  const learner = param.includes('@') 
    ? store.getLearnerByEmail(param) 
    : store.getLearnerById(param);
    
  if (!learner) {
    return res.status(404).json({ error: 'Learner not found' });
  }

  const progress = store.getProgressByLearner(learner.id);
  const activities = store.getActivities();
  const communications = store.getCommunicationsByLearner(learner.id);

  // Merge progress with activity details
  const activityProgress = activities.map(activity => {
    const prog = progress.find(p => p.activity_id === activity.id);
    return {
      ...activity,
      status: prog?.status || 'not_completed',
      completed_at: prog?.completed_at || null,
      grade: prog?.grade || null,
    };
  });

  const completed = progress.filter(p => p.status === 'completed' || p.status === 'passed').length;

  const lastActivity = progress
    .filter(p => p.completed_at)
    .map(p => new Date(p.completed_at!).getTime())
    .sort((a, b) => b - a)[0];

  const daysInactive = lastActivity
    ? Math.floor((new Date().getTime() - lastActivity) / (1000 * 60 * 60 * 24))
    : 999;

  res.json({
    success: true,
    data: {
      ...learner,
      completion_rate: activities.length > 0
        ? Math.round((completed / activities.length) * 100 * 10) / 10
        : 0,
      completed_activities: completed,
      total_activities: activities.length,
      days_inactive: daysInactive,
      activities: activityProgress,
      communications,
    },
  });
});

// ============================================================
// Activity endpoints
// ============================================================

router.get('/activities', (_req: Request, res: Response) => {
  const activities = store.getActivities();
  res.json({ success: true, data: activities });
});

// ============================================================
// Progress heatmap data
// ============================================================

router.get('/progress/heatmap', (_req: Request, res: Response) => {
  const learners = store.getLearners();
  const activities = store.getActivities();

  const heatmapData = learners.map(learner => {
    const progress = store.getProgressByLearner(learner.id);
    const activityStatuses: Record<string, string> = {};

    for (const activity of activities) {
      const prog = progress.find(p => p.activity_id === activity.id);
      activityStatuses[activity.code] = prog?.status || 'not_completed';
    }

    return {
      learner_id: learner.id,
      learner_name: `${learner.first_name} ${learner.last_name}`,
      email: learner.email,
      activities: activityStatuses,
    };
  });

  res.json({
    success: true,
    data: {
      activities: activities.map(a => ({ code: a.code, name: a.name, sequence: a.sequence })),
      learners: heatmapData,
    },
  });
});

// ============================================================
// Alerts endpoints
// ============================================================

router.get('/alerts', (_req: Request, res: Response) => {
  const alerts = store.getActiveAlerts();
  // Enrich with learner info
  const enriched = alerts.map(a => {
    const learner = store.getLearnerById(a.learner_id);
    return { ...a, learner_name: learner ? `${learner.first_name} ${learner.last_name}` : 'Unknown' };
  });
  res.json({ success: true, data: enriched });
});

router.post('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  store.acknowledgeAlert(req.params.id);
  res.json({ success: true });
});

// ============================================================
// Communication endpoints
// ============================================================

router.post('/communications', (req: Request, res: Response) => {
  const { learner_id, channel, type, content, status } = req.body;
  const comm = store.addCommunication({
    learner_id,
    channel,
    type,
    content,
    status: status || 'draft',
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  });
  res.json({ success: true, data: comm });
});

router.get('/communications', (req: Request, res: Response) => {
  const learnerId = req.query.learner_id as string;
  if (learnerId) {
    const comms = store.getCommunicationsByLearner(learnerId);
    return res.json({ success: true, data: comms });
  }
  // Return all recent communications
  const all = store.communications
    .sort((a, b) => new Date(b.sent_at || b.id).getTime() - new Date(a.sent_at || a.id).getTime())
    .slice(0, 100);
  res.json({ success: true, data: all });
});

// ============================================================
// Reports endpoints
// ============================================================

router.get('/reports', (_req: Request, res: Response) => {
  const reports = store.getReports();
  res.json({ success: true, data: reports });
});

export default router;
