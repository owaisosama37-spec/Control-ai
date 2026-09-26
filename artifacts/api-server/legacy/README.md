# 🌟 StarFruit Control Room

**Autonomous AI Control Room & Orchestration OS** - A sophisticated system for managing the workflow between Claude, Replit, and Gemini AI systems to deliver high-value enterprise software solutions.

![Status](https://img.shields.io/badge/Status-Active%20Development-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🎯 Purpose

StarFruit Control Room is built to orchestrate the delivery of high-value enterprise software solutions ($100k+ annual revenue target) by coordinating three specialized AI systems:

- **Claude** 🧠 - AI Planning & Architecture
- **Replit** 💻 - Code Execution & Implementation  
- **Gemini** 🔒 - Security Review & Validation

Perfect for delivering enterprise solutions like WhatsApp bots, CRM systems, analytics dashboards, and email campaign tools.

---

## ⚡ Key Features

### 🔄 Workflow Management
- **State Machine**: Draft → Approved Plan → Awaiting Review → Merged
- **Priority Queue**: Dynamic project prioritization
- **Real-time Updates**: WebSocket-based live status tracking
- **Agent Coordination**: Seamless handoff between Claude, Replit, and Gemini

### 🔐 Security & Audit
- **HMAC-SHA256 Signatures**: Cryptographic verification on all critical operations
- **Immutable Audit Logs**: Complete audit trail with 90-day retention
- **Role-Based Access Control**: Admin, Senior Developer, Client Manager, Auditor roles
- **Approval Workflows**: Multi-stage approval with signature verification

### 💰 Financial Management
- **Budget Tracking**: Real-time cost vs. budget analysis
- **Token Efficiency**: Monitor AI model token consumption
- **Profit Margin Calculation**: Per-project profitability metrics
- **Revenue Goal Tracking**: Progress toward $100k annual target

### 📊 Analytics & Reporting
- **Dashboard Metrics**: Real-time KPIs and performance indicators
- **Agent Performance**: Track Claude, Replit, and Gemini productivity
- **Compliance Reports**: Automated audit reports with verification status
- **Historical Analytics**: Time-series data for trend analysis

### 🔗 Integrations
- **GitHub Webhooks**: PR automation and deployment tracking
- **Slack Commands**: Interactive approval workflow via `/approve` slash commands
- **Email Notifications**: Real-time alerts and approval requests
- **Custom Webhooks**: Integration with external systems

---

## 📋 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  StarFruit Control Room                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Claude     │    │   Replit     │    │   Gemini     │  │
│  │  Planning    │───▶│ Execution    │───▶│  Security    │  │
│  │              │    │              │    │   Review     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│        🧠                  💻                   🔒           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│         Queue Management & Orchestration Layer              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  • Project State Machine      • Approval Workflows         │
│  • Priority Scheduling        • Audit Logging              │
│  • Token Budget Management    • Financial Tracking         │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│              Integration & Notification Layer               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  • GitHub Integration    • Slack Bot     • Email Service   │
│  • WebSocket Updates     • Analytics API • Custom Webhooks │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 7.0+
- Docker & Docker Compose (optional)
- GitHub, Slack, and email credentials

### Installation

1. **Clone and Setup**
```bash
git clone <repository-url>
cd starfruit-control-room
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Initialize Database**
```bash
npm run db:init
```

4. **Start Development Server**
```bash
npm run dev
```

The server starts on `http://localhost:3000`

### Docker Setup

```bash
# Build and run with Docker Compose
docker-compose up -d

# Initialize database in container
docker-compose exec app npm run db:init

# View logs
docker-compose logs -f app
```

---

## 📚 API Documentation

### Authentication

**Register User**
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "secure-password",
  "full_name": "User Name",
  "role": "senior_developer"
}
```

**Login**
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

### Projects

**Create Project**
```bash
POST /api/projects
{
  "name": "WhatsApp Bot for Hotel Chain",
  "description": "Customer service bot for 5-star hotel",
  "client_name": "Luxury Hotels Group",
  "budget": 15000,
  "project_type": "whatsapp_bot",
  "priority": 9
}
```

**Get Project Queue**
```bash
GET /api/queue
```

**Assign Tasks to Agents**
```bash
POST /api/projects/{id}/assign-claude
POST /api/projects/{id}/assign-replit
POST /api/projects/{id}/assign-gemini
```

**Update Project Status**
```bash
PUT /api/projects/{id}/status
{
  "status": "approved_plan"
}
```

### Analytics

**Dashboard Metrics**
```bash
GET /api/analytics/dashboard
```

**Agent Performance**
```bash
GET /api/analytics/agents
```

**Audit Reports**
```bash
GET /api/audit/report/generate?start_date=2024-01-01&end_date=2024-01-31
```

---

## 🔧 Project Structure

```
starfruit-control-room/
├── models/                 # MongoDB schemas
│   ├── Project.js
│   ├── User.js
│   ├── AuditLog.js
│   └── Analytics.js
├── routes/                 # API route handlers
│   ├── auth.js
│   ├── projects.js
│   ├── tasks.js
│   ├── analytics.js
│   ├── audit.js
│   ├── settings.js
│   └── webhooks.js
├── controllers/            # Business logic
│   ├── projectController.js
│   ├── queueController.js
│   └── approvalController.js
├── services/              # External integrations
│   ├── slackService.js
│   ├── emailService.js
│   └── githubService.js
├── middleware/            # Express middleware
│   ├── auth.js
│   ├── errorHandler.js
│   └── logging.js
├── utils/                 # Utility functions
│   ├── calculations.js
│   └── formatting.js
├── scripts/              # Database & setup scripts
│   └── initDatabase.js
├── server.js             # Main server file
├── package.json
├── .env.example
└── README.md
```

---

## 📊 Default Users

After database initialization, these users are created:

| Email | Password | Role |
|-------|----------|------|
| admin@starfruit.local | admin123 | Admin |
| manager@starfruit.local | manager123 | Client Manager |
| developer@starfruit.local | developer123 | Senior Developer |

⚠️ **Change all default passwords in production!**

---

## 🔐 Security Features

- **JWT Authentication**: 24-hour token expiration
- **HMAC Signatures**: SHA256 verification on all critical operations
- **Rate Limiting**: 100 requests per 15 minutes
- **Helmet Middleware**: HTTP security headers
- **CORS Protection**: Configurable allowed origins
- **Audit Logging**: Immutable cryptographic audit trail
- **Permission-Based Access**: Granular role-based access control

---

## 📈 Financial Tracking

Track your path to $100k annual revenue:

```json
{
  "total_budget": 85000,
  "completed_projects": 5,
  "total_revenue": 85000,
  "progress_to_100k": 85.00,
  "profit_margin": 42.35,
  "projected_completion": "2 months"
}
```

---

## 🤖 Agent Coordination

### Claude Planning Phase
- Analyzes requirements
- Designs architecture
- Estimates tokens required
- ~5,000-20,000 tokens per project

### Replit Execution Phase
- Implements code
- Runs tests
- Creates GitHub PR
- ~8,000-35,000 tokens per project

### Gemini Security Review
- Identifies vulnerabilities
- Reviews code quality
- Validates compliance
- ~2,000-10,000 tokens per project

---

## 🔄 Workflow State Machine

```
    ┌─────────────┐
    │    DRAFT    │
    └──────┬──────┘
           │ Approve
           ▼
    ┌─────────────────┐
    │ APPROVED_PLAN   │
    └──────┬──────────┘
           │ Assign to Replit
           ▼
    ┌──────────────────┐
    │  AWAITING_REVIEW │
    └────┬────────┬────┘
         │        │
      Merge    Reject
         │        │
         ▼        ▼
      ┌─────┐  ┌────────┐
      │MERGE│  │REJECTED│
      └─┬───┘  └───┬────┘
        │          │ Rework
        │          ▼
        │       DRAFT
        │          
      Pause
        │
        ▼
      PAUSED ◀──────┐
        │           │
        └───────────┘
          Resume
```

---

## 📧 Webhook Integrations

### GitHub
```bash
POST /api/webhooks/github
Headers: X-Hub-Signature-256 (HMAC-SHA256 of the raw body), X-GitHub-Event
Events: pull_request opened, synchronize, closed+merged
```
Requires `GITHUB_WEBHOOK_SECRET`; project-changing events also require
`GITHUB_REPO` or both `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME`.
Use a signed `ping` event for a safe local connectivity check.

### Slack
```bash
POST /api/webhooks/slack
Headers: X-Slack-Signature, X-Slack-Request-Timestamp
Commands: /approve <project-id> (or /sf-approve <project-id>)
```
Requires `SLACK_SIGNING_SECRET` and an active legacy user mapped to the Slack
user and workspace with `approve_projects` permission. The local smoke check
uses an empty project ID so it cannot change a real project.

### Custom
```bash
POST /api/webhooks/custom
Header: X-Webhook-Signature (HMAC-SHA256 of the raw body)
Event: task_created
```
Requires `CUSTOM_WEBHOOK_SECRET`; without it the endpoint fails closed.

---

## 🐛 Troubleshooting

**MongoDB Connection Error**
```bash
# Ensure MongoDB is running
mongosh  # Test connection
npm run db:init  # Reinitialize
```

**Port Already in Use**
```bash
# Change port in .env
PORT=3001
```

**JWT Token Invalid**
```bash
# Update JWT_SECRET in .env and re-login
npm run dev
```

---

## 📝 Environment Variables

Key environment variables:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret (change in production) |
| `HMAC_SECRET` | HMAC signing secret (change in production) |
| `GITHUB_TOKEN` | GitHub API token |
| `SLACK_BOT_TOKEN` | Slack bot token |
| `SMTP_HOST` | Email server hostname |
| `DAILY_TOKEN_BUDGET` | Daily AI token budget |
| `MONTHLY_TOKEN_BUDGET` | Monthly AI token budget |

See `.env.example` for all variables.

---

## 🚢 Deployment

### Production Checklist

- [ ] Update all `.env` secrets
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set up MongoDB backups
- [ ] Configure email service
- [ ] Test GitHub/Slack integrations
- [ ] Set up monitoring/logging
- [ ] Review security settings
- [ ] Run database migration
- [ ] Test all API endpoints

### Docker Deployment

```bash
docker-compose -f docker-compose.yml up -d
docker-compose logs -f app
```

---

## 📞 Support

**Built by**: Osama Owais  
**Location**: Kuwait  
**Target Market**: Enterprise clients (hotels, e-commerce, SaaS)

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🎯 Roadmap

- [ ] AI-powered project cost estimation
- [ ] Advanced analytics dashboard (frontend)
- [ ] Mobile app for approvals
- [ ] Integration with more AI models
- [ ] Automated deployment pipelines
- [ ] Advanced security compliance reports
- [ ] Multi-language support

---

**StarFruit Control Room** - Where AI agents work in perfect harmony to deliver enterprise solutions 🌟
