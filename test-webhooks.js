const http = require('node:http');
const crypto = require('node:crypto');

const port = Number(process.env.WEBHOOK_TEST_PORT || '3000');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('WEBHOOK_TEST_PORT must be a valid port.');
}

function post(path, body, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: { 'content-length': Buffer.byteLength(body), ...headers }
    }, res => {
      let response = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { response += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(response) });
        } catch {
          reject(new Error(`${path} returned a non-JSON response (${res.statusCode}).`));
        }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error(`${path} timed out.`)));
    req.on('error', reject);
    req.end(body);
  });
}

function expectResult(result, status, predicate, label) {
  if (result.status !== status || !predicate(result.body)) {
    throw new Error(`${label}: expected the specified response and HTTP ${status}, received HTTP ${result.status}.`);
  }
}

async function runGitHub() {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret?.trim()) throw new Error('GITHUB_WEBHOOK_SECRET is required to test GitHub.');
  const body = JSON.stringify({ zen: 'Local signature verification test' });
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  const headers = { 'content-type': 'application/json', 'x-github-event': 'ping' };

  const valid = await post('/api/webhooks/github', body, {
    ...headers, 'x-hub-signature-256': signature
  });
  expectResult(valid, 200, data => data.success === true && data.event === 'ping', 'GitHub signed ping');

  const invalid = await post('/api/webhooks/github', body, {
    ...headers, 'x-hub-signature-256': 'sha256=' + '0'.repeat(64)
  });
  expectResult(invalid, 401, data => data.error === 'Invalid GitHub signature.', 'GitHub invalid signature');
  console.log('GitHub: valid ping accepted; invalid signature rejected (no project changes).');
}

async function runSlack() {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret?.trim()) throw new Error('SLACK_SIGNING_SECRET is required to test Slack.');
  const body = new URLSearchParams({
    command: '/approve', text: '', user_id: 'U_SMOKE_TEST', team_id: 'T_SMOKE_TEST'
  }).toString();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = 'v0=' + crypto.createHmac('sha256', secret)
    .update(`v0:${timestamp}:${body}`).digest('hex');
  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
    'x-slack-request-timestamp': timestamp
  };

  const valid = await post('/api/webhooks/slack', body, {
    ...headers, 'x-slack-signature': signature
  });
  expectResult(valid, 200,
    data => data.response_type === 'ephemeral' && data.text === 'Project ID required.',
    'Slack signed command');

  const invalid = await post('/api/webhooks/slack', body, {
    ...headers, 'x-slack-signature': 'v0=' + '0'.repeat(64)
  });
  expectResult(invalid, 401, data => data.error === 'Invalid Slack signature.', 'Slack invalid signature');
  console.log('Slack: valid command recognized; invalid signature rejected (no approval executed).');
}

async function run() {
  await runGitHub();
  await runSlack();
  console.log('Webhook signature smoke checks passed.');
}

if (require.main === module) {
  run().catch(error => {
    console.error(`Webhook checks failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { runGitHub, runSlack };