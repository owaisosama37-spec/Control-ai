const http = require('http');
const crypto = require('crypto');

const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret-key';

// Mock GitHub webhook
const githubPayload = {
  action: 'opened',
  pull_request: {
    number: 123,
    title: 'Test PR',
    state: 'open',
    merged: false
  },
  repository: {
    name: 'control-ai'
  }
};

// Calculate signature
function calculateSignature(payload, secret) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// Test GitHub Webhook
async function testGitHub() {
  console.log('🔵 اختبار GitHub Webhook...');
  
  const signature = calculateSignature(githubPayload, GITHUB_SECRET);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/webhooks/github',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
      'X-GitHub-Event': 'pull_request'
    }
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ GitHub Response: ${res.statusCode}`);
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', (err) => {
      console.log(`❌ GitHub Error: ${err.message}`);
      resolve(false);
    });

    req.write(JSON.stringify(githubPayload));
    req.end();
  });
}

testGithub();