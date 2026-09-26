import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const hmacAuth = (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    const managerId = req.headers['x-manager-id'];

    if (!signature || !timestamp || !managerId) {
      return res.status(401).json({ error: 'Missing HMAC authentication headers' });
    }

    // Verify timestamp (within 5 minutes)
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    if (Math.abs(currentTime - requestTime) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Request timestamp expired' });
    }

    // Verify HMAC signature
    const body = JSON.stringify(req.body || {});
    const data = `${managerId}:${timestamp}:${req.method}:${req.path}:${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.HMAC_SECRET || 'secret')
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    req.manager = {
      id: managerId,
      timestamp: requestTime
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'HMAC authentication failed' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user?.permissions?.includes(permission)) {
      return res.status(403).json({ error: `Permission required: ${permission}` });
    }
    next();
  };
};
