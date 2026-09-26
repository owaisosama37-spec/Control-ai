import express from 'express';
import Project from '../models/Project.js';

const router = express.Router();

// Get all tasks in queue
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    const tasks = await Project.find(query)
      .sort({ priority: -1, created_at: 1 })
      .limit(100);

    const grouped = {
      draft: tasks.filter(t => t.status === 'draft'),
      approved_plan: tasks.filter(t => t.status === 'approved_plan'),
      awaiting_review: tasks.filter(t => t.status === 'awaiting_review'),
      merged: tasks.filter(t => t.status === 'merged'),
      paused: tasks.filter(t => t.status === 'paused'),
      rejected: tasks.filter(t => t.status === 'rejected')
    };

    res.json({
      success: true,
      grouped,
      total: tasks.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder queue
router.put('/queue/reorder', async (req, res) => {
  try {
    const { order } = req.body; // Array of task IDs in new order

    // Update priority based on new order
    for (let i = 0; i < order.length; i++) {
      await Project.findByIdOrProjectId(order[i], {
        priority: 100 - i, // Higher priority first
        updated_at: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Queue reordered successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task details with full history
router.get('/:id/history', async (req, res) => {
  try {
    const project = await Project.findOne({
      $or: [
        { project_id: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      success: true,
      task: {
        id: project.project_id,
        name: project.name,
        status: project.status,
        created_at: project.created_at,
        updated_at: project.updated_at,
        timeline: {
          created: project.created_at,
          claude_started: project.claude_task?.assigned_at,
          claude_completed: project.claude_task?.completed_at,
          replit_started: project.replit_task?.assigned_at,
          replit_completed: project.replit_task?.completed_at,
          gemini_started: project.gemini_task?.assigned_at,
          gemini_completed: project.gemini_task?.completed_at,
          merged: project.deployment?.deployed_at
        },
        metrics: project.metrics
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve task
router.post('/:id/approve', async (req, res) => {
  try {
    const { reason } = req.body;

    const project = await Project.findOne({
      $or: [
        { project_id: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (project.status !== 'draft') {
      return res.status(400).json({ error: 'Can only approve draft tasks' });
    }

    project.status = 'approved_plan';
    project.approvals.push({
      stage: 'initial_approval',
      approved_by: req.user?.id || 'system',
      timestamp: new Date(),
      signature: 'approved'
    });
    project.updated_at = new Date();

    await project.save();

    res.json({
      success: true,
      message: 'Task approved',
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject task
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;

    const project = await Project.findOne({
      $or: [
        { project_id: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Task not found' });
    }

    project.status = 'rejected';
    project.rejection_reason = reason;
    project.updated_at = new Date();

    await project.save();

    res.json({
      success: true,
      message: 'Task rejected',
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
