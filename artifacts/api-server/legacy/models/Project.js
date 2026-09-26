import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  project_id: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  client_name: String,
  client_email: String,
  status: {
    type: String,
    enum: ['draft', 'approved_plan', 'awaiting_review', 'merged', 'paused', 'rejected'],
    default: 'draft',
    index: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  budget: {
    type: Number,
    default: 0
  },
  actual_cost: {
    type: Number,
    default: 0
  },
  estimated_duration_hours: Number,
  actual_duration_hours: Number,
  project_type: {
    type: String,
    enum: ['whatsapp_bot', 'crm', 'analytics', 'email_campaign', 'ecommerce', 'other'],
    default: 'other'
  },

  // AI Agent assignments
  claude_task: {
    assigned_at: Date,
    completed_at: Date,
    status: String,
    output: String,
    tokens_used: Number
  },

  replit_task: {
    assigned_at: Date,
    completed_at: Date,
    status: String,
    github_pr_url: String,
    tokens_used: Number,
    code_quality_score: Number
  },

  gemini_task: {
    assigned_at: Date,
    completed_at: Date,
    status: String,
    security_findings: [String],
    tokens_used: Number,
    audit_report: String
  },

  // Timeline
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  deadline: Date,

  // Metadata
  tags: [String],
  custom_fields: mongoose.Schema.Types.Mixed,

  // Approval chain
  approvals: [{
    stage: String,
    approved_by: String,
    timestamp: Date,
    signature: String // HMAC-SHA256
  }],

  rejection_reason: String,

  // Performance metrics
  metrics: {
    time_to_merge: Number,
    planning_duration: Number,
    execution_speed: Number,
    review_time: Number,
    code_quality_score: Number,
    security_findings_count: Number,
    test_coverage: Number
  },

  // Deployment info
  deployment: {
    environment: {
      type: String,
      enum: ['dev', 'staging', 'production'],
      default: 'dev'
    },
    deployed_at: Date,
    deployment_status: String,
    rollback_available: Boolean
  }
}, {
  timestamps: true
});

projectSchema.index({ status: 1, priority: -1 });
projectSchema.index({ created_at: -1 });

export default mongoose.model('Project', projectSchema);
