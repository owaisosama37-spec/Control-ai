import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new mongoose.Schema({
  user_id: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    index: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true
  },
  password: String,
  full_name: String,

  // Role-based access control
  role: {
    type: String,
    enum: ['admin', 'senior_developer', 'client_manager', 'auditor'],
    default: 'senior_developer'
  },

  // Permissions
  permissions: [{
    type: String,
    enum: [
      'view_projects',
      'create_projects',
      'approve_projects',
      'merge_code',
      'emergency_stop',
      'view_audit_logs',
      'manage_users',
      'configure_settings',
      'execute_rollback',
      'view_analytics'
    ]
  }],

  // Approval limits
  approval_limits: {
    max_daily_amount: Number,
    max_project_value: Number,
    requires_peer_review: Boolean
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },

  // Contact information
  phone: String,
  timezone: {
    type: String,
    default: 'UTC'
  },

  // Preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    notifications_email: {
      type: Boolean,
      default: true
    },
    notifications_slack: {
      type: Boolean,
      default: true
    },
    notifications_push: {
      type: Boolean,
      default: true
    },
    notification_frequency: {
      type: String,
      enum: ['instant', 'daily', 'weekly'],
      default: 'instant'
    }
  },

  // API Keys for integrations
  api_keys: [{
    key: String,
    name: String,
    created_at: Date,
    last_used: Date,
    expires_at: Date
  }],

  // Slack integration
  slack_user_id: String,
  slack_workspace_id: String,

  // Activity tracking
  last_login: Date,
  last_active: Date,
  login_count: {
    type: Number,
    default: 0
  },

  // Account security
  two_factor_enabled: {
    type: Boolean,
    default: false
  },
  two_factor_secret: String,
  backup_codes: [String],

  // Dates
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  deleted_at: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcryptjs.compare(enteredPassword, this.password);
};

// Method to check if user has permission
userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

export default mongoose.model('User', userSchema);
