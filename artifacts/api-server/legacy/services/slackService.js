import { WebClient } from '@slack/web-api';
import Project from '../models/Project.js';
import User from '../models/User.js';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export const sendApprovalRequest = async (project, approver) => {
  try {
    const user = await User.findById(approver);

    if (!user.slack_user_id || !user.slack_workspace_id) {
      console.log(`User ${user.email} has no Slack integration`);
      return null;
    }

    const message = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔍 Project Approval Request'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Project:*\n${project.name}`
            },
            {
              type: 'mrkdwn',
              text: `*Priority:*\n${project.priority}/10`
            },
            {
              type: 'mrkdwn',
              text: `*Budget:*\n$${project.budget}`
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${project.status}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${project.description}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '✅ Approve'
              },
              value: `approve_${project.project_id}`,
              action_id: `approve_${project.project_id}`
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '❌ Reject'
              },
              value: `reject_${project.project_id}`,
              action_id: `reject_${project.project_id}`
            }
          ]
        }
      ]
    };

    const result = await slack.chat.postMessage({
      channel: user.slack_user_id,
      ...message
    });

    return result.ts;
  } catch (error) {
    console.error('Slack approval message error:', error);
    throw error;
  }
};

export const sendProjectStatusUpdate = async (project, channel) => {
  try {
    const statusColor = {
      'draft': '#808080',
      'approved_plan': '#0099ff',
      'awaiting_review': '#ff9900',
      'merged': '#00cc44',
      'rejected': '#ff0000',
      'paused': '#ffcc00'
    };

    const message = {
      attachments: [
        {
          color: statusColor[project.status] || '#808080',
          title: `Project: ${project.name}`,
          text: project.description,
          fields: [
            {
              title: 'Project ID',
              value: project.project_id,
              short: true
            },
            {
              title: 'Status',
              value: project.status.toUpperCase(),
              short: true
            },
            {
              title: 'Priority',
              value: `${project.priority}/10`,
              short: true
            },
            {
              title: 'Budget',
              value: `$${project.budget}`,
              short: true
            },
            {
              title: 'Client',
              value: project.client_name,
              short: true
            },
            {
              title: 'Progress',
              value: getProgressIndicator(project),
              short: true
            }
          ],
          footer: 'StarFruit Control Room',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    await slack.chat.postMessage({
      channel,
      ...message
    });

    return true;
  } catch (error) {
    console.error('Slack update message error:', error);
    throw error;
  }
};

export const sendAgentNotification = async (project, agent, status, channel) => {
  try {
    const agentEmojis = {
      'claude': '🧠',
      'replit': '💻',
      'gemini': '🔒'
    };

    const agentNames = {
      'claude': 'Claude Planning',
      'replit': 'Replit Execution',
      'gemini': 'Gemini Security Review'
    };

    const message = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${agentEmojis[agent]} *${agentNames[agent]}* - ${status.toUpperCase()}\n_Project: ${project.name}_`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Duration:*\n${getAgentDuration(project, agent)}`
            },
            {
              type: 'mrkdwn',
              text: `*Tokens Used:*\n${getAgentTokens(project, agent)}`
            }
          ]
        }
      ]
    };

    await slack.chat.postMessage({
      channel,
      ...message
    });

    return true;
  } catch (error) {
    console.error('Slack agent notification error:', error);
    throw error;
  }
};

export const sendQueueAlert = async (queueLength, channel) => {
  try {
    const urgency = queueLength > 50 ? '🚨' : queueLength > 20 ? '⚠️' : 'ℹ️';

    const message = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${urgency} Queue Status`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Projects in Queue:* ${queueLength}\n${getQueueRecommendation(queueLength)}`
          }
        }
      ]
    };

    await slack.chat.postMessage({
      channel,
      ...message
    });

    return true;
  } catch (error) {
    console.error('Slack queue alert error:', error);
    throw error;
  }
};

// Helper functions
const getProgressIndicator = (project) => {
  const stages = ['draft', 'approved_plan', 'awaiting_review', 'merged'];
  const currentIndex = stages.indexOf(project.status);
  const filled = '█'.repeat(currentIndex + 1);
  const empty = '░'.repeat(stages.length - currentIndex - 1);
  return filled + empty;
};

const getAgentDuration = (project, agent) => {
  const task = project[`${agent}_task`];
  if (!task || !task.assigned_at || !task.completed_at) return 'In Progress';

  const minutes = (new Date(task.completed_at) - new Date(task.assigned_at)) / 1000 / 60;
  return `${Math.round(minutes)} min`;
};

const getAgentTokens = (project, agent) => {
  const task = project[`${agent}_task`];
  return task?.tokens_used ? `${task.tokens_used.toLocaleString()}` : '—';
};

const getQueueRecommendation = (queueLength) => {
  if (queueLength > 50) {
    return '⚠️ _High queue load. Consider increasing processing capacity._';
  } else if (queueLength > 20) {
    return '📊 _Normal queue load. Monitoring._';
  } else {
    return '✅ _Low queue load. All clear._';
  }
};

export default {
  sendApprovalRequest,
  sendProjectStatusUpdate,
  sendAgentNotification,
  sendQueueAlert
};
