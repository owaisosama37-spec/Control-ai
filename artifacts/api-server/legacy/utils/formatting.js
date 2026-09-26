import { format, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';

// Currency formatting
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

// Date formatting
export const formatDate = (date, dateFormat = 'MM/dd/yyyy') => {
  return format(new Date(date), dateFormat);
};

export const formatDateTime = (date) => {
  return format(new Date(date), 'MM/dd/yyyy HH:mm:ss');
};

export const formatRelativeTime = (date) => {
  const now = new Date();
  const targetDate = new Date(date);

  const minutesDiff = differenceInMinutes(now, targetDate);
  if (minutesDiff < 1) return 'Just now';
  if (minutesDiff < 60) return `${minutesDiff}m ago`;

  const hoursDiff = differenceInHours(now, targetDate);
  if (hoursDiff < 24) return `${hoursDiff}h ago`;

  const daysDiff = differenceInDays(now, targetDate);
  if (daysDiff < 7) return `${daysDiff}d ago`;

  return formatDate(targetDate);
};

// Duration formatting
export const formatDuration = (minutes) => {
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) return `${hours}h`;
  return `${hours}h ${Math.round(mins)}m`;
};

export const formatDurationSeconds = (seconds) => {
  const minutes = seconds / 60;
  return formatDuration(minutes);
};

// Project status formatting
export const formatProjectStatus = (status) => {
  const statusMap = {
    'draft': '📝 Draft',
    'approved_plan': '✅ Approved',
    'awaiting_review': '👀 In Review',
    'merged': '🎉 Merged',
    'rejected': '❌ Rejected',
    'paused': '⏸️ Paused'
  };

  return statusMap[status] || status;
};

export const getStatusColor = (status) => {
  const colorMap = {
    'draft': '#808080',
    'approved_plan': '#0099ff',
    'awaiting_review': '#ff9900',
    'merged': '#00cc44',
    'rejected': '#ff0000',
    'paused': '#ffcc00'
  };

  return colorMap[status] || '#808080';
};

// Agent formatting
export const formatAgentName = (agent) => {
  const agentMap = {
    'claude': '🧠 Claude',
    'replit': '💻 Replit',
    'gemini': '🔒 Gemini'
  };

  return agentMap[agent] || agent;
};

// Tokens formatting
export const formatTokens = (tokens) => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};

// Percentage formatting
export const formatPercentage = (value, decimals = 1) => {
  return `${parseFloat(value).toFixed(decimals)}%`;
};

// Priority formatting
export const formatPriority = (priority) => {
  if (priority >= 9) return '🔴 Critical';
  if (priority >= 7) return '🟠 High';
  if (priority >= 4) return '🟡 Medium';
  return '🟢 Low';
};

// Code quality formatting
export const formatCodeQuality = (score) => {
  if (score >= 90) return '⭐⭐⭐⭐⭐ Excellent';
  if (score >= 80) return '⭐⭐⭐⭐ Very Good';
  if (score >= 70) return '⭐⭐⭐ Good';
  if (score >= 60) return '⭐⭐ Fair';
  return '⭐ Needs Work';
};

// Project type formatting
export const formatProjectType = (type) => {
  const typeMap = {
    'whatsapp_bot': '💬 WhatsApp Bot',
    'crm': '📊 CRM',
    'analytics': '📈 Analytics',
    'email_campaign': '📧 Email Campaign',
    'ecommerce': '🛒 E-Commerce',
    'other': '📦 Other'
  };

  return typeMap[type] || type;
};

// Queue status formatting
export const formatQueueStatus = (queueLength) => {
  if (queueLength > 50) return '🚨 Critical';
  if (queueLength > 20) return '⚠️ High';
  if (queueLength > 5) return '📊 Moderate';
  return '✅ Clear';
};

// Health status formatting
export const formatHealthStatus = (uptime) => {
  if (uptime >= 99.5) return '✅ Excellent';
  if (uptime >= 99) return '🟡 Good';
  if (uptime >= 95) return '⚠️ Fair';
  return '🔴 Poor';
};

// JSON formatting
export const formatJSON = (obj, indent = 2) => {
  return JSON.stringify(obj, null, indent);
};

// Slug formatting
export const formatSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Summary text formatting
export const formatSummary = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export default {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  formatDurationSeconds,
  formatProjectStatus,
  getStatusColor,
  formatAgentName,
  formatTokens,
  formatPercentage,
  formatPriority,
  formatCodeQuality,
  formatProjectType,
  formatQueueStatus,
  formatHealthStatus,
  formatJSON,
  formatSlug,
  formatSummary
};
