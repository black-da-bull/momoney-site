// Temporary compatibility adapter for existing Maestro call sites.
// Backed entirely by the OpenAI JavaScript SDK. This preserves the historical
// client.messages.create()/stream() shape while provider-specific routes are
// migrated incrementally.

import OpenAI from "openai";

export interface OpenAITextBlock {
  type: "text";
  text: string;
}

type MessageRole = "user" | "assistant";

interface MessageCreateParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: MessageRole; content: string }>;
}

interface MessageResponse {
  content: OpenAITextBlock[];
}

interface MessageStream {
  on(event: "text", handler: (text: string) => void): MessageStream;
  finalMessage(): Promise<MessageResponse>;
}

function resolveModel(requested?: string): string {
  const configured = process.env.OPENAI_MODEL || process.env.MAESTRO_MODEL || requested || "gpt-5-mini";
  return configured.toLowerCase().startsWith("claude") ? "gpt-5-mini" : configured;
}

function completionMessages(params: MessageCreateParams) {
  return [
    { role: "developer" as const, content: params.system },
    ...params.messages.map((message) => ({ role: message.role, content: message.content })),
  ];
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
      const response = await this.client.chat.completions.create({
        model: resolveModel(params.model),
        messages: completionMessages(params),
        max_completion_tokens: params.max_tokens,
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) throw new Error("OpenAI returned no text output");
      return { content: [{ type: "text", text }] };
    },

    stream: (params: MessageCreateParams): MessageStream => {
      const handlers = new Set<(text: string) => void>();
      let finalPromise: Promise<MessageResponse> | null = null;

      const run = async (): Promise<MessageResponse> => {
        const stream = await this.client.chat.completions.create({
          model: resolveModel(params.model),
          messages: completionMessages(params),
          max_completion_tokens: params.max_tokens,
          stream: true,
        });

        let text = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (!delta) continue;
          text += delta;
          for (const handler of handlers) handler(delta);
        }
        return { content: [{ type: "text", text }] };
      };

      const api: MessageStream = {
        on(event, handler) {
          if (event === "text") handlers.add(handler);
          return api;
        },
        finalMessage() {
          finalPromise ??= run();
          return finalPromise;
        },
      };
      return api;
    },
  };
}

namespace Anthropic {
  export type TextBlock = OpenAITextBlock;
}

export default Anthropic;
