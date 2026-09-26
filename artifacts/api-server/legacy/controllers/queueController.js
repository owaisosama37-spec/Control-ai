import Project from '../models/Project.js';
import AuditLog from '../models/AuditLog.js';

// Get current queue
export const getQueue = async (req, res) => {
  try {
    const statuses = ['draft', 'approved_plan', 'awaiting_review'];

    const projects = await Project.find({ status: { $in: statuses } })
      .sort({ priority: -1, created_at: 1 })
      .limit(50);

    const queue = {
      draft: projects.filter(p => p.status === 'draft'),
      approved_plan: projects.filter(p => p.status === 'approved_plan'),
      awaiting_review: projects.filter(p => p.status === 'awaiting_review'),
      total: projects.length,
      estimated_processing_time: calculateEstimatedTime(projects)
    };

    res.json({
      success: true,
      queue
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get next project for Claude
export const getNextForClaude = async (req, res) => {
  try {
    const project = await Project.findOne({ status: 'approved_plan' })
      .sort({ priority: -1, created_at: 1 });

    if (!project) {
      return res.status(404).json({ error: 'No projects in queue for Claude' });
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get next project for Replit
export const getNextForReplit = async (req, res) => {
  try {
    const project = await Project.findOne({
      status: 'awaiting_review',
      'claude_task.status': 'completed'
    })
      .sort({ priority: -1, created_at: 1 });

    if (!project) {
      return res.status(404).json({ error: 'No projects in queue for Replit' });
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get next project for Gemini
export const getNextForGemini = async (req, res) => {
  try {
    const project = await Project.findOne({
      status: 'awaiting_review',
      'replit_task.status': 'completed',
      'gemini_task.status': { $ne: 'completed' }
    })
      .sort({ priority: -1, created_at: 1 });

    if (!project) {
      return res.status(404).json({ error: 'No projects in queue for Gemini' });
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reorder queue by priority
export const reorderQueue = async (req, res) => {
  try {
    const { project_ids } = req.body;

    if (!Array.isArray(project_ids)) {
      return res.status(400).json({ error: 'project_ids must be an array' });
    }

    for (let i = 0; i < project_ids.length; i++) {
      await Project.updateOne(
        { _id: project_ids[i] },
        { priority: 100 - i }
      );
    }

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'queue_reordered',
      actor: req.user?.id,
      actor_type: 'human',
      target_type: 'queue',
      target_id: 'global',
      description: 'Queue reordered',
      metadata: { order: project_ids }
    });

    res.json({
      success: true,
      message: 'Queue reordered'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get queue statistics
export const getQueueStats = async (req, res) => {
  try {
    const allProjects = await Project.find();

    const stats = {
      total_projects: allProjects.length,
      by_status: {
        draft: allProjects.filter(p => p.status === 'draft').length,
        approved_plan: allProjects.filter(p => p.status === 'approved_plan').length,
        awaiting_review: allProjects.filter(p => p.status === 'awaiting_review').length,
        merged: allProjects.filter(p => p.status === 'merged').length,
        rejected: allProjects.filter(p => p.status === 'rejected').length,
        paused: allProjects.filter(p => p.status === 'paused').length
      },
      by_priority: {
        critical: allProjects.filter(p => p.priority >= 9).length,
        high: allProjects.filter(p => p.priority >= 7 && p.priority < 9).length,
        medium: allProjects.filter(p => p.priority >= 4 && p.priority < 7).length,
        low: allProjects.filter(p => p.priority < 4).length
      },
      agent_load: {
        claude_assigned: allProjects.filter(p => p.claude_task?.status === 'assigned').length,
        replit_assigned: allProjects.filter(p => p.replit_task?.status === 'assigned').length,
        gemini_assigned: allProjects.filter(p => p.gemini_task?.status === 'assigned').length
      },
      completion_rate: calculateCompletionRate(allProjects),
      avg_time_in_queue: calculateAvgQueueTime(allProjects)
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Pause all queue processing
export const pauseQueue = async (req, res) => {
  try {
    const { reason } = req.body;

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'queue_paused',
      actor: req.user?.id,
      actor_type: 'human',
      target_type: 'queue',
      target_id: 'global',
      description: `Queue paused: ${reason}`,
      metadata: { reason }
    });

    res.json({
      success: true,
      message: 'Queue paused',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Resume queue processing
export const resumeQueue = async (req, res) => {
  try {
    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'queue_resumed',
      actor: req.user?.id,
      actor_type: 'human',
      target_type: 'queue',
      target_id: 'global',
      description: 'Queue resumed',
      metadata: {}
    });

    res.json({
      success: true,
      message: 'Queue resumed',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper functions
const calculateEstimatedTime = (projects) => {
  const avgMinutesPerProject = 30;
  return projects.length * avgMinutesPerProject;
};

const calculateCompletionRate = (projects) => {
  const completed = projects.filter(p => p.status === 'merged').length;
  if (projects.length === 0) return 0;
  return ((completed / projects.length) * 100).toFixed(2);
};

const calculateAvgQueueTime = (projects) => {
  const queuedProjects = projects.filter(p =>
    ['draft', 'approved_plan', 'awaiting_review'].includes(p.status)
  );

  if (queuedProjects.length === 0) return 0;

  const totalTime = queuedProjects.reduce((sum, p) => {
    return sum + (new Date() - new Date(p.created_at));
  }, 0);

  return (totalTime / queuedProjects.length / 1000 / 60).toFixed(2);
};

export default {
  getQueue,
  getNextForClaude,
  getNextForReplit,
  getNextForGemini,
  reorderQueue,
  getQueueStats,
  pauseQueue,
  resumeQueue
};
