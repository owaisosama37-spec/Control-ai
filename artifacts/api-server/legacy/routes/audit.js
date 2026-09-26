import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Get audit logs
router.get('/', adminOnly, async (req, res) => {
  try {
    const { action, actor, limit = 100, skip = 0 } = req.query;

    let query = {};
    if (action) query.action = action;
    if (actor) query.actor = actor;

    const logs = await AuditLog.find(query)
      .sort({ created_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('actor', 'email full_name');

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      logs,
      total,
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific log
router.get('/:id', adminOnly, async (req, res) => {
  try {
    const log = await AuditLog.findOne({ log_id: req.params.id })
      .populate('actor', 'email full_name');

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json({
      success: true,
      log,
      is_verified: log.is_verified
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get audit report
router.get('/report/generate', adminOnly, async (req, res) => {
  try {
    const { start_date, end_date, action_type } = req.query;

    let query = {};
    if (start_date && end_date) {
      query.created_at = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }
    if (action_type) query.action = action_type;

    const logs = await AuditLog.find(query).populate('actor', 'email full_name');

    const report = {
      period: {
        start: start_date,
        end: end_date
      },
      total_actions: logs.length,
      actions_by_type: {},
      actions_by_actor: {},
      critical_actions: logs.filter(l => l.action.includes('emergency') || l.action.includes('merge')),
      verification_status: {
        all_verified: logs.every(l => l.is_verified),
        verified: logs.filter(l => l.is_verified).length,
        unverified: logs.filter(l => !l.is_verified).length
      }
    };

    logs.forEach(log => {
      // Count by action type
      report.actions_by_type[log.action] = (report.actions_by_type[log.action] || 0) + 1;

      // Count by actor
      const actor = log.actor?.email || 'unknown';
      report.actions_by_actor[actor] = (report.actions_by_actor[actor] || 0) + 1;
    });

    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify log integrity
router.post('/:id/verify', adminOnly, async (req, res) => {
  try {
    const log = await AuditLog.findOne({ log_id: req.params.id });

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    const is_verified = log.is_verified;

    res.json({
      success: true,
      log_id: req.params.id,
      is_verified,
      message: is_verified ? 'Log integrity verified' : 'Log integrity check failed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
