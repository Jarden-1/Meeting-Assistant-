import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { SaveCustomLlmDto } from './dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly ai: AiService,
  ) {}

  async getLlm(userId: string) {
    const custom = await this.prisma.userLlmConfig.findUnique({ where: { userId } });
    const systemBaseUrl = this.config.get<string>('LLM_BASE_URL') ?? '';
    const systemModel = this.config.get<string>('LLM_MODEL') ?? 'gpt-5.5';
    const systemApiKey = this.config.get<string>('LLM_API_KEY') ?? '';

    return {
      provider: 'openai-compatible',
      baseUrlConfigured: Boolean(systemBaseUrl),
      model: systemModel,
      apiKeyConfigured: Boolean(systemApiKey),
      apiKeyVisible: false,
      custom: custom
        ? {
            provider: custom.provider,
            baseUrl: custom.baseUrl,
            model: custom.model,
            apiKeyConfigured: true,
            apiKeyVisible: false,
            updatedAt: custom.updatedAt,
          }
        : {
            provider: 'openai-compatible',
            baseUrl: '',
            model: '',
            apiKeyConfigured: false,
            apiKeyVisible: false,
          },
      activeSource: custom ? 'user' : 'system',
    };
  }

  async saveCustomLlm(userId: string, dto: SaveCustomLlmDto) {
    const config = await this.prisma.userLlmConfig.upsert({
      where: { userId },
      create: {
        userId,
        provider: dto.provider ?? 'openai-compatible',
        baseUrl: dto.baseUrl,
        model: dto.model,
        encryptedApiKey: this.encryption.encrypt(dto.apiKey),
      },
      update: {
        provider: dto.provider ?? 'openai-compatible',
        baseUrl: dto.baseUrl,
        model: dto.model,
        encryptedApiKey: this.encryption.encrypt(dto.apiKey),
      },
    });

    return {
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKeyConfigured: true,
      apiKeyVisible: false,
      updatedAt: config.updatedAt,
    };
  }

  async testLlm(userId: string) {
    return this.ai.testConnection(userId);
  }
}
