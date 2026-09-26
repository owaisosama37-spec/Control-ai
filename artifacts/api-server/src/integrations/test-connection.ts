import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { clerkClient } from "@clerk/express";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import type { IntegrationId } from "./registry";

type TestResult = { ok: boolean; message: string };

async function testClaude(): Promise<TestResult> {
  const proxyKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY?.trim();
  const proxyBase = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL?.trim();
  const useProxy = Boolean(proxyKey && proxyBase);
  const client = new Anthropic({
    apiKey: useProxy ? proxyKey! : process.env.ANTHROPIC_API_KEY!.trim(),
    ...(useProxy ? { baseURL: proxyBase } : {}),
    timeout: 15_000,
    maxRetries: 0,
  });
  if (!useProxy) {
    const models = await client.models.list({ limit: 1 });
    if (!models.data.length) return { ok: false, message: "Claude responded, but no models are available." };
  } else {
    // Replit's AI proxy supports messages, not the provider's models.list endpoint.
    const message = await client.messages.create({
      model: process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: "Reply with OK." }],
    });
    if (!message.content.some(block => block.type === "text")) {
      return { ok: false, message: "Claude responded without text." };
    }
  }
  return { ok: true, message: "Claude connection verified." };
}

async function testGemini(): Promise<TestResult> {
  const proxyKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  const proxyBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();
  const useProxy = Boolean(proxyKey && proxyBase);
  const client = new GoogleGenAI({
    apiKey: useProxy ? proxyKey! : process.env.GEMINI_API_KEY!.trim(),
    httpOptions: { ...(useProxy ? { baseUrl: proxyBase } : {}), timeout: 15_000 },
  });
  // generateContent is supported by both the direct provider and Replit's AI proxy.
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: "Reply with OK." }] }],
    config: { maxOutputTokens: 8192 },
  });
  return response.text
    ? { ok: true, message: "Gemini connection verified." }
    : { ok: false, message: "Gemini responded without text." };
}

async function testGitHub(): Promise<TestResult> {
  const repo = process.env.GITHUB_REPO!.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || repo.includes("..")) {
    return { ok: false, message: "GITHUB_REPO must be in owner/repository format." };
  }
  const [owner, name] = repo.split("/");
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN!.trim()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Starfruit-Control-Room",
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  return response.ok
    ? { ok: true, message: "GitHub repository access verified." }
    : { ok: false, message: "GitHub could not access the configured repository. Check the token and repository permissions." };
}

async function testSlack(): Promise<TestResult> {
  const response = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN!.trim()}` },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) return { ok: false, message: "Slack authentication failed. Check the bot token." };
  const body = await response.json() as { ok?: boolean };
  return body.ok
    ? { ok: true, message: "Slack bot authentication verified." }
    : { ok: false, message: "Slack authentication failed. Check the bot token." };
}

async function testEmail(adminId: string): Promise<TestResult> {
  const user = await clerkClient.users.getUser(adminId);
  const email = user.emailAddresses.find(address =>
    address.id === user.primaryEmailAddressId && address.verification?.status === "verified",
  )?.emailAddress;
  if (!email) return { ok: false, message: "The administrator needs a verified primary email address in Clerk." };
  const from = process.env.EMAIL_FROM!.trim();
  const mail = {
    from,
    to: email,
    subject: "Starfruit connection test",
    text: "This is the connection test you requested from Starfruit Control Room.",
  };
  if (process.env.RESEND_API_KEY?.trim()) {
    const { error } = await new Resend(process.env.RESEND_API_KEY.trim()).emails.send(mail);
    if (error) return { ok: false, message: "The email provider did not accept the test message. Check the sender and provider settings." };
  } else {
    const port = Number(process.env.SMTP_PORT?.trim() || "587");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { ok: false, message: "SMTP_PORT must be a valid port number." };
    }
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER!.trim(), pass: process.env.SMTP_PASS!.trim() },
      connectionTimeout: 15_000,
    });
    try {
      await transport.sendMail(mail);
    } finally {
      transport.close();
    }
  }
  return { ok: true, message: "Test email sent to your verified primary email address." };
}

export async function testIntegrationConnection(id: IntegrationId, adminId: string): Promise<TestResult> {
  switch (id) {
    case "claude": return testClaude();
    case "gemini": return testGemini();
    case "github": return testGitHub();
    case "slack": return testSlack();
    case "email": return testEmail(adminId);
  }
}