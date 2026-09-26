import nodemailer from 'nodemailer';
import Project from '../models/Project.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

export const sendApprovalEmail = async (project, approverEmail, approverName) => {
  try {
    const approvalLink = `${process.env.DASHBOARD_URL}/projects/${project.project_id}/approve`;

    const htmlContent = `
      <h2>Project Approval Request</h2>
      <p>Hello ${approverName},</p>
      <p>A new project requires your approval:</p>

      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Project:</strong> ${project.name}</p>
        <p><strong>Client:</strong> ${project.client_name}</p>
        <p><strong>Budget:</strong> $${project.budget}</p>
        <p><strong>Priority:</strong> ${project.priority}/10</p>
        <p><strong>Description:</strong> ${project.description}</p>
      </div>

      <p>
        <a href="${approvalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Review & Approve
        </a>
      </p>

      <p style="color: #666; font-size: 12px;">
        StarFruit Control Room | Osama Owais | Kuwait
      </p>
    `;

    const textContent = `
Project Approval Request

Hello ${approverName},

A new project requires your approval:

Project: ${project.name}
Client: ${project.client_name}
Budget: $${project.budget}
Priority: ${project.priority}/10
Description: ${project.description}

Review & Approve: ${approvalLink}

StarFruit Control Room | Osama Owais | Kuwait
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@starfruit.local',
      to: approverEmail,
      subject: `[APPROVAL] ${project.name} - Priority ${project.priority}`,
      text: textContent,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result.messageId;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

export const sendProjectStatusEmail = async (project, recipientEmail, recipientName) => {
  try {
    const projectLink = `${process.env.DASHBOARD_URL}/projects/${project.project_id}`;

    const statusColor = {
      'draft': '#808080',
      'approved_plan': '#0099ff',
      'awaiting_review': '#ff9900',
      'merged': '#00cc44',
      'rejected': '#ff0000',
      'paused': '#ffcc00'
    };

    const htmlContent = `
      <h2>Project Status Update</h2>
      <p>Hello ${recipientName},</p>
      <p>Project <strong>${project.name}</strong> has been updated:</p>

      <div style="background-color: ${statusColor[project.status]}; color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p style="font-size: 18px; margin: 0;"><strong>${project.status.toUpperCase()}</strong></p>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px;"><strong>Project ID:</strong></td>
          <td style="padding: 10px;">${project.project_id}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px;"><strong>Client:</strong></td>
          <td style="padding: 10px;">${project.client_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px;"><strong>Budget:</strong></td>
          <td style="padding: 10px;">$${project.budget}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px;"><strong>Actual Cost:</strong></td>
          <td style="padding: 10px;">$${project.actual_cost || 0}</td>
        </tr>
      </table>

      <p>
        <a href="${projectLink}" style="background-color: #0099ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">
          View Project
        </a>
      </p>

      <p style="color: #666; font-size: 12px;">
        StarFruit Control Room | Osama Owais | Kuwait
      </p>
    `;

    const textContent = `
Project Status Update

Hello ${recipientName},

Project ${project.name} has been updated:

Status: ${project.status.toUpperCase()}
Project ID: ${project.project_id}
Client: ${project.client_name}
Budget: $${project.budget}
Actual Cost: $${project.actual_cost || 0}

View Project: ${projectLink}

StarFruit Control Room | Osama Owais | Kuwait
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@starfruit.local',
      to: recipientEmail,
      subject: `[UPDATE] ${project.name} - Status: ${project.status.toUpperCase()}`,
      text: textContent,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result.messageId;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

export const sendQueueSummaryEmail = async (projects, recipientEmail, recipientName) => {
  try {
    const byStatus = {
      draft: projects.filter(p => p.status === 'draft').length,
      approved_plan: projects.filter(p => p.status === 'approved_plan').length,
      awaiting_review: projects.filter(p => p.status === 'awaiting_review').length,
      merged: projects.filter(p => p.status === 'merged').length,
      rejected: projects.filter(p => p.status === 'rejected').length
    };

    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalCost = projects.reduce((sum, p) => sum + (p.actual_cost || 0), 0);

    const projectRows = projects.slice(0, 10).map(p => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${p.project_id}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${p.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${p.status}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">$${p.budget}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <h2>Daily Queue Summary</h2>
      <p>Hello ${recipientName},</p>
      <p>Here's your daily project queue summary:</p>

      <h3>Queue Status</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background-color: #f5f5f5;">
          <td style="padding: 10px;"><strong>Draft:</strong> ${byStatus.draft}</td>
          <td style="padding: 10px;"><strong>Approved:</strong> ${byStatus.approved_plan}</td>
          <td style="padding: 10px;"><strong>In Review:</strong> ${byStatus.awaiting_review}</td>
          <td style="padding: 10px;"><strong>Merged:</strong> ${byStatus.merged}</td>
        </tr>
      </table>

      <h3>Financial Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px;"><strong>Total Budget:</strong></td>
          <td style="padding: 10px;">$${totalBudget.toLocaleString()}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px;"><strong>Total Cost:</strong></td>
          <td style="padding: 10px;">$${totalCost.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 10px;"><strong>Profit:</strong></td>
          <td style="padding: 10px;">$${(totalBudget - totalCost).toLocaleString()}</td>
        </tr>
      </table>

      <h3>Recent Projects</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 10px; text-align: left;">ID</th>
          <th style="padding: 10px; text-align: left;">Name</th>
          <th style="padding: 10px; text-align: left;">Status</th>
          <th style="padding: 10px; text-align: left;">Budget</th>
        </tr>
        ${projectRows}
      </table>

      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        StarFruit Control Room | Osama Owais | Kuwait
      </p>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@starfruit.local',
      to: recipientEmail,
      subject: `[DAILY SUMMARY] StarFruit Queue - ${new Date().toLocaleDateString()}`,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result.messageId;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

export const sendErrorNotification = async (error, context, recipientEmail) => {
  try {
    const htmlContent = `
      <h2>⚠️ System Error Alert</h2>
      <p>An error occurred in StarFruit Control Room:</p>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800; margin: 20px 0;">
        <p><strong>Error:</strong> ${error.message}</p>
        <p><strong>Context:</strong> ${context}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      </div>

      <p>Please investigate and take appropriate action.</p>

      <p style="color: #666; font-size: 12px;">
        StarFruit Control Room | Automated Alert
      </p>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@starfruit.local',
      to: recipientEmail,
      subject: `[ERROR] StarFruit System Alert`,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result.messageId;
  } catch (error) {
    console.error('Error notification email send error:', error);
    throw error;
  }
};

export default {
  sendApprovalEmail,
  sendProjectStatusEmail,
  sendQueueSummaryEmail,
  sendErrorNotification
};
