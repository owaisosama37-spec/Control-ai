import Project from '../models/Project.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import crypto from 'crypto';

// Get pending approvals
export const getPendingApprovals = async (req, res) => {
  try {
    const projects = await Project.find({
      status: { $in: ['draft', 'awaiting_review'] }
    })
      .populate('approvals.approved_by', 'email full_name role')
      .sort({ priority: -1, created_at: 1 });

    const approvals = projects.map(p => ({
      project_id: p.project_id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      budget: p.budget,
      approvals: p.approvals || [],
      requires_approval: !p.approvals?.some(a => a.stage === p.status)
    }));

    res.json({
      success: true,
      approvals,
      total: approvals.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approve project at current stage
export const approveProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user.id);

    // Check if user has approval permission
    if (!user.permissions?.includes('approve_projects')) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Generate HMAC signature
    const signatureData = `${project._id}.${project.status}.${Date.now()}`;
    const signature = crypto
      .createHmac('sha256', process.env.HMAC_SECRET || 'secret')
      .update(signatureData)
      .digest('hex');

    // Add approval record
    project.approvals.push({
      stage: project.status,
      approved_by: req.user.id,
      timestamp: new Date(),
      signature,
      comment
    });

    // Advance to next stage based on current status
    const nextStage = {
      'draft': 'approved_plan',
      'approved_plan': 'awaiting_review',
      'awaiting_review': 'merged'
    };

    if (nextStage[project.status]) {
      project.status = nextStage[project.status];
    }

    await project.save();

    // Log approval
    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'approval_signed',
      actor: req.user.id,
      actor_type: 'human',
      target_type: 'project',
      target_id: project._id,
      description: `Project approved at ${project.status} stage`,
      signature,
      metadata: {
        project_id: project.project_id,
        new_status: project.status,
        approver: user.email,
        comment
      }
    });

    res.json({
      success: true,
      project,
      approval_signature: signature
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reject project
export const rejectProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user.id);

    // Check permission
    if (!user.permissions?.includes('approve_projects')) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const oldStatus = project.status;
    project.status = 'rejected';
    project.status_reason = reason;

    await project.save();

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'project_rejected',
      actor: req.user.id,
      actor_type: 'human',
      target_type: 'project',
      target_id: project._id,
      description: `Project rejected: ${reason}`,
      metadata: {
        project_id: project.project_id,
        old_status: oldStatus,
        reason
      }
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get approval chain for project
export const getApprovalChain = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      $or: [{ project_id: id }, { _id: id }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const chain = await Promise.all(
      (project.approvals || []).map(async (approval) => ({
        ...approval,
        approver: await User.findById(approval.approved_by).select('email full_name role'),
        verified: await verifyApprovalSignature(project, approval)
      }))
    );

    res.json({
      success: true,
      project_id: project.project_id,
      current_status: project.status,
      approval_chain: chain,
      is_verified: chain.every(c => c.verified)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Batch approve multiple projects
export const batchApprove = async (req, res) => {
  try {
    const { project_ids, reason } = req.body;

    if (!Array.isArray(project_ids)) {
      return res.status(400).json({ error: 'project_ids must be an array' });
    }

    const user = await User.findById(req.user.id);

    if (!user.permissions?.includes('approve_projects')) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const results = [];

    for (const projectId of project_ids) {
      try {
        const project = await Project.findOne({
          $or: [{ project_id: projectId }, { _id: projectId }]
        });

        if (!project) continue;

        const signature = crypto
          .createHmac('sha256', process.env.HMAC_SECRET || 'secret')
          .update(`${project._id}.${project.status}.${Date.now()}`)
          .digest('hex');

        project.approvals.push({
          stage: project.status,
          approved_by: req.user.id,
          timestamp: new Date(),
          signature
        });

        const nextStage = {
          'draft': 'approved_plan',
          'approved_plan': 'awaiting_review'
        };

        if (nextStage[project.status]) {
          project.status = nextStage[project.status];
        }

        await project.save();

        results.push({
          project_id: project.project_id,
          success: true,
          new_status: project.status
        });
      } catch (error) {
        results.push({
          project_id: projectId,
          success: false,
          error: error.message
        });
      }
    }

    await AuditLog.create({
      log_id: `LOG-${Date.now()}`,
      action: 'batch_approval',
      actor: req.user.id,
      actor_type: 'human',
      target_type: 'projects',
      target_id: 'batch',
      description: `Batch approved ${results.filter(r => r.success).length} projects`,
      metadata: { count: project_ids.length, reason }
    });

    res.json({
      success: true,
      approved: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper function
const verifyApprovalSignature = async (project, approval) => {
  try {
    const signatureData = `${project._id}.${approval.stage}.${new Date(approval.timestamp).getTime()}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.HMAC_SECRET || 'secret')
      .update(signatureData)
      .digest('hex');

    return approval.signature === expectedSignature;
  } catch (error) {
    return false;
  }
};

export default {
  getPendingApprovals,
  approveProject,
  rejectProject,
  getApprovalChain,
  batchApprove
};
