import { HfInference } from "@huggingface/inference";
import { BaseAIProvider } from './BaseAIProvider';
import { AIMessage, AIResponse, AIConfig, ConversationContext, AIProviderConfig } from '../../types/ai';

export class HuggingFaceProvider extends BaseAIProvider {
  private hf: HfInference;
  private model: string = 'meta-llama/Llama-3.1-8B-Instruct';

  constructor(config: AIProviderConfig) {
    super('huggingface', config);
    const apiKey = this.getCurrentApiKey() || '';
    
    if (!apiKey) {
      throw new Error('HuggingFace API key is required');
    }

    this.hf = new HfInference(apiKey);
    if (config.model?.trim()) {
      this.model = config.model.trim();
    }
  }

  async generateResponse(
    messages: AIMessage[], 
    config?: AIConfig, 
    context?: ConversationContext
  ): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🤗 HuggingFace: Generating response with ${this.model}`);
      
      // Format messages for chat completion, preserving the rich system prompt
      const chatMessages = this.formatMessagesForChat(messages, context);
      
      const response = await this.hf.chatCompletion({
        model: this.model,
        messages: chatMessages,
        max_tokens: config?.maxTokens || 500,
        temperature: config?.temperature || 0.7,
      });

      const content = response.choices[0]?.message?.content || '';
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`✅ HuggingFace: Response generated in ${processingTime}ms`);

      return {
        content: content.trim(),
        provider: 'huggingface',
        model: this.model,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        },
        processingTime,
        finish_reason: response.choices[0]?.finish_reason || 'stop',
        success: true,
        apiKeyUsed: this.currentApiKeyIndex
      };

    } catch (error: any) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      const message = error?.message || 'Unknown error occurred';
      console.error('❌ HuggingFace Error:', message);

      const normalizedMessage = message.toLowerCase();
      const shouldRotateKey =
        normalizedMessage.includes('rate limit') ||
        normalizedMessage.includes('quota') ||
        normalizedMessage.includes('invalid username or password') ||
        normalizedMessage.includes('unauthorized') ||
        normalizedMessage.includes('forbidden') ||
        normalizedMessage.includes('401');

      if (shouldRotateKey) {
        this.rotateApiKey();
      }

      const enrichedError = new Error(`HuggingFace provider error: ${message}`);
      (enrichedError as any).processingTime = processingTime;
      throw enrichedError;
    }
  }

  private formatMessagesForChat(
    messages: AIMessage[],
    context?: ConversationContext
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    // Use the rich system prompt from chatService if it exists in messages[0],
    // otherwise fall back to the base provider's context-aware prompt,
    // and only use the hardcoded generic prompt as a last resort.
    let systemContent: string;
    let conversationMessages = messages;

    if (messages.length > 0 && messages[0].role === 'system') {
      systemContent = messages[0].content;
      conversationMessages = messages.slice(1);
    } else if (context) {
      systemContent = this.createSystemPrompt(context);
    } else {
      systemContent =
        'You are ManaSarathi, a supportive and empathetic mental health companion. ' +
        'Provide helpful, non-diagnostic guidance. Be compassionate, professional, ' +
        'and encourage seeking professional help when appropriate.';
    }

    const systemMessage = {
      role: 'system' as const,
      content: systemContent
    };

    const formattedMessages = conversationMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    return [systemMessage, ...formattedMessages];
  }

  async testConnection(): Promise<boolean> {
    try {
      const apiKey = this.getCurrentApiKey();
      if (!apiKey) return false;

      // Simple test with minimal tokens
      await this.hf.chatCompletion({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });
      
      return true;
    } catch (error: any) {
      console.error('❌ HuggingFace connection test failed:', error?.message || error);
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = this.getCurrentApiKey();
    if (!apiKey) {
      return false;
    }

    return this.testConnection();
  }

  getProviderName(): string {
    return 'huggingface';
  }

  getModelName(): string {
    return this.model;
  }
}
