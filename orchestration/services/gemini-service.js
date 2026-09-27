import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * GeminiService
 * Handles architecture review and validation via Gemini API
 */
export class GeminiService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Review architecture plan for quality and best practices
   * @param {string} architecturePlan - The architecture plan to review
   * @returns {Promise<Object>} - Review result with feedback and score
   */
  async reviewArchitecture(architecturePlan) {
    console.log(`🔵 Gemini: Reviewing architecture plan...`);
    console.time("gemini_review");

    try {
      const model = this.client.getGenerativeModel({ 
        model: "gemini-1.5-pro",
        systemInstruction: `You are an expert software architect and code reviewer.
Your task is to review architecture plans for:
1. Technical Soundness (0-10 score)
2. Security Best Practices (0-10 score)
3. Scalability & Performance (0-10 score)
4. Implementation Feasibility (0-10 score)
5. Cost Efficiency (0-10 score)

Provide:
- Overall Score (average of above)
- Key Strengths (list 3-5 items)
- Areas for Improvement (list 3-5 items)
- Critical Risks (if any)
- Recommendations (specific, actionable)
- Estimated Implementation Difficulty (Easy/Medium/Hard)

Format your response as structured text with clear sections.`
      });

      const result = await model.generateContent(
        `Please review this architecture plan:\n\n${architecturePlan}`
      );

      console.timeEnd("gemini_review");

      const review = result.response.text();
      const response = {
        success: true,
        review,
        timestamp: new Date().toISOString(),
      };

      console.log(`🟢 Gemini: Architecture review completed`);
      console.log(`   Review tokens used: ${result.response.usageMetadata?.totalTokenCount || 'N/A'}`);

      return response;
    } catch (error) {
      console.log(`🔴 Gemini: Error during review`);
      console.error(`   Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate implementation results against architecture plan
   * @param {string} architecturePlan - The original architecture plan
   * @param {string} implementationResult - The actual implementation details
   * @returns {Promise<Object>} - Validation result with compliance score
   */
  async validateImplementation(architecturePlan, implementationResult) {
    console.log(`🔵 Gemini: Validating implementation against plan...`);
    console.time("gemini_validate");

    try {
      const model = this.client.getGenerativeModel({ 
        model: "gemini-1.5-pro"
      });

      const result = await model.generateContent(
        `Original Architecture Plan:\n${architecturePlan}\n\nActual Implementation:\n${implementationResult}\n\nPlease validate:
1. Does implementation follow the architecture? (percentage)
2. Are all components properly implemented?
3. Are there any deviations or issues?
4. What improvements are recommended?
5. Is it production-ready? (Yes/No/With fixes)

Provide a detailed validation report.`
      );

      console.timeEnd("gemini_validate");

      const validation = result.response.text();
      const response = {
        success: true,
        validation,
        timestamp: new Date().toISOString(),
      };

      console.log(`🟢 Gemini: Implementation validation completed`);

      return response;
    } catch (error) {
      console.log(`🔴 Gemini: Error during validation`);
      console.error(`   Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default GeminiService;