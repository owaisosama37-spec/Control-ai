# 📦 StarFruit Control Room - Project Manifest

Complete file structure and documentation for the StarFruit Control Room orchestration system.

## 📁 Project Structure

```
starfruit-control-room/
│
├── 📄 package.json                    [Dependencies & Scripts]
├── 📄 server.js                       [Main Express Server & WebSocket Setup]
├── 📄 .env.example                    [Environment Variables Template]
├── 📄 README.md                       [Main Documentation]
├── 📄 SETUP_GUIDE.md                  [Replit Setup Instructions]
├── 📄 PROJECT_MANIFEST.md             [This file]
├── 📄 Dockerfile                      [Docker Image Configuration]
├── 📄 docker-compose.yml              [Docker Compose Setup]
├── .gitignore
│
├── 📂 models/                         [MongoDB Database Schemas]
│   ├── Project.js                     [Project/Task Model]
│   ├── User.js                        [User Authentication Model]
│   ├── AuditLog.js                    [Immutable Audit Trail]
│   └── Analytics.js                   [Time-series Analytics Data]
│
├── 📂 routes/                         [REST API Endpoints]
│   ├── auth.js                        [Authentication: register, login, verify]
│   ├── projects.js                    [Project CRUD Operations]
│   ├── tasks.js                       [Task Queue Management]
│   ├── analytics.js                   [Dashboard Metrics & Reports]
│   ├── audit.js                       [Audit Log Access & Reports]
│   ├── settings.js                    [User & System Configuration]
│   └── webhooks.js                    [GitHub, Slack, Custom Webhooks]
│
├── 📂 controllers/                    [Business Logic Layer]
│   ├── projectController.js           [Project CRUD & Agent Assignment]
│   ├── queueController.js             [Queue Management & Prioritization]
│   └── approvalController.js          [Approval Workflows & Signatures]
│
├── 📂 services/                       [External Integration Services]
│   ├── slackService.js                [Slack Bot Integration]
│   ├── emailService.js                [Email Notification Service]
│   └── githubService.js               [GitHub API Integration]
│
├── 📂 middleware/                     [Express Middleware]
│   ├── auth.js                        [JWT & HMAC Authentication]
│   ├── errorHandler.js                [Global Error Handler]
│   └── logging.js                     [Request Logging & Audit Trail]
│
├── 📂 utils/                          [Utility Functions]
│   ├── calculations.js                [Financial & Performance Calculations]
│   └── formatting.js                  [Date, Currency, Status Formatting]
│
├── 📂 scripts/                        [Automation & Setup Scripts]
│   └── initDatabase.js                [Database Initialization Script]
│
└── 📂 public/ (future)                [Static Assets & Frontend]
    └── [HTML/CSS/JS Dashboard Files]
```

---

## 📋 File Descriptions & Size Estimates

### Core Configuration Files

| File | Purpose | Size |
|------|---------|------|
| `package.json` | Node.js dependencies and scripts | ~2 KB |
| `.env.example` | Environment variables template | ~3 KB |
| `Dockerfile` | Docker image configuration | ~1 KB |
| `docker-compose.yml` | Docker Compose setup | ~3 KB |

### Server & Main Files

| File | Purpose | Size |
|------|---------|------|
| `server.js` | Express server, WebSocket, middleware setup | ~15 KB |
| `PROJECT_MANIFEST.md` | This file - complete project documentation | ~10 KB |
| `README.md` | Main project documentation & features | ~20 KB |
| `SETUP_GUIDE.md` | Step-by-step setup guide for Replit | ~15 KB |

### Database Models

| File | Lines | Purpose |
|------|-------|---------|
| `models/Project.js` | ~250 | Project/task data structure with metrics |
| `models/User.js` | ~300 | User authentication & permissions |
| `models/AuditLog.js` | ~200 | Immutable audit trail with HMAC verification |
| `models/Analytics.js` | ~180 | Time-series performance metrics |

### REST API Routes

| File | Lines | Endpoints | Purpose |
|------|-------|-----------|---------|
| `routes/auth.js` | ~165 | 4 | User registration, login, token management |
| `routes/projects.js` | ~180 | 6 | Project CRUD and status management |
| `routes/tasks.js` | ~130 | 4 | Task queue and workflow |
| `routes/analytics.js` | ~190 | 4 | Dashboard, agent performance, reports |
| `routes/audit.js` | ~130 | 4 | Audit logs and compliance reports |
| `routes/settings.js` | ~160 | 6 | User and system settings |
| `routes/webhooks.js` | ~140 | 3 | GitHub, Slack, custom webhooks |

### Business Logic Controllers

| File | Lines | Purpose |
|------|-------|---------|
| `controllers/projectController.js` | ~350 | Project operations & agent task assignment |
| `controllers/queueController.js` | ~280 | Queue management & prioritization |
| `controllers/approvalController.js` | ~310 | Approval workflows & HMAC signatures |

### External Services

| File | Lines | Integrations |
|------|-------|--------------|
| `services/slackService.js` | ~240 | Slack bot, approvals, notifications |
| `services/emailService.js` | ~320 | Email notifications & alerts |
| `services/githubService.js` | ~380 | GitHub API, PR management, releases |

### Middleware & Utilities

| File | Lines | Purpose |
|------|-------|---------|
| `middleware/auth.js` | ~80 | JWT & HMAC authentication |
| `middleware/errorHandler.js` | ~40 | Global error handling |
| `middleware/logging.js` | ~100 | Request logging & audit trail creation |
| `utils/calculations.js` | ~270 | Financial & performance calculations |
| `utils/formatting.js` | ~250 | Date, currency, status formatting |

### Scripts

| File | Purpose |
|------|---------|
| `scripts/initDatabase.js` | Initialize MongoDB with indexes and default users |

---

## 🔄 API Endpoints Summary

### Authentication (7 endpoints)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify` - Verify token validity
- `POST /api/auth/refresh` - Refresh expired token

### Projects (8 endpoints)
- `GET /api/projects` - List projects with filters
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id/status` - Update project status
- `POST /api/projects/:id/assign-claude` - Assign Claude task
- `PUT /api/projects/:id/claude-complete` - Mark Claude done
- `POST /api/projects/:id/assign-replit` - Assign Replit task
- `PUT /api/projects/:id/replit-complete` - Mark Replit done

### Queue Management (6 endpoints)
- `GET /api/queue` - Get current queue
- `GET /api/queue/next/claude` - Get next for Claude
- `GET /api/queue/next/replit` - Get next for Replit
- `GET /api/queue/next/gemini` - Get next for Gemini
- `POST /api/queue/reorder` - Reorder by priority
- `GET /api/queue/stats` - Queue statistics

### Approvals (5 endpoints)
- `GET /api/approvals` - Get pending approvals
- `POST /api/approvals/:id/approve` - Approve project
- `POST /api/approvals/:id/reject` - Reject project
- `GET /api/approvals/:id/chain` - Get approval chain
- `POST /api/approvals/batch` - Batch approve

### Analytics (4 endpoints)
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/analytics/detailed` - Detailed analytics
- `GET /api/analytics/agents` - Agent performance
- `GET /api/analytics/by-type` - Stats by project type

### Audit & Settings (10 endpoints)
- `GET /api/audit` - List audit logs
- `GET /api/audit/:id` - Get specific log
- `GET /api/audit/report/generate` - Generate compliance report
- `POST /api/audit/:id/verify` - Verify log integrity
- `GET /api/settings/user` - User settings
- `PUT /api/settings/user` - Update user settings
- `GET /api/settings/system` - System settings (admin)
- `PUT /api/settings/system` - Update system settings (admin)
- `GET /api/settings/notifications` - Notification settings
- `PUT /api/settings/notifications` - Update notifications

### Webhooks (3 endpoints)
- `POST /api/webhooks/github` - GitHub PR events
- `POST /api/webhooks/slack` - Slack commands
- `POST /api/webhooks/custom` - Custom events

### System (3 endpoints)
- `GET /api/system/status` - System health & mode
- `POST /api/system/sleep-mode` - Toggle autonomous/manual
- `POST /api/system/emergency-stop` - Emergency stop all operations
- `GET /health` - Health check

**Total API Endpoints: 60+**

---

## 🗄️ Database Collections

### Collections Created by mongoose

1. **users** - User accounts and permissions
   - Indexes: email (unique), user_id (unique), created_at

2. **projects** - Projects/tasks with state and agent assignments
   - Indexes: project_id (unique), status+priority, created_at, github_pr_url

3. **auditlogs** - Immutable audit trail
   - Indexes: log_id (unique), action+created_at, actor+created_at, target_type+target_id
   - TTL: 90 days

4. **analytics** - Time-series metrics
   - Indexes: period+timestamp, timestamp

---

## 🔐 Security Features

### Authentication & Authorization
- ✅ JWT tokens (24-hour expiration)
- ✅ HMAC-SHA256 signature verification
- ✅ Role-based access control (4 roles)
- ✅ Permission-based operations
- ✅ Secure password hashing (bcryptjs)

### Audit & Compliance
- ✅ Immutable audit logs with crypto verification
- ✅ Complete action history
- ✅ Actor tracking (human/claude/replit/gemini)
- ✅ Approval chain with signatures
- ✅ 90-day log retention with TTL

### API Security
- ✅ CORS protection
- ✅ Rate limiting (100 req/15min)
- ✅ Helmet security headers
- ✅ Request validation
- ✅ Error handling without info leakage

---

## 💻 Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB 7.0+
- **Cache**: Redis (optional)

### Authentication
- **JWT**: jsonwebtoken
- **Hashing**: bcryptjs
- **Crypto**: Node.js crypto module

### Integrations
- **Slack**: @slack/web-api
- **GitHub**: axios
- **Email**: nodemailer

### Real-time
- **WebSocket**: socket.io
- **Client**: socket.io-client

### Utilities
- **Date**: date-fns
- **UUID**: uuid
- **Compression**: compression
- **CORS**: cors
- **Security**: helmet
- **Environment**: dotenv
- **UUID**: v4

### Development
- **Auto-reload**: nodemon
- **Linting**: (configurable)
- **Testing**: (to be configured)

---

## 📊 Key Metrics Tracked

### Financial
- Total budget vs actual cost
- Profit & profit margin per project
- Revenue progress toward $100k goal
- Token efficiency (budget/tokens)

### Performance
- Time to merge (planning to merged)
- Planning duration
- Execution speed
- Code quality scores
- Security findings count
- Test coverage percentage

### Operational
- Projects by status
- Queue length and wait times
- Agent utilization
- Approval workflow metrics
- System uptime & SLA compliance

---

## 🚀 Deployment & Operations

### Local Development
```bash
npm install
npm run dev                # Auto-reload server
npm run db:init          # Initialize database
```

### Docker
```bash
docker-compose up -d     # Run all services
docker-compose logs -f   # View logs
docker-compose down      # Stop all services
```

### Production (Replit)
```bash
npm install
npm run db:init
npm start                # Production server
```

---

## 📞 User Roles & Permissions

### Admin
- View/create/approve all projects
- Manage all users
- View audit logs
- System configuration
- Emergency stop authority

### Senior Developer
- View projects
- Merge code to main
- View analytics

### Client Manager
- View projects
- Create projects
- Approve projects

### Auditor
- View audit logs
- Generate compliance reports
- Verify log integrity

---

## 🎯 Default Configuration

### Token Budgets
- Daily: 10,000 tokens
- Monthly: 300,000 tokens

### Approval Thresholds
- Small project: < $500 (auto-approve)
- Medium project: $500-$2,000 (manager approval)
- Large project: > $2,000 (admin approval)

### Rate Limiting
- 100 requests per 15 minutes
- Per-IP tracking

### Token Retention
- Audit logs: 90 days
- Analytics: 1 year
- Session: 24 hours

---

## 📝 Default Database Users

After initialization, these users exist:

```
Email                         | Password      | Role
------------------------------|---------------|------------------
admin@starfruit.local         | admin123      | Admin
manager@starfruit.local       | manager123    | Client Manager
developer@starfruit.local     | developer123  | Senior Developer
```

⚠️ **Change all passwords immediately in production!**

---

## 🔧 Configuration Files

### `.env` (Required, create from .env.example)
- Database credentials
- API keys (GitHub, Slack)
- Email credentials
- Secrets (JWT, HMAC)
- Feature flags

### `docker-compose.yml` (Optional)
- MongoDB container
- Redis container (optional)
- App container
- Nginx reverse proxy (optional)

---

## 📚 Documentation Files

| File | Content |
|------|---------|
| `README.md` | Main project overview, features, architecture |
| `SETUP_GUIDE.md` | Step-by-step setup for Replit deployment |
| `PROJECT_MANIFEST.md` | Complete file structure and manifest (this file) |

---

## ✅ Pre-Deployment Checklist

- [ ] Update `package.json` version
- [ ] Review all environment variables
- [ ] Change all default user passwords
- [ ] Generate new JWT_SECRET and HMAC_SECRET
- [ ] Configure GitHub, Slack, email credentials
- [ ] Test all webhook integrations
- [ ] Review CORS settings
- [ ] Set up MongoDB backups
- [ ] Configure monitoring & logging
- [ ] Test health endpoints
- [ ] Run security audit
- [ ] Document any custom changes

---

## 🎓 Learning Resources

- **Express.js**: https://expressjs.com/
- **MongoDB**: https://docs.mongodb.com/
- **Socket.io**: https://socket.io/docs/
- **JWT**: https://jwt.io/
- **GitHub API**: https://docs.github.com/en/rest
- **Slack API**: https://api.slack.com/docs

---

## 📞 Support & Troubleshooting

Consult these files for issues:
1. `README.md` - Feature overview and common tasks
2. `SETUP_GUIDE.md` - Setup troubleshooting
3. `server.js` - Debug middleware/logging
4. `.env.example` - All configuration options

---

## 🎉 You're Ready!

StarFruit Control Room is fully configured and ready for deployment on Replit. Follow the SETUP_GUIDE.md for step-by-step instructions.

**Happy coding! 🚀**

---

*Generated: January 2024*  
*By: Osama Owais*  
*For: Enterprise AI Orchestration*
