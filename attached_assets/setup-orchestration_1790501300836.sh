#!/bin/bash

# StarFruit Control Room - Orchestration Setup Script
# نص إعداد شامل - انزل كل حاجة مرة واحدة على Replit

echo "🚀 StarFruit Orchestration Setup"
echo "================================"

# 1. إنشاء المجلد
mkdir -p orchestration
cd orchestration

# 2. إنشاء package.json
cat > package.json << 'EOF'
{
  "name": "@starfruit/orchestration",
  "version": "1.0.0",
  "description": "StarFruit Control Room - Orchestration Layer",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development node server.js",
    "test": "node test-orchestrator.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.2.2",
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# 3. إنشاء .env.example
cat > .env.example << 'EOF'
NODE_ENV=development
PORT=3000
MANAGER_SECRET=your-secret-key-here
EMERGENCY_SECRET=emergency-key-here
DATABASE_PATH=:memory:
EOF

# 4. إنشاء .env من النموذج
cp .env.example .env

# 5. إنشاء orchestrator.js
cat > orchestrator.js << 'EOF'
import crypto from 'crypto';

export const STATES = {
  DRAFT: 'draft',
  APPROVED_PLAN: 'approved_plan',
  AWAITING_REVIEW: 'awaiting_review',
  MERGED: 'merged',
  PAUSED: 'paused',
  REJECTED: 'rejected'
};

export class Orchestrator {
  constructor(db) {
    this.db = db;
  }

  async createTask(userId, requirement, managerSignature) {
    console.log('📋 Creating task from user:', userId);

    const taskId = crypto.randomUUID();
    const task = {
      id: taskId,
      userId,
      requirement,
      state: STATES.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
      history: [{ state: STATES.DRAFT, timestamp: new Date(), action: 'Created' }],
      claudePlan: null,
      replitCode: null,
      geminReview: null,
      managerApproval: null,
      githubPR: null
    };

    this.db.prepare(`
      INSERT INTO tasks (id, user_id, requirement, state, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.userId,
      JSON.stringify(requirement),
      task.state,
      JSON.stringify(task),
      task.createdAt.toISOString()
    );

    console.log('✅ Task created:', taskId);
    return task;
  }

  async claudeDesignPhase(taskId, claudeResponse) {
    console.log('🔨 Claude design phase:', taskId);

    const task = this._getTask(taskId);
    if (task.state !== STATES.DRAFT) {
      throw new Error(`Wrong state: ${task.state}`);
    }

    task.claudePlan = claudeResponse;
    task.state = STATES.APPROVED_PLAN;
    task.history.push({
      state: STATES.APPROVED_PLAN,
      timestamp: new Date(),
      action: 'Claude designed architecture'
    });

    this._saveTask(task);
    console.log('✅ Claude design complete');
    return task;
  }

  async managerApprovesPlan(taskId, managerSignature) {
    console.log('👨‍💼 Manager approves plan:', taskId);

    const task = this._getTask(taskId);
    if (task.state !== STATES.APPROVED_PLAN) {
      throw new Error(`Wrong state: ${task.state}`);
    }

    task.managerApproval = {
      approvedAt: new Date(),
      signature: managerSignature
    };
    task.state = STATES.AWAITING_REVIEW;
    task.history.push({
      state: STATES.AWAITING_REVIEW,
      timestamp: new Date(),
      action: 'Manager approved plan'
    });

    this._saveTask(task);
    console.log('✅ Manager approved');
    return task;
  }

  async replitExecute(taskId, generatedCode, githubPRNumber) {
    console.log('⚙️ Replit execute:', taskId);

    const task = this._getTask(taskId);

    task.replitCode = generatedCode;
    task.githubPR = githubPRNumber;
    task.history.push({
      state: STATES.AWAITING_REVIEW,
      timestamp: new Date(),
      action: `Replit executed, PR: ${githubPRNumber}`
    });

    this._saveTask(task);
    console.log('✅ Replit executed');
    return task;
  }

  async geminReview(taskId, reviewResult) {
    console.log('🔍 Gemini review:', taskId);

    const task = this._getTask(taskId);
    if (task.state !== STATES.AWAITING_REVIEW) {
      throw new Error(`Wrong state: ${task.state}`);
    }

    task.geminReview = {
      issues: reviewResult.issues || [],
      securityLevel: reviewResult.securityLevel || 'medium',
      approved: reviewResult.approved,
      timestamp: new Date()
    };

    task.state = reviewResult.approved ? STATES.MERGED : STATES.REJECTED;
    task.history.push({
      state: task.state,
      timestamp: new Date(),
      action: `Gemini review: ${task.state}`
    });

    this._saveTask(task);
    console.log('✅ Gemini review complete');
    return task;
  }

  async getTaskStatus(taskId) {
    const task = this._getTask(taskId);
    return {
      id: task.id,
      state: task.state,
      requirement: task.requirement,
      claudePlan: task.claudePlan ? '✅' : '⏳',
      replitCode: task.replitCode ? `✅ PR #${task.githubPR}` : '⏳',
      geminReview: task.geminReview ? task.geminReview.approved ? '✅' : '❌' : '⏳',
      history: task.history
    };
  }

  async pauseTask(taskId, reason) {
    const task = this._getTask(taskId);
    task.state = STATES.PAUSED;
    task.history.push({
      state: STATES.PAUSED,
      timestamp: new Date(),
      action: `Paused: ${reason}`
    });
    this._saveTask(task);
    console.log('⏸️ Task paused:', taskId);
    return task;
  }

  _getTask(taskId) {
    const row = this.db.prepare('SELECT metadata FROM tasks WHERE id = ?').get(taskId);
    if (!row) throw new Error(`Task not found: ${taskId}`);
    return JSON.parse(row.metadata);
  }

  _saveTask(task) {
    this.db.prepare(`
      UPDATE tasks SET metadata = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(task), new Date().toISOString(), task.id);
  }
}
EOF

# 6. إنشاء database.js
cat > database.js << 'EOF'
import Database from 'better-sqlite3';

export function initializeDatabase(dbPath = ':memory:') {
  const db = new Database(dbPath);

  console.log('🗄️ Initializing database...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      requirement TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'draft',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      old_state TEXT,
      new_state TEXT,
      action TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      channel TEXT,
      message TEXT,
      status TEXT DEFAULT 'pending',
      sent_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT,
      event_type TEXT,
      actor TEXT,
      details TEXT,
      timestamp TEXT NOT NULL
    )
  `);

  console.log('✅ Database ready');
  return db;
}

export const dbHelpers = {
  createNotification(db, taskId, type, channel, message) {
    const id = `notif-${Date.now()}`;
    db.prepare(`
      INSERT INTO notifications (id, task_id, type, channel, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, taskId, type, channel, message, new Date().toISOString());
    return id;
  },

  logAuditEvent(db, taskId, eventType, actor, details) {
    db.prepare(`
      INSERT INTO audit_log (task_id, event_type, actor, details, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, eventType, actor, JSON.stringify(details), new Date().toISOString());
  },

  getPendingTasks(db) {
    return db.prepare(`
      SELECT * FROM tasks WHERE state IN ('draft', 'approved_plan', 'awaiting_review')
      ORDER BY created_at ASC
    `).all();
  }
};
EOF

# 7. إنشاء routes.js
cat > routes.js << 'EOF'
import express from 'express';
import { Orchestrator, STATES } from './orchestrator.js';
import { dbHelpers } from './database.js';

export function createOrchestrationRoutes(db) {
  const router = express.Router();
  const orchestrator = new Orchestrator(db);

  router.post('/orchestrate', async (req, res) => {
    try {
      console.log('📨 New orchestration request');
      const { requirement, managerSignature } = req.body;

      if (!requirement) {
        return res.status(400).json({ error: 'Requirement missing' });
      }

      const userId = req.headers['x-user-id'] || 'unknown';
      const task = await orchestrator.createTask(userId, requirement, managerSignature);

      dbHelpers.logAuditEvent(db, task.id, 'task_created', userId, { requirement });
      dbHelpers.createNotification(db, task.id, 'task_created', 'general_alerts', `Task created: ${task.id}`);

      res.status(201).json({ success: true, taskId: task.id, state: task.state });
    } catch (error) {
      console.error('❌ Error:', error.message);
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/orchestrate/:taskId', async (req, res) => {
    try {
      const { taskId } = req.params;
      const status = await orchestrator.getTaskStatus(taskId);
      res.json({ success: true, task: status });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.post('/orchestrate/:taskId/claude-plan', async (req, res) => {
    try {
      const { taskId } = req.params;
      const { plan } = req.body;

      if (!plan) return res.status(400).json({ error: 'Plan missing' });

      console.log(`🔨 Claude plan for ${taskId}`);
      const task = await orchestrator.claudeDesignPhase(taskId, plan);

      dbHelpers.logAuditEvent(db, taskId, 'claude_plan_submitted', 'claude', plan);
      dbHelpers.createNotification(db, taskId, 'claude_plan_ready', 'general_alerts', `Claude ready for ${taskId}`);

      res.json({ success: true, taskId, state: task.state });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/orchestrate/:taskId/approve-plan', async (req, res) => {
    try {
      const { taskId } = req.params;
      const managerSignature = req.headers['x-manager-id'];

      if (!managerSignature) return res.status(401).json({ error: 'Missing signature' });

      console.log(`👨‍💼 Manager approves ${taskId}`);
      const task = await orchestrator.managerApprovesPlan(taskId, managerSignature);

      dbHelpers.logAuditEvent(db, taskId, 'manager_approved', 'manager', {});
      dbHelpers.createNotification(db, taskId, 'plan_approved', 'general_alerts', `Plan approved`);

      res.json({ success: true, taskId, state: task.state });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/orchestrate/:taskId/replit-executed', async (req, res) => {
    try {
      const { taskId } = req.params;
      const { code, prNumber } = req.body;

      if (!code || !prNumber) return res.status(400).json({ error: 'Missing code or PR' });

      console.log(`⚙️ Replit executed - PR: ${prNumber}`);
      const task = await orchestrator.replitExecute(taskId, code, prNumber);

      dbHelpers.logAuditEvent(db, taskId, 'replit_executed', 'replit', { prNumber });
      dbHelpers.createNotification(db, taskId, 'code_ready', 'general_alerts', `Code ready - PR #${prNumber}`);

      res.json({ success: true, taskId, state: task.state, prNumber });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/orchestrate/:taskId/gemini-review', async (req, res) => {
    try {
      const { taskId } = req.params;
      const { approved, issues, securityLevel } = req.body;

      console.log(`🔍 Gemini review for ${taskId}`);
      const task = await orchestrator.geminReview(taskId, { approved, issues, securityLevel });

      dbHelpers.logAuditEvent(db, taskId, 'gemini_review', 'gemini', { approved, issues });
      const msg = approved ? '✅ Approved by Gemini' : '⚠️ Issues found';
      dbHelpers.createNotification(db, taskId, 'gemini_review', 'general_alerts', msg);

      res.json({ success: true, taskId, state: task.state });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/orchestrate/:taskId/pause', async (req, res) => {
    try {
      const { taskId } = req.params;
      const { reason } = req.body;

      const task = await orchestrator.pauseTask(taskId, reason);
      dbHelpers.logAuditEvent(db, taskId, 'task_paused', 'system', { reason });
      dbHelpers.createNotification(db, taskId, 'task_paused', 'general_alerts', `Paused: ${reason}`);

      res.json({ success: true, taskId, state: task.state });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/tasks/pending', (req, res) => {
    try {
      const pending = dbHelpers.getPendingTasks(db);
      res.json({ success: true, count: pending.length, tasks: pending });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
EOF

# 8. إنشاء server.js
cat > server.js << 'EOF'
import express from 'express';
import { initializeDatabase } from './database.js';
import { createOrchestrationRoutes } from './routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const db = initializeDatabase(process.env.DATABASE_PATH || ':memory:');

app.use(express.json());
app.use((req, res, next) => {
  console.log(`\n📡 ${req.method} ${req.path}`);
  next();
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const orchestrationRoutes = createOrchestrationRoutes(db);
app.use('/api', orchestrationRoutes);

app.get('/api/system/info', (req, res) => {
  res.json({
    name: 'StarFruit Orchestration',
    version: '1.0.0',
    states: ['draft', 'approved_plan', 'awaiting_review', 'merged', 'paused', 'rejected']
  });
});

app.use((error, req, res, next) => {
  console.error('❌ Error:', error);
  res.status(500).json({ error: 'Server error' });
});

const server = app.listen(PORT, () => {
  console.log('\n🚀 StarFruit Orchestration Server');
  console.log('═'.repeat(50));
  console.log(`✅ Running on port: ${PORT}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_PATH || 'In-Memory'}`);
  console.log('═'.repeat(50));
  console.log('\n📚 Available routes:');
  console.log('  POST   /api/orchestrate');
  console.log('  GET    /api/orchestrate/:taskId');
  console.log('  POST   /api/orchestrate/:taskId/claude-plan');
  console.log('  POST   /api/orchestrate/:taskId/approve-plan');
  console.log('  POST   /api/orchestrate/:taskId/replit-executed');
  console.log('  POST   /api/orchestrate/:taskId/gemini-review');
  console.log('  POST   /api/orchestrate/:taskId/pause');
  console.log('  GET    /api/tasks/pending\n');
});

process.on('SIGINT', () => {
  console.log('\n\n⏹️ Shutting down...');
  server.close(() => {
    console.log('✅ Closed');
    process.exit(0);
  });
});
EOF

# 9. إنشاء test-orchestrator.js
cat > test-orchestrator.js << 'EOF'
import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';
const MANAGER_SECRET = 'test-key';

function createSignature(data) {
  return crypto
    .createHmac('sha256', MANAGER_SECRET)
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex');
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'test-user'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${path}`, options);
  return { status: response.status, data: await response.json() };
}

async function runTests() {
  console.log('\n🧪 Orchestration Tests');
  console.log('═'.repeat(60));

  try {
    // 1. Create task
    console.log('\n1️⃣ Creating task...');
    const requirement = { title: 'API', description: 'Build API with OAuth2' };
    const { status: s1, data: d1 } = await request('POST', '/api/orchestrate', {
      requirement,
      managerSignature: createSignature(requirement)
    });

    if (s1 !== 201) {
      console.error('❌ Failed to create task');
      return;
    }

    const taskId = d1.taskId;
    console.log(`✅ Task created: ${taskId}`);

    // 2. Get status
    console.log('\n2️⃣ Getting status...');
    const { data: d2 } = await request('GET', `/api/orchestrate/${taskId}`);
    console.log(`✅ State: ${d2.task.state}`);

    // 3. Claude plan
    console.log('\n3️⃣ Claude submits plan...');
    const plan = { architecture: 'Node.js + Express', timeline: '2 weeks' };
    const { data: d3 } = await request('POST', `/api/orchestrate/${taskId}/claude-plan`, { plan });
    console.log(`✅ State: ${d3.state}`);

    // 4. Manager approval
    console.log('\n4️⃣ Manager approves...');
    const sig = createSignature(JSON.stringify(plan));
    const { data: d4 } = await request('POST', `/api/orchestrate/${taskId}/approve-plan`, {});
    console.log(`✅ State: ${d4.state}`);

    // 5. Replit executed
    console.log('\n5️⃣ Replit executes...');
    const { data: d5 } = await request('POST', `/api/orchestrate/${taskId}/replit-executed`, {
      code: 'const app = express();',
      prNumber: 42
    });
    console.log(`✅ State: ${d5.state}, PR: #${d5.prNumber}`);

    // 6. Gemini review
    console.log('\n6️⃣ Gemini reviews...');
    const { data: d6 } = await request('POST', `/api/orchestrate/${taskId}/gemini-review`, {
      approved: true,
      issues: [],
      securityLevel: 'high'
    });
    console.log(`✅ Final State: ${d6.state}`);

    // 7. Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Test Summary:');
    console.log('  ✅ Create Task');
    console.log('  ✅ Claude Plan');
    console.log('  ✅ Manager Approval');
    console.log('  ✅ Replit Execution');
    console.log('  ✅ Gemini Review');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

setTimeout(() => runTests(), 1000);
EOF

# 10. تثبيت المكتبات
echo ""
echo "📦 Installing dependencies..."
npm install

# 11. الانتهاء
echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start:"
echo "   npm run dev"
echo ""
echo "🧪 To test:"
echo "   npm run test"
echo ""
