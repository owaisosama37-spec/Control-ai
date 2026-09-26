import express from 'express';
import User from '../models/User.js';
import { adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Get user settings
router.get('/user', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -api_keys');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        preferences: user.preferences,
        timezone: user.timezone
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user settings
router.put('/user', async (req, res) => {
  try {
    const { preferences, timezone, full_name } = req.body;

    const user = await User.findById(req.user.id);

    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    if (timezone) user.timezone = timezone;
    if (full_name) user.full_name = full_name;

    user.updated_at = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Settings updated',
      user: {
        preferences: user.preferences,
        timezone: user.timezone,
        full_name: user.full_name
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system settings (admin only)
router.get('/system', adminOnly, (req, res) => {
  try {
    const settings = {
      approval_thresholds: {
        small_project: 500,
        medium_project: 2000,
        large_project: 10000
      },
      token_budget: {
        daily: process.env.DAILY_TOKEN_BUDGET || 10000,
        monthly: process.env.MONTHLY_TOKEN_BUDGET || 300000
      },
      deployment: {
        environments: ['dev', 'staging', 'production'],
        auto_rollback_enabled: true,
        canary_release_percentage: 5
      },
      security: {
        hmac_enabled: true,
        audit_log_retention_days: 90,
        two_factor_required: false
      },
      integrations: {
        slack_enabled: !!process.env.SLACK_BOT_TOKEN,
        github_enabled: !!process.env.GITHUB_TOKEN,
        email_enabled: !!process.env.SMTP_HOST
      }
    };

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update system settings (admin only)
router.put('/system', adminOnly, (req, res) => {
  try {
    const { approval_thresholds, token_budget, deployment } = req.body;

    // In production, these would be stored in the database
    const updatedSettings = {
      approval_thresholds: approval_thresholds || {},
      token_budget: token_budget || {},
      deployment: deployment || {}
    };

    res.json({
      success: true,
      message: 'System settings updated',
      settings: updatedSettings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notification settings
router.get('/notifications', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences');

    res.json({
      success: true,
      notifications: user.preferences
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update notification settings
router.put('/notifications', async (req, res) => {
  try {
    const { notifications_email, notifications_slack, notifications_push, notification_frequency } = req.body;

    const user = await User.findById(req.user.id);

    if (notifications_email !== undefined) user.preferences.notifications_email = notifications_email;
    if (notifications_slack !== undefined) user.preferences.notifications_slack = notifications_slack;
    if (notifications_push !== undefined) user.preferences.notifications_push = notifications_push;
    if (notification_frequency) user.preferences.notification_frequency = notification_frequency;

    await user.save();

    res.json({
      success: true,
      message: 'Notification settings updated',
      preferences: user.preferences
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
