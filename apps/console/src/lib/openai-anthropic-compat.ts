// Temporary compatibility adapter for the existing Maestro pipeline.
// The runtime now uses the OpenAI Responses API while the pipeline is refactored
// away from the former Anthropic-shaped client interface.

import OpenAI from "openai";

export interface OpenAITextBlock {
  type: "text";
  text: string;
}

interface MessageCreateParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user"; content: string }>;
}

interface MessageResponse {
  content: OpenAITextBlock[];
}

class Anthropic {
  private readonly client: OpenAI;

  constructor(options?: { apiKey?: string }) {
    const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    this.client = new OpenAI({ apiKey });
  }

  readonly messages = {
    create: async (params: MessageCreateParams): Promise<MessageResponse> => {
      const configuredModel =
        process.env.OPENAI_MODEL || process.env.MAESTRO_MODEL || params.model || "gpt-5-mini";
      const model = configuredModel.startsWith("claude") ? "gpt-5-mini" : configuredModel;
      const input = params.messages.map((message) => message.content).join("\n\n");

      const response = await this.client.responses.create({
        model,
        instructions: params.system,
        input,
        max_output_tokens: params.max_tokens,
      });

      const text = response.output_text?.trim();
      if (!text) throw new Error("OpenAI returned no text output");
      return { content: [{ type: "text", text }] };
    },
  };
}

namespace Anthropic {
  export type TextBlock = OpenAITextBlock;
}

export default Anthropic;
