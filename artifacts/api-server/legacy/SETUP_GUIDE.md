# 🚀 StarFruit Control Room - Setup Guide for Replit

This guide will help you get StarFruit Control Room up and running on Replit.

## Step 1: Create Replit Project

1. Go to [Replit.com](https://replit.com)
2. Click "Create" → "Import from GitHub"
3. Or create a new Node.js project and upload all files

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Configure Environment Variables

1. Create a `.env` file in the root directory
2. Copy content from `.env.example`
3. Fill in your credentials:

```bash
# Critical Settings (Must Change!)
JWT_SECRET=<generate-random-secret>
HMAC_SECRET=<generate-random-secret>

# Database (Use Replit Database or MongoDB Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/starfruit-control-room

# GitHub Integration
GITHUB_TOKEN=<your-github-token>
GITHUB_WEBHOOK_SECRET=<webhook-secret>

# Slack Integration
SLACK_BOT_TOKEN=xoxb-<your-slack-bot-token>
SLACK_SIGNING_SECRET=<slack-secret>

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email@gmail.com>
SMTP_PASSWORD=<app-specific-password>

# Dashboard URL
DASHBOARD_URL=https://<your-replit-url>
```

## Step 4: Initialize Database

### Option A: Using MongoDB Atlas (Recommended)

1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free tier cluster
3. Get connection string: `mongodb+srv://...`
4. Add to `.env` as `MONGODB_URI`

### Option B: Using Replit Database

```bash
# Replit includes a built-in database
# You can use it if configured, or use MongoDB Atlas for better features
```

### Run Initialization Script

```bash
npm run db:init
```

This will:
- Create all necessary MongoDB indexes
- Set up default admin user (admin@starfruit.local)
- Create manager and developer users
- Configure audit log retention

## Step 5: Generate API Keys & Secrets

### GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`, `admin:repo_hook`
4. Copy token to `GITHUB_TOKEN` in `.env`

### Slack Bot Token

1. Go to [Slack Apps](https://api.slack.com/apps)
2. Create New App → From scratch
3. Name: "StarFruit Control Room"
4. Workspace: Select your workspace
5. Under "OAuth & Permissions":
   - Add scopes: `chat:write`, `commands`, `users:read`
   - Install to workspace
   - Copy Bot Token to `SLACK_BOT_TOKEN`
6. Under "Signing Secret" → Copy to `SLACK_SIGNING_SECRET`

### Email Setup (Gmail)

1. Enable 2-Factor Authentication on Google account
2. Create App Password at [Google Account Security](https://myaccount.google.com/apppasswords)
3. Use App Password as `SMTP_PASSWORD`

## Step 6: Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on:
- **Local**: `http://localhost:3000`
- **Replit**: `https://<your-replit>.repl.co`

## Step 7: Test Default Login

Access the application and login with:

**Default Admin User:**
- Email: `admin@starfruit.local`
- Password: `admin123`

⚠️ **Change password immediately after first login!**

## Step 8: Configure Webhooks

### GitHub Webhook

1. Go to your GitHub repository
2. Settings → Webhooks → Add webhook
3. Payload URL: `https://<your-replit>.repl.co/api/webhooks/github`
4. Content type: `application/json`
5. Secret: `GITHUB_WEBHOOK_SECRET` from `.env`
6. Events: Select "Pull requests"
7. Click "Add webhook"

### Slack Slash Command

1. Go to your Slack App settings
2. Features → Slash Commands → Create New Command
3. Command: `/approve`
4. Request URL: `https://<your-replit>.repl.co/api/webhooks/slack`
5. Short Description: "Approve project"
6. Click "Save"

## Step 9: Verify Installation

```bash
# Check health endpoint
curl https://<your-replit>.repl.co/health

# Should return:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Step 10: Create Your First Project

### Via API (Using curl or Postman):

```bash
curl -X POST https://<your-replit>.repl.co/api/projects \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Service WhatsApp Bot",
    "description": "24/7 automated customer support",
    "client_name": "Luxury Hotels Group",
    "budget": 15000,
    "project_type": "whatsapp_bot",
    "priority": 9
  }'
```

## Troubleshooting

### Connection Issues

**Error**: `connect ECONNREFUSED 127.0.0.1:27017`
- Solution: Ensure `MONGODB_URI` points to MongoDB Atlas, not localhost

**Error**: `404 Not Found`
- Solution: Verify Replit URL and webhook paths are correct

### Authentication Issues

**Error**: `Invalid token`
- Solution: Generate new JWT token by logging in again

**Error**: `HMAC signature verification failed`
- Solution: Ensure `HMAC_SECRET` matches on sender and receiver

### Email Issues

**Error**: `SMTP connection failed`
- Solution: Check SMTP credentials and enable "Less secure app access" if needed

### Database Issues

**Error**: `MongoAuthError`
- Solution: Verify username and password in MongoDB URI

**Error**: `No projects in queue`
- Solution: Create a project first with POST `/api/projects`

## Performance Optimization

### For Production on Replit:

1. Set `NODE_ENV=production` in `.env`
2. Enable compression: Already included
3. Set appropriate rate limits: Default is 100 req/15min
4. Monitor token usage with `/api/analytics/dashboard`
5. Keep logs clean: Set `LOG_LEVEL=warn`

## Security Checklist

- [ ] Changed all default user passwords
- [ ] Generated new JWT_SECRET and HMAC_SECRET
- [ ] Configured GitHub, Slack, and email credentials
- [ ] Set DASHBOARD_URL to your Replit domain
- [ ] Enabled HTTPS (automatic on Replit)
- [ ] Tested webhook signature verification
- [ ] Reviewed API rate limiting settings
- [ ] Set up database backups

## Useful Commands

```bash
# Start development server with auto-reload
npm run dev

# Initialize/reset database
npm run db:init

# View logs
npm run logs

# Check health status
npm run health

# Test webhook signature verification
npm run test:webhooks
```

## API Documentation

Full API documentation available at: `/api/docs` (when available)

Quick endpoints:
- `GET /api/system/status` - System status
- `GET /api/projects` - List projects
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/audit` - Audit logs (admin only)

## Support & Questions

For issues or questions:
1. Check logs: `npm run logs`
2. Review README.md for detailed documentation
3. Check `.env.example` for all available settings
4. Verify webhook configurations

---

**Ready to go!** 🚀 Your StarFruit Control Room is now operational!
