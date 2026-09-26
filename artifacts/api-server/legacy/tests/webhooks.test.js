import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { captureWebhookBody, createWebhookRouter } from '../routes/webhooks.js';

test('legacy webhook signatures and actions, without MongoDB', async t => {
  const repo = 'owner/repository';
  const prUrl = `https://github.com/${repo}/pull/123`;
  const project = {
    project_id: 'PRJ-TEST',
    status: 'draft',
    replit_task: {},
    approvals: [],
    async save() { saves++; }
  };
  let saves = 0;
  const env = {
    GITHUB_WEBHOOK_SECRET: 'github-test-secret',
    GITHUB_REPO: repo,
    SLACK_SIGNING_SECRET: 'slack-test-secret'
  };
  const ProjectModel = {
    async findOne(query) {
      if (query['replit_task.github_pr_url'] === prUrl || query.project_id === 'PRJ-TEST') return project;
      return null;
    }
  };
  const UserModel = {
    async findOne(query) {
      return query.slack_user_id === 'U_APPROVER' && query.slack_workspace_id === 'T_WORKSPACE' &&
        query.permissions === 'approve_projects' ? { user_id: 'approver' } : null;
    }
  };
  const app = express();
  app.use(express.json({ verify: captureWebhookBody }));
  app.use(express.urlencoded({ extended: true, verify: captureWebhookBody }));
  app.use('/api/webhooks', createWebhookRouter({ ProjectModel, UserModel, env }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/webhooks`;
  t.after(() => new Promise(resolve => server.close(resolve)));

  async function send(path, body, headers) {
    const response = await fetch(`${base}/${path}`, { method: 'POST', headers, body });
    return { status: response.status, data: await response.json() };
  }
  function githubSignature(body) {
    return 'sha256=' + crypto.createHmac('sha256', env.GITHUB_WEBHOOK_SECRET).update(body).digest('hex');
  }
  function slackHeaders(body, timestamp = String(Math.floor(Date.now() / 1000))) {
    return {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': 'v0=' + crypto.createHmac('sha256', env.SLACK_SIGNING_SECRET)
        .update(`v0:${timestamp}:${body}`).digest('hex')
    };
  }

  await t.test('GitHub accepts a raw-body signed ping and rejects bad signatures', async () => {
    const body = '{ "zen": "hello" }';
    const headers = {
      'content-type': 'application/json',
      'x-github-event': 'ping',
      'x-hub-signature-256': githubSignature(body)
    };
    assert.deepEqual(await send('github', body, headers),
      { status: 200, data: { success: true, event: 'ping' } });
    const invalid = await send('github', body, { ...headers, 'x-hub-signature-256': 'sha256=short' });
    assert.equal(invalid.status, 401);
    assert.equal(saves, 0);
  });

  await t.test('missing provider secrets fail closed', async () => {
    const githubSecret = env.GITHUB_WEBHOOK_SECRET;
    delete env.GITHUB_WEBHOOK_SECRET;
    assert.equal((await send('github', '{}', { 'content-type': 'application/json' })).status, 503);
    env.GITHUB_WEBHOOK_SECRET = githubSecret;

    const slackSecret = env.SLACK_SIGNING_SECRET;
    delete env.SLACK_SIGNING_SECRET;
    assert.equal((await send('slack', '', { 'content-type': 'application/x-www-form-urlencoded' })).status, 503);
    env.SLACK_SIGNING_SECRET = slackSecret;
    assert.equal(saves, 0);
  });

  await t.test('GitHub changes only a matching repository project', async () => {
    const body = JSON.stringify({
      action: 'opened',
      repository: { full_name: repo },
      pull_request: { html_url: prUrl }
    });
    const headers = {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-hub-signature-256': githubSignature(body)
    };
    assert.deepEqual(await send('github', body, headers),
      { status: 200, data: { success: true, updated: true } });
    assert.equal(project.status, 'awaiting_review');
    assert.equal(project.replit_task.status, 'in_progress');
    assert.equal(saves, 1);

    const wrongRepo = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'other/repository' },
      pull_request: { html_url: prUrl }
    });
    assert.equal((await send('github', wrongRepo, {
      ...headers, 'x-hub-signature-256': githubSignature(wrongRepo)
    })).status, 403);
    assert.equal(saves, 1);
  });

  await t.test('Slack checks timestamp, signature, command and approver', async () => {
    const empty = new URLSearchParams({
      command: '/approve', text: '', user_id: 'U_APPROVER', team_id: 'T_WORKSPACE'
    }).toString();
    assert.deepEqual(await send('slack', empty, slackHeaders(empty)),
      { status: 200, data: { response_type: 'ephemeral', text: 'Project ID required.' } });
    const alias = new URLSearchParams({
      command: '/sf-approve', text: '', user_id: 'U_APPROVER', team_id: 'T_WORKSPACE'
    }).toString();
    assert.equal((await send('slack', alias, slackHeaders(alias))).data.text, 'Project ID required.');
    assert.equal((await send('slack', empty, {
      ...slackHeaders(empty), 'x-slack-signature': 'v0=' + '0'.repeat(64)
    })).status, 401);
    assert.equal((await send('slack', empty, slackHeaders(empty, String(Math.floor(Date.now() / 1000) - 601)))).status, 401);
    assert.equal(saves, 1);

    project.status = 'draft';
    const approval = new URLSearchParams({
      command: '/approve', text: 'PRJ-TEST', user_id: 'U_APPROVER', team_id: 'T_WORKSPACE'
    }).toString();
    assert.equal((await send('slack', approval, slackHeaders(approval))).data.response_type, 'in_channel');
    assert.equal(project.status, 'approved_plan');
    assert.equal(project.approvals.length, 1);
    assert.equal(saves, 2);

    const unauthorized = new URLSearchParams({
      command: '/approve', text: 'PRJ-TEST', user_id: 'U_UNKNOWN', team_id: 'T_WORKSPACE'
    }).toString();
    assert.equal((await send('slack', unauthorized, slackHeaders(unauthorized))).data.text,
      'You are not authorized to approve projects.');
    assert.equal(saves, 2);
  });

  await t.test('custom webhook cannot write without its own secret', async () => {
    const result = await send('custom', JSON.stringify({ event_type: 'task_created', data: { name: 'No write' } }),
      { 'content-type': 'application/json' });
    assert.equal(result.status, 503);
    assert.equal(saves, 2);
  });
});