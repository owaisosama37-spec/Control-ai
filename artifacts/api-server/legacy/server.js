const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Capture raw body for webhook signature verification
const captureWebhookBody = (req, res, buf, encoding) => {
  if (req.path.includes('/api/webhooks')) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

// Verify webhook signature (HMAC SHA256)
const verifyWebhookSignature = (rawBody, signature, secret) => {
  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret)
    .update(rawBody).digest('hex');

  console.log('🔐 SIGNATURE DEBUG:');
  console.log('  Secret used:', secret);
  console.log('  Received signature:', signature);
  console.log('  Calculated signature:', expectedSignature);
  console.log('  Match:', signature === expectedSignature);

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

// POST /github - GitHub webhook
router.post('/github', (req, res) => {
  console.log('\n📨 GitHub webhook received');

  const secret = process.env.GITHUB_WEBHOOK_SECRET || 'starfruit-webhook-secret-2024';
  console.log('🔑 Using secret:', secret);

  const signature = req.headers['x-hub-signature-256'];
  console.log('📋 Received signature header:', signature);

  if (!signature) {
    console.log('❌ No signature header found');
    return res.status(400).json({ error: 'No signature header' });
  }

  try {
    if (!verifyWebhookSignature(req.rawBody, signature, secret)) {
      console.log('❌ Signature verification failed');
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    console.log('✅ Signature verified successfully');
    const payload = JSON.parse(req.rawBody);
    console.log('Event type:', payload.action || 'unknown');
    res.json({ status: 'success', message: 'GitHub webhook received' });
  } catch (err) {
    console.error('❌ Error verifying signature:', err.message);
    return res.status(401).json({ error: 'Signature verification failed' });
  }
});

// POST /slack - Slack commands
router.post('/slack', (req, res) => {
  console.log('\n💬 Slack command received');
  const command = req.body.command;
  const userId = req.body.user_id;
  const responseUrl = req.body.response_url;

  console.log('Command:', command);
  console.log('User ID:', userId);

  if (command === '/sf-approve') {
    console.log('✅ Processing /sf-approve');
    res.json({ text: 'Approval processed' });
  } else if (command === '/sf-reject') {
    console.log('❌ Processing /sf-reject');
    res.json({ text: 'Rejection processed' });
  } else if (command === '/sf-status') {
    console.log('📊 Processing /sf-status');
    res.json({ text: 'Status: Ready' });
  } else {
    console.log('⚠️ Unknown command:', command);
    res.json({ text: 'Unknown command' });
  }
});

// POST /custom - Custom events
router.post('/custom', (req, res) => {
  console.log('\n🔧 Custom event received:', req.body);
  res.json({ status: 'received' });
});

module.exports = router;
module.exports.captureWebhookBody = captureWebhookBody;