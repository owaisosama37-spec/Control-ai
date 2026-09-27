import Anthropic from "@anthropic-ai/sdk";

/**
 * ClaudeService
 * Handles architecture design requests via Claude API
 */
export class ClaudeService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error("Claude API key is required");
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Design architecture for a given requirement
   * @param {string} requirement - The requirement description
   * @returns {Promise<Object>} - Design plan with architecture details
   */
  async designArchitecture(requirement) {
    console.log(`🔵 Claude: Designing architecture for requirement...`);
    console.time("claude_design");

    try {
      const message = await this.client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: `You are an expert software architect specializing in enterprise systems.
Your task is to design a comprehensive, production-ready architecture.

Provide a detailed design with:
1. System Architecture (components, layers, communication flow)
2. Technology Stack (languages, frameworks, databases, tools)
3. Data Model (entities, relationships, schema)
4. Implementation Steps (sequence of actions)
5. Security Considerations (authentication, authorization, encryption)
6. Scalability Plan (how to handle growth)
7. Deployment Strategy (environments, CI/CD)
8. Potential Risks & Mitigation strategies
9. Estimated Timeline (in days)
10. Resource Requirements (team, infrastructure)

Format your response as structured text with clear sections.`,
        messages: [
          {
            role: "user",
            content: `Please design a complete architecture for this requirement:\n\n${requirement}`,
          },
        ],
      });

      console.timeEnd("claude_design");

      const plan = message.content[0].text;
      const response = {
        success: true,
        plan,
        tokens_used: message.usage.output_tokens,
        input_tokens: message.usage.input_tokens,
        timestamp: new Date().toISOString(),
      };

      console.log(`🟢 Claude: Architecture design completed`);
      console.log(`   Tokens used: ${message.usage.output_tokens}`);

      return response;
    } catch (error) {
      console.log(`🔴 Claude: Error during design`);
      console.error(`   Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Review and improve a design plan
   * @param {string} currentPlan - The current architecture plan
   * @param {string} feedback - Feedback for improvement
   * @returns {Promise<Object>} - Improved design plan
   */
  async improveDesign(currentPlan, feedback) {
    console.log(`🔵 Claude: Improving architecture based on feedback...`);
    console.time("claude_improve");

    try {
      const message = await this.client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: `You are an expert software architect.
Your task is to improve an existing architecture design based on feedback.
Keep what's good, improve what's mentioned in the feedback.
Provide the improved design with the same structure as before.`,
        messages: [
          {
            role: "user",
            content: `Current Architecture:\n${currentPlan}\n\nFeedback for improvement:\n${feedback}\n\nPlease provide an improved architecture addressing the feedback.`,
          },
        ],
      });

      console.timeEnd("claude_improve");

      const improvedPlan = message.content[0].text;
      const response = {
        success: true,
        plan: improvedPlan,
        tokens_used: message.usage.output_tokens,
        timestamp: new Date().toISOString(),
      };

      console.log(`🟢 Claude: Architecture improvement completed`);

      return response;
    } catch (error) {
      console.log(`🔴 Claude: Error during improvement`);
      console.error(`   Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default ClaudeService;
