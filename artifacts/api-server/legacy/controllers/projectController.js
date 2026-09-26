import Project from '../models/Project.js';
import AuditLog from '../models/AuditLog.js';
import crypto from 'crypto';

// Get all projects with filtering
export const getAllProjects = async (req, res) => {
  try {
    const { status, priority, project_type, sort = '-created_at', limit = 50, skip = 0 } = req.query;

    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = parseInt(priority);
    if (project_type) query.project_type = project_type;

    const projects = await Project.find(query)
      .sort(sort)
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Project.countDocuments(query);

    res.json({
      success: true,
      projects,
      total,
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single project
export const getProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
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
};

// Create new project
export const createProject = async (req, res) => {
  try {
    const { name, description, client_name, client_email, budget, project_type, priority } = req.body;

    const project = new Project({
      project_id: `PRJ-${Date.now()}`,
      name,
      description,
      client_name,
      client_email,
      budget: budget || 0,
      project_type: project_type || 'other',
      priority: priority || 5,
      status: 'draft'
    });

    await project.save();

    // Log audit
    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'project_created',
      actor: req.user?.id,
      actor_type: 'human',
      target_type: 'project',
      target_id: project._id,
      description: `Created project: ${name}`,
      metadata: { project_id: project.project_id }
    });

    res.status(201).json({
      success: true,
      project
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update project status
export const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate state transition
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
        error: `Invalid transition from ${project.status} to ${status}`
      });
    }

    const oldStatus = project.status;
    project.status = status;

    if (reason) project.status_reason = reason;

    await project.save();

    // Log audit
    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'project_status_changed',
      actor: req.user?.id,
      actor_type: 'human',
      target_type: 'project',
      target_id: project._id,
      description: `Status changed from ${oldStatus} to ${status}`,
      metadata: { old_status: oldStatus, new_status: status, reason }
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Assign Claude task
export const assignClaudeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { instructions } = req.body;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.claude_task = {
      status: 'assigned',
      assigned_at: new Date(),
      assigned_by: req.user?.id,
      instructions,
      model: 'claude-opus-5.5'
    };

    await project.save();

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'task_assigned',
      actor: req.user?.id,
      actor_type: 'human',
      target_type: 'task',
      target_id: project._id,
      description: 'Claude task assigned',
      metadata: { agent: 'claude' }
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark Claude task complete
export const completeClaudeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { result, tokens_used } = req.body;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const completedAt = new Date();
    const duration = (completedAt - new Date(project.claude_task.assigned_at)) / 1000 / 60;

    project.claude_task.status = 'completed';
    project.claude_task.completed_at = completedAt;
    project.claude_task.result = result;
    project.claude_task.tokens_used = tokens_used || 0;

    if (!project.metrics) project.metrics = {};
    project.metrics.planning_duration = duration;

    await project.save();

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'task_completed',
      actor: req.user?.id,
      actor_type: 'claude',
      target_type: 'task',
      target_id: project._id,
      description: 'Claude planning task completed',
      metadata: { agent: 'claude', duration, tokens_used }
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Assign Replit task
export const assignReplitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { implementation_plan } = req.body;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.replit_task = {
      status: 'assigned',
      assigned_at: new Date(),
      assigned_by: req.user?.id,
      implementation_plan
    };

    await project.save();

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'task_assigned',
      actor: req.user?.id,
      actor_type: 'human',
      target_type: 'task',
      target_id: project._id,
      description: 'Replit task assigned',
      metadata: { agent: 'replit' }
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark Replit task complete
export const completeReplitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { code_quality_score, test_coverage, github_pr_url, tokens_used } = req.body;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const completedAt = new Date();
    const duration = (completedAt - new Date(project.replit_task.assigned_at)) / 1000 / 60;

    project.replit_task.status = 'completed';
    project.replit_task.completed_at = completedAt;
    project.replit_task.code_quality_score = code_quality_score || 0;
    project.replit_task.test_coverage = test_coverage || 0;
    project.replit_task.github_pr_url = github_pr_url;
    project.replit_task.tokens_used = tokens_used || 0;

    if (!project.metrics) project.metrics = {};
    project.metrics.execution_speed = duration;
    project.metrics.code_quality_score = code_quality_score;

    await project.save();

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'task_completed',
      actor: req.user?.id,
      actor_type: 'replit',
      target_type: 'task',
      target_id: project._id,
      description: 'Replit execution task completed',
      metadata: { agent: 'replit', duration, tokens_used }
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Assign Gemini security review
export const assignGeminiTask = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.gemini_task = {
      status: 'assigned',
      assigned_at: new Date(),
      assigned_by: req.user?.id
    };

    await project.save();

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'task_assigned',
      actor: req.user?.id,
      actor_type: 'human',
      target_type: 'task',
      target_id: project._id,
      description: 'Gemini security review task assigned',
      metadata: { agent: 'gemini' }
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Complete Gemini security review
export const completeGeminiTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { security_findings = [], critical_issues = 0, tokens_used } = req.body;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.gemini_task = {
      ...project.gemini_task,
      status: 'completed',
      completed_at: new Date(),
      security_findings,
      critical_issues,
      tokens_used: tokens_used || 0
    };

    if (!project.metrics) project.metrics = {};
    project.metrics.security_findings_count = security_findings.length;

    await project.save();

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'task_completed',
      actor: req.user?.id,
      actor_type: 'gemini',
      target_type: 'task',
      target_id: project._id,
      description: 'Gemini security review completed',
      metadata: { agent: 'gemini', findings: security_findings.length, critical_issues, tokens_used }
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default {
  getAllProjects,
  getProject,
  createProject,
  updateProjectStatus,
  assignClaudeTask,
  completeClaudeTask,
  assignReplitTask,
  completeReplitTask,
  assignGeminiTask,
  completeGeminiTask
};
