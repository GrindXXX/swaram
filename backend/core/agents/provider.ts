import Anthropic from '@anthropic-ai/sdk';

export interface AgentImage {
  data: Buffer;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export interface JsonGenerationRequest {
  system: string;
  prompt: string;
  images?: readonly AgentImage[];
  maxTokens?: number;
}

/** Inject this in tests to avoid network calls and return controlled JSON. */
export interface JsonProvider {
  readonly model: string;
  generateJson(request: JsonGenerationRequest): Promise<unknown>;
}

export class AnthropicJsonProvider implements JsonProvider {
  readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateJson(request: JsonGenerationRequest): Promise<unknown> {
    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: `${request.prompt}\nReturn only one valid JSON value.` },
      ...(request.images ?? []).map(
        (image): Anthropic.Messages.ImageBlockParam => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mediaType,
            data: image.data.toString('base64'),
          },
        }),
      ),
    ];
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 1_024,
      temperature: 0,
      system: request.system,
      messages: [{ role: 'user', content }],
    });
    const text = message.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return parseJsonValue(text);
  }
}

export function configuredProvider(): JsonProvider | undefined {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new AnthropicJsonProvider(apiKey) : undefined;
}

function parseJsonValue(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const objectStart = trimmed.indexOf('{');
    const arrayStart = trimmed.indexOf('[');
    const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
    const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
    if (start < 0 || end <= start) throw new Error('Provider returned no JSON value');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
