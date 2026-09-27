# StarFruit Control Room - Orchestration Setup Guide

## Phase 2: Claude & Gemini API Integration

### File Structure
```
orchestration/
├── .env
├── package.json
├── services/
│   ├── claude-service.js
│   └── gemini-service.js
├── server.js (existing)
├── routes.js (existing)
└── ... (other existing files)
```

### Step 1: Create Files in Replit

#### 1.1 Create `.env` file
**Location:** `orchestration/.env`
**Content:** See `.env` file provided

**Important:** Replace placeholders:
- `CLAUDE_API_KEY=sk-ant-v0-xxxxx` → Your actual Claude API key
- `GEMINI_API_KEY=AIzaSy-xxxxx` → Your actual Gemini API key

#### 1.2 Update `package.json`
**Location:** `orchestration/package.json`
**Content:** See `package.json` file provided

Key additions:
- `"@anthropic-ai/sdk": "^0.24.0"`
- `"@google/generative-ai": "^0.11.0"`

#### 1.3 Create `services/claude-service.js`
**Location:** `orchestration/services/claude-service.js`
**Content:** See `claude-service.js` file provided

This service handles:
- Architecture design via Claude API
- Design improvement based on feedback

#### 1.4 Create `services/gemini-service.js`
**Location:** `orchestration/services/gemini-service.js`
**Content:** See `gemini-service.js` file provided

This service handles:
- Architecture review and validation
- Implementation validation against architecture

### Step 2: Install Dependencies

In Replit Terminal:
```bash
cd orchestration
npm install
```

### Step 3: Test the Setup

In Replit Terminal:
```bash
npm start
```

Expected output:
```
🔵 Claude: Ready for architecture design
🔵 Gemini: Ready for architecture review
```

### Step 4: API Key Management

**⚠️ SECURITY WARNING:**
- Never commit `.env` file to GitHub
- Never share API keys in conversation or comments
- Store API keys only in Replit Secrets

To use Replit Secrets:
1. Go to Replit project Settings
2. Click "Secrets" tab
3. Add secrets:
   - `CLAUDE_API_KEY`: Your Claude API key
   - `GEMINI_API_KEY`: Your Gemini API key

### Integration Points

The services integrate with the existing orchestration system:

1. **Claude Flow:** Requirement → Claude designs architecture
2. **Gemini Flow:** Architecture plan → Gemini reviews for quality
3. **Full Cycle:** Design → Review → Improvement → Validation

### Method Signatures

#### ClaudeService
```javascript
// Design new architecture
await claudeService.designArchitecture(requirement: string)
// Returns: { success, plan, tokens_used, timestamp }

// Improve existing design
await claudeService.improveDesign(currentPlan: string, feedback: string)
// Returns: { success, plan, tokens_used, timestamp }
```

#### GeminiService
```javascript
// Review architecture plan
await geminiService.reviewArchitecture(architecturePlan: string)
// Returns: { success, review, timestamp }

// Validate implementation
await geminiService.validateImplementation(architecturePlan: string, implementationResult: string)
// Returns: { success, validation, timestamp }
```

### Next Steps

After setup:
1. ✅ Test Claude service with sample requirement
2. ✅ Test Gemini service with sample architecture
3. ✅ Integrate with existing routes.js
4. ✅ Set up Replit API integration (Phase 2 Week 3)
5. ✅ Complete end-to-end testing

### Troubleshooting

**Issue:** "API key is required"
- **Solution:** Check `.env` file has correct keys or Replit Secrets are configured

**Issue:** Module not found
- **Solution:** Run `npm install` after updating `package.json`

**Issue:** Connection timeout
- **Solution:** Check internet connection and API key validity

### Files Provided

1. `.env` - Environment configuration
2. `package.json` - NPM dependencies
3. `claude-service.js` - Claude API integration
4. `gemini-service.js` - Gemini API integration
5. `SETUP_INSTRUCTIONS.md` - This file

---

**Last Updated:** 2026-09-27
**Phase:** 2 - AI Integration
**Status:** Ready for deployment
