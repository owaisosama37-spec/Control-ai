import AuditLog from '../models/AuditLog.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export const loggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const requestId = uuidv4();

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

  // Override res.json to log responses
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);

    // Log critical actions to audit log
    if (shouldAuditAction(req)) {
      logAuditAction(req, res, data, requestId);
    }

    return originalJson(data);
  };

  next();
};

const shouldAuditAction = (req) => {
  const criticalMethods = ['POST', 'PUT', 'DELETE'];
  const criticalPaths = ['/api/projects', '/api/tasks', '/api/system/emergency-stop', '/api/system/sleep-mode'];

  return criticalMethods.includes(req.method) &&
         criticalPaths.some(path => req.path.includes(path));
};

const logAuditAction = async (req, res, data, requestId) => {
  try {
    const actionMap = {
      'POST:/api/projects': 'project_created',
      'PUT:/api/projects': 'project_approved',
      'DELETE:/api/projects': 'project_rejected',
      'POST:/api/system/emergency-stop': 'emergency_stop',
      'POST:/api/system/sleep-mode': 'mode_changed'
    };

    const key = `${req.method}:${req.path.split('/').slice(0, 3).join('/')}`;
    const action = actionMap[key] || 'unknown_action';

    // Create HMAC signature
    const data_str = JSON.stringify(req.body || {});
    const signature = crypto
      .createHmac('sha256', process.env.AUDIT_SECRET || 'secret')
      .update(data_str + req.user?.id)
      .digest('hex');

    const auditLog = new AuditLog({
      log_id: requestId,
      action,
      actor: req.user?.id || 'system',
      actor_type: req.user ? 'human' : 'system',
      target_type: 'project',
      target_id: req.body?.project_id || req.params?.id,
      details: {
        old_value: null,
        new_value: req.body,
        change_reason: req.body?.reason || 'No reason provided'
      },
      signature,
      timestamp_signed: new Date(),
      ip_address: req.ip,
      session_id: req.sessionID,
      user_agent: req.get('user-agent')
    });

    await auditLog.save();
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
};
