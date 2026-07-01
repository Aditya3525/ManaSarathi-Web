import axios from 'axios';
import { BaseAIProvider } from './BaseAIProvider';
import { AIMessage, AIResponse, AIConfig, ConversationContext, AIProviderConfig } from '../../types/ai';

type NvidiaChoice = {
  message?: {
    content?: string;
  };
  finish_reason?: string;
};

type NvidiaChatCompletionResponse = {
  id?: string;
  model?: string;
  choices?: NvidiaChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export class NvidiaProvider extends BaseAIProvider {
  private readonly endpoint: string;

  constructor(config: AIProviderConfig) {
    super('NVIDIA', config);
    this.endpoint = config.baseURL?.trim() || 'https://integrate.api.nvidia.com/v1/chat/completions';
  }

  async isAvailable(): Promise<boolean> {
    const hasKeys = this.getAllApiKeys().length > 0;
    if (!hasKeys) return false;
    return this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.tryWithKeyRotation(async (apiKey: string) => {
        await axios.post(
          this.endpoint,
          {
            model: this.config.model || 'meta/llama3-70b-instruct',
            messages: [{ role: 'user', content: 'Reply with OK' }],
            max_tokens: 8,
            temperature: 0
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            timeout: 7000
          }
        );
        return true;
      }, 1);

      return true;
    } catch (error: any) {
      console.error('[NVIDIA] Connection test failed:', error?.response?.data || error?.message || error);
      return false;
    }
  }

  async generateResponse(
    messages: AIMessage[],
    config?: AIConfig,
    context?: ConversationContext
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const preparedMessages = this.prepareMessages(messages, context);

    return this.tryWithKeyRotation(async (apiKey: string) => {
      try {
        const response = await axios.post<NvidiaChatCompletionResponse>(
          this.endpoint,
          {
            model: config?.model || this.config.model || 'moonshotai/kimi-k2.5',
            messages: preparedMessages,
            max_tokens: config?.maxTokens || this.config.maxTokens || 600,
            temperature: config?.temperature ?? this.config.temperature ?? 0.6,
            top_p: 1,
            stream: false,
            chat_template_kwargs: {
              thinking: true
            }
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            timeout: config?.timeout || this.config.timeout || 30000
          }
        );

        const data = response.data;
        const firstChoice = data.choices?.[0];
        const content = firstChoice?.message?.content?.trim() || '';

        const processingTime = Date.now() - startTime;

        return {
          content,
          usage: {
            prompt_tokens: data.usage?.prompt_tokens || 0,
            completion_tokens: data.usage?.completion_tokens || 0,
            total_tokens: data.usage?.total_tokens || 0
          },
          model: data.model || (config?.model || this.config.model),
          provider: this.name,
          finish_reason: firstChoice?.finish_reason || 'stop',
          success: true,
          processingTime,
          apiKeyUsed: this.currentApiKeyIndex
        };
      } catch (error: any) {
        const statusCode = error?.response?.status;

        if (statusCode === 401) {
          const authError = new Error('Invalid NVIDIA API key');
          (authError as any).statusCode = 401;
          throw authError;
        }

        if (statusCode === 402) {
          const quotaError = new Error('NVIDIA quota exceeded');
          (quotaError as any).statusCode = 402;
          throw quotaError;
        }

        if (statusCode === 429) {
          const rateError = new Error('NVIDIA rate limit exceeded');
          (rateError as any).statusCode = 429;
          throw rateError;
        }

        const wrapped = new Error(`NVIDIA API error: ${error?.message || 'Unknown error'}`);
        (wrapped as any).statusCode = statusCode || 500;
        throw wrapped;
      }
    });
  }
}
