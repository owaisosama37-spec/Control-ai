const http = require('http');
const crypto = require('crypto');

const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';

// Test GitHub Webhook
async function testGitHub() {
  console.log('\n🔵 Testing GitHub Webhook...');
  
  const payload = {
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
  
  const signature = 'sha256=' + crypto
    .createHmac('sha256', GITHUB_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return new Promise((resolve) => {
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

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ GitHub: ${res.statusCode}`);
        resolve(true);
      });
    });

    req.on('error', (err) => {
      console.log(`❌ GitHub: ${err.message}`);
      resolve(false);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

// Test Slack Command
async function testSlack() {
  console.log('🟣 Testing Slack Command...');
  
  const payload = 'command=/sf-approve&text=Test&user_id=U123&team_id=T123';
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/webhooks/slack',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ Slack: ${res.statusCode}`);
        resolve(true);
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Slack: ${err.message}`);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

// Run tests
async function runTests() {
  console.log('🚀 اختبار الـ Webhooks...\n');
  
  await testGitHub();
  await testSlack();
  
  console.log('\n✅ الاختبار انتهى!');
}

runTests();