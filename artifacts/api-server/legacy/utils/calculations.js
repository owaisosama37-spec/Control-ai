// Financial calculations
export const calculateProfit = (budget, actualCost) => {
  return budget - actualCost;
};

export const calculateProfitMargin = (budget, actualCost) => {
  if (budget === 0) return 0;
  return ((budget - actualCost) / budget * 100).toFixed(2);
};

export const calculateTokenEfficiency = (totalBudget, totalTokens) => {
  if (totalTokens === 0 || totalBudget === 0) return 0;
  return ((totalBudget / totalTokens) * 1000).toFixed(2);
};

export const calculateProjectCost = (claudeTokens, replitTokens, geminiTokens, tokenPricing = {}) => {
  const prices = {
    claude: tokenPricing.claude || 0.003,
    replit: tokenPricing.replit || 0.002,
    gemini: tokenPricing.gemini || 0.0005,
    ...tokenPricing
  };

  const claudeCost = claudeTokens * prices.claude;
  const replitCost = replitTokens * prices.replit;
  const geminiCost = geminiTokens * prices.gemini;

  return {
    claude: claudeCost,
    replit: replitCost,
    gemini: geminiCost,
    total: claudeCost + replitCost + geminiCost
  };
};

// Performance calculations
export const calculateAverageDuration = (projects, field) => {
  const validProjects = projects.filter(p => p.metrics?.[field] > 0);
  if (validProjects.length === 0) return 0;

  const total = validProjects.reduce((sum, p) => sum + p.metrics[field], 0);
  return (total / validProjects.length).toFixed(2);
};

export const calculateSuccessRate = (projects) => {
  if (projects.length === 0) return 0;
  const successful = projects.filter(p => p.status === 'merged').length;
  return ((successful / projects.length) * 100).toFixed(2);
};

export const calculateCompletionRate = (projects) => {
  const completed = projects.filter(p => p.status === 'merged').length;
  const total = projects.filter(p => p.status !== 'draft').length;
  if (total === 0) return 0;
  return ((completed / total) * 100).toFixed(2);
};

// Queue calculations
export const calculateEstimatedQueueTime = (queueLength, avgTimePerProject = 30) => {
  return queueLength * avgTimePerProject;
};

export const calculateQueuePriority = (project, queuePosition) => {
  const priorityWeight = project.priority / 10;
  const positionWeight = (1 / (queuePosition + 1));
  const budgetWeight = Math.min(project.budget / 100000, 1);

  return (priorityWeight * 0.5 + positionWeight * 0.3 + budgetWeight * 0.2) * 100;
};

// Token calculations
export const estimateTokensRequired = (projectType, complexity = 'medium') => {
  const baseTokens = {
    whatsapp_bot: 5000,
    crm: 15000,
    analytics: 12000,
    email_campaign: 8000,
    ecommerce: 20000,
    other: 10000
  };

  const complexityMultiplier = {
    simple: 0.5,
    medium: 1,
    complex: 2,
    very_complex: 3
  };

  const base = baseTokens[projectType] || baseTokens.other;
  const multiplier = complexityMultiplier[complexity] || 1;

  return Math.round(base * multiplier);
};

export const distributeTokens = (totalTokens, distribution = {}) => {
  const default_distribution = {
    claude: 0.4,
    replit: 0.35,
    gemini: 0.25
  };

  const dist = { ...default_distribution, ...distribution };

  return {
    claude: Math.round(totalTokens * dist.claude),
    replit: Math.round(totalTokens * dist.replit),
    gemini: Math.round(totalTokens * dist.gemini)
  };
};

// Progress calculations
export const calculateProgressTo100k = (completedProjects) => {
  const totalRevenue = completedProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  return ((totalRevenue / 100000) * 100).toFixed(2);
};

export const projectionsTo100k = (projects, currentRevenue = 0) => {
  const avgProjectValue = projects.length > 0
    ? projects.reduce((sum, p) => sum + (p.budget || 0), 0) / projects.length
    : 50000;

  const completed = projects.filter(p => p.status === 'merged').length;
  const completionRate = projects.length > 0 ? completed / projects.length : 0;

  const projectsNeeded = Math.ceil((100000 - currentRevenue) / avgProjectValue);
  const daysToComplete = projectsNeeded / (completionRate * 30);

  return {
    projects_needed: projectsNeeded,
    estimated_days: Math.round(daysToComplete),
    avg_project_value: avgProjectValue.toFixed(2),
    current_revenue: currentRevenue
  };
};

export default {
  calculateProfit,
  calculateProfitMargin,
  calculateTokenEfficiency,
  calculateProjectCost,
  calculateAverageDuration,
  calculateSuccessRate,
  calculateCompletionRate,
  calculateEstimatedQueueTime,
  calculateQueuePriority,
  estimateTokensRequired,
  distributeTokens,
  calculateProgressTo100k,
  projectionsTo100k
};
