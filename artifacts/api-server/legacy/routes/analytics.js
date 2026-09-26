import express from 'express';
import Project from '../models/Project.js';
import Analytics from '../models/Analytics.js';

const router = express.Router();

// Get dashboard metrics
router.get('/dashboard', async (req, res) => {
  try {
    const projects = await Project.find();
    const completedProjects = projects.filter(p => p.status === 'merged');
    const failedProjects = projects.filter(p => p.status === 'rejected');

    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalCost = projects.reduce((sum, p) => sum + (p.actual_cost || 0), 0);

    const metrics = {
      total_projects: projects.length,
      completed_projects: completedProjects.length,
      failed_projects: failedProjects.length,
      success_rate: projects.length > 0 ?
        (completedProjects.length / projects.length * 100).toFixed(2) : 0,

      total_revenue: completedProjects.reduce((sum, p) => sum + (p.budget || 0), 0),
      total_cost: totalCost,
      profit: totalBudget - totalCost,
      profit_margin: totalBudget > 0 ?
        ((totalBudget - totalCost) / totalBudget * 100).toFixed(2) : 0,

      avg_time_to_merge: calculateAverage(
        completedProjects.map(p => p.metrics?.time_to_merge || 0)
      ),

      avg_planning_duration: calculateAverage(
        projects.map(p => p.metrics?.planning_duration || 0)
      ),

      avg_execution_speed: calculateAverage(
        projects.map(p => p.metrics?.execution_speed || 0)
      ),

      avg_code_quality: calculateAverage(
        projects.map(p => p.metrics?.code_quality_score || 0)
      ),

      token_efficiency: calculateTokenEfficiency(projects),

      progress_to_100k: ((completedProjects.reduce((sum, p) => sum + (p.budget || 0), 0) / 100000) * 100).toFixed(2)
    };

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed analytics
router.get('/detailed', async (req, res) => {
  try {
    const { period = 'daily' } = req.query;

    const analytics = await Analytics.findOne({ period })
      .sort({ timestamp: -1 });

    if (!analytics) {
      return res.status(404).json({ error: 'No analytics data found' });
    }

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent performance
router.get('/agents', async (req, res) => {
  try {
    const projects = await Project.find();

    const agentMetrics = {
      claude: {
        tasks_completed: projects.filter(p => p.claude_task?.status === 'completed').length,
        avg_quality_score: calculateAverage(
          projects
            .filter(p => p.claude_task)
            .map(p => p.claude_task.tokens_used || 0)
        ),
        total_tokens: projects.reduce((sum, p) => sum + (p.claude_task?.tokens_used || 0), 0),
        avg_duration: calculateAverage(
          projects
            .filter(p => p.claude_task?.completed_at)
            .map(p => (new Date(p.claude_task.completed_at) - new Date(p.claude_task.assigned_at)) / 1000 / 60)
        )
      },

      replit: {
        tasks_completed: projects.filter(p => p.replit_task?.status === 'completed').length,
        code_quality_avg: calculateAverage(
          projects
            .filter(p => p.replit_task?.code_quality_score)
            .map(p => p.replit_task.code_quality_score)
        ),
        total_tokens: projects.reduce((sum, p) => sum + (p.replit_task?.tokens_used || 0), 0),
        avg_duration: calculateAverage(
          projects
            .filter(p => p.replit_task?.completed_at)
            .map(p => (new Date(p.replit_task.completed_at) - new Date(p.replit_task.assigned_at)) / 1000 / 60)
        )
      },

      gemini: {
        tasks_completed: projects.filter(p => p.gemini_task?.status === 'completed').length,
        findings_count: projects.reduce((sum, p) => sum + (p.gemini_task?.security_findings?.length || 0), 0),
        critical_issues: projects.reduce((sum, p) => sum + (p.gemini_task?.security_findings?.filter(f => f.includes('critical')).length || 0), 0),
        total_tokens: projects.reduce((sum, p) => sum + (p.gemini_task?.tokens_used || 0), 0)
      }
    };

    res.json({
      success: true,
      agentMetrics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project statistics by type
router.get('/by-type', async (req, res) => {
  try {
    const projects = await Project.find();

    const byType = {};
    projects.forEach(p => {
      const type = p.project_type || 'other';
      if (!byType[type]) {
        byType[type] = {
          count: 0,
          completed: 0,
          revenue: 0,
          cost: 0
        };
      }
      byType[type].count++;
      if (p.status === 'merged') byType[type].completed++;
      byType[type].revenue += p.budget || 0;
      byType[type].cost += p.actual_cost || 0;
    });

    res.json({
      success: true,
      byType
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
const calculateAverage = (arr) => {
  const filtered = arr.filter(v => v > 0);
  if (filtered.length === 0) return 0;
  return (filtered.reduce((a, b) => a + b, 0) / filtered.length).toFixed(2);
};

const calculateTokenEfficiency = (projects) => {
  const totalTokens = projects.reduce((sum, p) => sum +
    (p.claude_task?.tokens_used || 0) +
    (p.replit_task?.tokens_used || 0) +
    (p.gemini_task?.tokens_used || 0), 0);

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);

  if (totalTokens === 0 || totalBudget === 0) return 0;

  return ((totalBudget / totalTokens) * 1000).toFixed(2);
};

export default router;
