import express from 'express';
import Project from '../models/Project.js';
import { v4 as uuidv4 } from 'uuid';
import { hmacAuth } from '../middleware/auth.js';

const router = express.Router();

// Get all projects
router.get('/', async (req, res) => {
  try {
    const { status, priority, sort } = req.query;
    let query = {};

    if (status) query.status = status;
    if (priority) query.priority = { $gte: parseInt(priority) };

    let sortObj = { created_at: -1 };
    if (sort === 'priority') sortObj = { priority: -1, created_at: -1 };
    if (sort === 'deadline') sortObj = { deadline: 1 };

    const projects = await Project.find(query)
      .sort(sortObj)
      .limit(100);

    res.json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project by ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({
      $or: [
        { project_id: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new project
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      client_name,
      client_email,
      budget,
      project_type,
      estimated_duration_hours
    } = req.body;

    const project_id = `PRJ-${uuidv4().substring(0, 8).toUpperCase()}`;

    const project = new Project({
      project_id,
      name,
      description,
      client_name,
      client_email,
      budget,
      project_type,
      estimated_duration_hours,
      status: 'draft'
    });

    await project.save();

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update project status
router.put('/:id/status', hmacAuth, async (req, res) => {
  try {
    const { status, reason } = req.body;

    const project = await Project.findOne({
      $or: [
        { project_id: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const validTransitions = {
      'draft': ['approved_plan'],
      'approved_plan': ['awaiting_review'],
      'awaiting_review': ['merged', 'rejected'],
      'merged': ['paused'],
      'paused': ['merged'],
      'rejected': ['draft']
    };

    if (!validTransitions[project.status]?.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from ${project.status} to ${status}`
      });
    }

    project.status = status;
    project.updated_at = new Date();

    if (status === 'merged') {
      project.approvals.push({
        stage: 'final_merge',
        approved_by: req.manager.id,
        timestamp: new Date(),
        signature: req.headers['x-signature']
      });
    }

    if (status === 'rejected') {
      project.rejection_reason = reason;
    }

    await project.save();

    res.json({
      success: true,
      message: `Project status updated to ${status}`,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign task to Claude
router.post('/:id/assign-claude', async (req, res) => {
  try {
    const project = await Project.findOne({
      $or: [
        { project_id: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.claude_task = {
      assigned_at: new Date(),
      status: 'in_progress'
    };

    project.status = 'approved_plan';
    await project.save();

    res.json({
      success: true,
      message: 'Task assigned to Claude',
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Claude task completion
router.put('/:id/claude-complete', async (req, res) => {
  try {
    const { output, tokens_used } = req.body;

    const project = await Project.findOne({
      $or: [
        { project_id: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.claude_task = {
      ...project.claude_task,
      completed_at: new Date(),
      status: 'completed',
      output,
      tokens_used
    };

    project.metrics = project.metrics || {};
    project.metrics.planning_duration =
      (new Date() - project.claude_task.assigned_at) / 1000 / 60; // minutes

    project.status = 'awaiting_review';
    await project.save();

    res.json({
      success: true,
      message: 'Claude task completed',
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue
router.get('/queue/current', async (req, res) => {
  try {
    const queue = await Project.find({
      status: {
        $in: ['draft', 'approved_plan', 'awaiting_review']
      }
    })
    .sort({ priority: -1, created_at: 1 })
    .limit(50);

    res.json({
      success: true,
      queue_size: queue.length,
      queue
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
