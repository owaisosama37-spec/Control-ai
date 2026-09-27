export const integrationIds = ["claude", "gemini", "github", "slack", "email"] as const;
export type IntegrationId = (typeof integrationIds)[number];

type Definition = { required: string[]; anyOf?: string[][] };

// Alternative groups are OR'd; variables within a group are AND'd.
export const integrations: Record<IntegrationId, Definition> = {
  claude: { required: [], anyOf: [
    ["AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
    ["ANTHROPIC_API_KEY"],
  ] },
  gemini: { required: [], anyOf: [
    ["AI_INTEGRATIONS_GEMINI_BASE_URL", "AI_INTEGRATIONS_GEMINI_API_KEY"],
    ["GEMINI_API_KEY"],
  ] },
  github: { required: ["GITHUB_WEBHOOK_SECRET", "GITHUB_REPO"] },
  slack: { required: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET", "SLACK_APPROVALS_CHANNEL"] },
  email: { required: ["EMAIL_FROM"], anyOf: [
    ["RESEND_CONNECTOR_ENABLED"],
    ["RESEND_API_KEY"],
    ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
  ] },
};

const present = (name: string) => name === "RESEND_CONNECTOR_ENABLED"
  ? process.env.RESEND_CONNECTOR_ENABLED === "true"
  : Boolean(process.env[name]?.trim());

export function getIntegrationConfiguration(id: IntegrationId) {
  const definition = integrations[id];
  const missing = definition.required.filter(name => !present(name));
  const hasAlternative = !definition.anyOf || definition.anyOf.some(group => group.every(present));
  return {
    id,
    configured: missing.length === 0 && hasAlternative,
    missing,
    alternatives: hasAlternative ? [] : definition.anyOf!.map(group => group.filter(name => !present(name))),
  };
}

export function isConfigured(id: IntegrationId): boolean {
  return getIntegrationConfiguration(id).configured;
}

export function integrationAdminConfigured(): boolean {
  return /^user_[a-zA-Z0-9]+$/.test(process.env.INTEGRATIONS_ADMIN_USER_ID?.trim() ?? "");
}

export function isIntegrationAdmin(userId: string | null | undefined): boolean {
  return Boolean(userId) && integrationAdminConfigured() &&
    userId === process.env.INTEGRATIONS_ADMIN_USER_ID?.trim();
}