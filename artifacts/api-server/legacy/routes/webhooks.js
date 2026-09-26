import express from 'express';
import crypto from 'crypto';
import Project from '../models/Project.js';

const router = express.Router();

// Verify webhook signature
const verifyWebhookSignature = (req, secret) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  if (!signature || !timestamp) return false;

  // Verify timestamp (within 5 minutes)
  if (Math.abs(Date.now() - parseInt(timestamp)) > 5 * 60 * 1000) return false;

  const data = `${timestamp}.${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');

  return signature === expectedSignature;
};

// GitHub webhook
router.post('/github', async (req, res) => {
  try {
    if (!verifyWebhookSignature(req, process.env.GITHUB_WEBHOOK_SECRET || 'secret')) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { action, pull_request } = req.body;

    // Handle PR events
    if (action === 'opened' || action === 'synchronize') {
      const project = await Project.findOne({
        'replit_task.github_pr_url': pull_request.html_url
      });

      if (project) {
        project.replit_task.status = 'in_progress';
        project.status = 'awaiting_review';
        await project.save();
      }
    } else if (action === 'closed' && pull_request.merged) {
      const project = await Project.findOne({
        'replit_task.github_pr_url': pull_request.html_url
      });

      if (project) {
        project.replit_task.status = 'completed';
        project.replit_task.completed_at = new Date();
        await project.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Slack webhook (for approvals via slash commands)
router.post('/slack', async (req, res) => {
  try {
    const { command, text, user_id } = req.body;

    if (command === '/approve') {
      const projectId = text.split(' ')[0];

      const project = await Project.findOne({
        $or: [
          { project_id: projectId },
          { _id: projectId }
        ]
      });

      if (!project) {
        return res.json({
          response_type: 'ephemeral',
          text: `Project ${projectId} not found`
        });
      }

      project.status = 'approved_plan';
      project.approvals.push({
        stage: 'slack_approval',
        approved_by: user_id,
        timestamp: new Date(),
        signature: 'slack'
      });
      await project.save();

      return res.json({
        response_type: 'in_channel',
        text: `Project ${projectId} approved by <@${user_id}>`
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Slack webhook error:', error);
    res.json({
      response_type: 'ephemeral',
      text: `Error: ${error.message}`
    });
  }
});

// Generic webhook for external systems
router.post('/custom', async (req, res) => {
  try {
    const { event_type, data } = req.body;

    if (event_type === 'task_created') {
      const project = new Project({
        project_id: `PRJ-${Date.now()}`,
        name: data.name,
        description: data.description,
        client_name: data.client_name,
        budget: data.budget,
        status: 'draft'
      });

      await project.save();

      return res.status(201).json({
        success: true,
        project_id: project.project_id
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Custom webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
