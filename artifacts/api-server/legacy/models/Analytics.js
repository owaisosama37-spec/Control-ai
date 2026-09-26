import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  metric_id: {
    type: String,
    unique: true,
    required: true,
    index: true
  },

  // Timestamp and period
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  period: {
    type: String,
    enum: ['hourly', 'daily', 'weekly', 'monthly'],
    default: 'daily'
  },

  // Time metrics
  metrics: {
    time_to_merge: {
      avg: Number,
      min: Number,
      max: Number,
      median: Number
    },
    planning_duration: {
      avg: Number,
      min: Number,
      max: Number
    },
    execution_speed: {
      avg: Number,
      min: Number,
      max: Number
    },
    review_time: {
      avg: Number,
      min: Number,
      max: Number
    }
  },

  // Quality metrics
  quality: {
    code_quality_score: Number,
    security_findings_count: Number,
    test_coverage: Number,
    defect_rate: Number
  },

  // Resource metrics
  resources: {
    tokens_consumed: Number,
    tokens_budget: Number,
    token_efficiency: Number,
    cost_per_project: Number,
    profit_margin: Number
  },

  // Project counts
  project_stats: {
    total_created: Number,
    total_completed: Number,
    total_failed: Number,
    total_paused: Number,
    completion_rate: Number,
    success_rate: Number
  },

  // Agent performance
  agent_performance: {
    claude: {
      avg_quality_score: Number,
      completion_rate: Number,
      avg_duration: Number
    },
    replit: {
      avg_quality_score: Number,
      completion_rate: Number,
      avg_duration: Number
    },
    gemini: {
      findings_count: Number,
      severity_breakdown: {
        critical: Number,
        high: Number,
        medium: Number,
        low: Number
      },
      avg_duration: Number
    }
  },

  // System health
  system_health: {
    uptime_percentage: Number,
    failure_rate: Number,
    sla_compliance: Number,
    error_count: Number
  },

  // Financial metrics
  financial: {
    total_revenue: Number,
    total_cost: Number,
    profit: Number,
    projected_revenue: Number,
    progress_to_100k: Number
  },

  // Trend data
  trends: {
    projects_by_type: mongoose.Schema.Types.Mixed,
    revenue_by_client: mongoose.Schema.Types.Mixed,
    common_issues: [String]
  },

  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for time-based queries
analyticsSchema.index({ timestamp: -1, period: 1 });

export default mongoose.model('Analytics', analyticsSchema);
