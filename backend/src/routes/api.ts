// ============================================================
// API Routes — Express Router (Supabase Async Version)
// ============================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { processUpload } from '../services/uploadService.js';
import { store, supabase } from '../services/store.js';

const router = Router();

// File upload config
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported. Use CSV, XLSX, or MD.`));
    }
  },
});

// ============================================================
// Upload endpoints
// ============================================================

router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
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

router.get('/uploads', async (_req: Request, res: Response): Promise<void> => {
  try {
    const uploads = await store.getUploads();
    res.json({ success: true, data: uploads });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete('/uploads', async (_req: Request, res: Response): Promise<void> => {
  try {
    await store.clearUploadHistory();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete('/reset', async (_req: Request, res: Response): Promise<void> => {
  try {
    await store.clearAllData();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================
// Reports endpoints
// ============================================================

router.get('/reports/weekly', async (_req: Request, res: Response): Promise<void> => {
  try {
    const reports = await store.getWeeklyReports();
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================
// Dashboard endpoints
// ============================================================

router.get('/dashboard/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await store.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================
// Learner endpoints
// ============================================================

router.get('/learners', async (req: Request, res: Response): Promise<void> => {
  try {
    let learners = await store.getLearners();

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
    const activities = await store.getActivities();
    const allProgress = await store.getAllProgress();
    
    const enriched = learners.map(l => {
      const progress = allProgress.filter(p => p.learner_id === l.id);
      const completed = progress.filter(p => p.status === 'completed' || p.status === 'passed').length;
      const total = activities.length;
      const lastActivity = l.last_activity_at ? new Date(l.last_activity_at).getTime() : null;
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
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get('/learners/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const param = req.params.id;
    const learner = param.includes('@') 
      ? await store.getLearnerByEmail(param) 
      : await store.getLearnerById(param);
      
    if (!learner) {
      res.status(404).json({ error: 'Learner not found' });
      return;
    }

    const progress = await store.getProgressByLearner(learner.id);
    const activities = await store.getActivities();
    const communications = await store.getCommunicationsByLearner(learner.id);

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

    const lastActivity = learner.last_activity_at ? new Date(learner.last_activity_at).getTime() : null;

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
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================
// Activity endpoints
// ============================================================

router.get('/activities', async (_req: Request, res: Response): Promise<void> => {
  try {
    const activities = await store.getActivities();
    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================
// Progress heatmap data
// ============================================================

router.get('/progress/heatmap', async (_req: Request, res: Response): Promise<void> => {
  try {
    const learners = await store.getLearners();
    const activities = await store.getActivities();
    const allProgress = await store.getAllProgress();

    const heatmapData = learners.map(learner => {
      const progress = allProgress.filter(p => p.learner_id === learner.id);
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
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================
// Alerts endpoints
// ============================================================

router.get('/alerts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await store.getActiveAlerts();
    const enriched = await Promise.all(alerts.map(async (a) => {
      const learner = await store.getLearnerById(a.learner_id);
      return { ...a, learner_name: learner ? `${learner.first_name} ${learner.last_name}` : 'Unknown' };
    }));
    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post('/alerts/:id/acknowledge', async (req: Request, res: Response): Promise<void> => {
  try {
    await store.acknowledgeAlert(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================
// Communication endpoints
// ============================================================

router.post('/communications', async (req: Request, res: Response): Promise<void> => {
  try {
    const { learner_id, channel, type, content, status } = req.body;
    const comm = await store.addCommunication({
      learner_id,
      channel,
      type,
      content,
      status: status || 'draft',
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
    res.json({ success: true, data: comm });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get('/communications', async (req: Request, res: Response): Promise<void> => {
  try {
    const learnerId = req.query.learner_id as string;
    if (learnerId) {
      const comms = await store.getCommunicationsByLearner(learnerId);
      res.json({ success: true, data: comms });
      return;
    }
    // Return all recent communications
    const { data: all } = await supabase.from('communications').select('*').order('sent_at', { ascending: false }).limit(100);
    res.json({ success: true, data: all });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================
// Reports endpoints
// ============================================================

router.get('/reports', async (_req: Request, res: Response): Promise<void> => {
  try {
    const reports = await store.getReports();
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
