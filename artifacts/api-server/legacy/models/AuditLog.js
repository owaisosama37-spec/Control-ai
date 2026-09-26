import mongoose from 'mongoose';
import crypto from 'crypto';

const auditLogSchema = new mongoose.Schema({
  log_id: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'project_created',
      'project_approved',
      'project_rejected',
      'task_assigned',
      'task_completed',
      'status_changed',
      'approval_signed',
      'emergency_stop',
      'mode_changed',
      'settings_updated',
      'code_merged',
      'security_scan_completed'
    ]
  },

  // Actor information
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actor_type: {
    type: String,
    enum: ['human', 'claude', 'replit', 'gemini'],
    default: 'human'
  },

  // Target information
  target_type: {
    type: String,
    enum: ['project', 'task', 'user', 'system']
  },
  target_id: String,

  // Action details
  details: {
    old_value: mongoose.Schema.Types.Mixed,
    new_value: mongoose.Schema.Types.Mixed,
    change_reason: String,
    metadata: mongoose.Schema.Types.Mixed
  },

  // Signature & Verification
  signature: {
    type: String,
    required: true // HMAC-SHA256
  },
  timestamp_signed: {
    type: Date,
    default: Date.now,
    immutable: true
  },

  // Immutability
  immutable: {
    type: Boolean,
    default: true,
    immutable: true
  },

  // Status tracking
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed'],
    default: 'completed'
  },

  // IP & Session info
  ip_address: String,
  session_id: String,
  user_agent: String,

  // Approval reference
  requires_approval: Boolean,
  approved_by: mongoose.Schema.Types.ObjectId,
  approval_timestamp: Date,

  created_at: {
    type: Date,
    default: Date.now,
    index: true,
    immutable: true
  }
}, {
  timestamps: false // Disable auto timestamps since we have our own
});

// Index for querying
auditLogSchema.index({ action: 1, created_at: -1 });
auditLogSchema.index({ actor: 1, created_at: -1 });
auditLogSchema.index({ target_type: 1, target_id: 1 });

// Virtual for verification
auditLogSchema.virtual('is_verified').get(function() {
  const data = JSON.stringify({
    action: this.action,
    actor: this.actor,
    target_id: this.target_id,
    details: this.details,
    timestamp_signed: this.timestamp_signed
  });

  const expectedSignature = crypto
    .createHmac('sha256', process.env.AUDIT_SECRET || 'secret')
    .update(data)
    .digest('hex');

  return this.signature === expectedSignature;
});

export default mongoose.model('AuditLog', auditLogSchema);
