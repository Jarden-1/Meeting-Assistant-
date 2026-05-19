import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../security/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

type LlmConfig = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  source: 'user' | 'system';
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async assistantAsk(userId: string, context: unknown): Promise<{ answer: string; mode: string; sources: unknown[] }> {
    const systemPrompt = [
      '你是当前会议中的 AI 同事，不是只整理纪要的秘书。',
      '你可以积极参与讨论、总结、追问、提出替代方案、识别风险。',
      '你不能替团队做最终决定，也不能把建议说成已确认事实。',
      '事实类问题优先基于当前会议和同议题历史上下文。',
      '头脑风暴类问题可以使用通用知识，但要说明这是建议。',
      '回答要简洁：先直接回答，再给 2-4 个要点，必要时补一个追问。',
      '只在用户提问时回应，不要假装自己主动发言或已经被会议成员采纳。',
      '如果问题需要会议事实，优先使用 transcriptText；如果前端实时快照和保存转写重复，以实时快照为准。',
      'sources 只返回轻量来源标签数组，可选值：current_transcript、preparation、history_actions、history_decisions、history_risks、history_questions、assistant_history、general_knowledge。',
    ].join('\n');

    const fallback = {
      answer:
        '我现在还没有可用的模型配置，所以先给出兜底建议：请先确认本次讨论的目标、已确认事实、分歧点和下一步负责人。配置 LLM 后，我可以基于会议内容更自然地参与讨论。',
      mode: 'fallback',
      sources: [],
    };

    const result = await this.callJson(userId, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `请基于以下会议上下文回答用户问题，并返回严格 JSON：{"answer": string, "mode": string, "sources": string[]}。sources 只能使用系统提示中列出的轻量来源标签；不要返回 Markdown。\n\n${JSON.stringify(context).slice(0, 24000)}`,
      },
    ]);

    if (!result) return fallback;
    return {
      answer: this.stringValue(result.answer) || fallback.answer,
      mode: this.stringValue(result.mode) || 'discussion_help',
      sources: Array.isArray(result.sources) ? result.sources : [],
    };
  }

  async generateReportDraft(userId: string, context: unknown) {
    const systemPrompt = [
      '你是标准会议纪要结构化助手，风格参考腾讯会议和飞书会议的 AI 会议纪要。',
      '你只生成候选草稿，不能把候选说成正式记录。',
      '请基于当前会议内容、会前快照和同议题历史生成标准会议纪要，不要生成项目战报、营销总结或泛泛建议。',
      '会议纪要必须以真实会议转写为依据；没有明确讨论或确认的内容不能写成已决事项。',
      '请输出严格 JSON。',
      '不要输出 Markdown，不要输出 HTML。',
      'summary.content 应为 3-5 句话的会议摘要。',
      'discussionChains 用作“议题纪要”：每项包含 topic、facts、opinions、disagreements、decision、openQuestions、sourceText。',
      'decisions 只放明确达成一致或确认的关键结论；actionItems 只放可执行待办。',
      'ownerText 和 dueDate 可以为空；缺失时把提醒放入 warnings。',
      '每条关键结论、待办、风险、问题和议题尽量带 sourceText，摘取对应原文依据。',
    ].join('\n');

    const fallback = this.fallbackReport(context);
    const result = await this.callJson(userId, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `请生成标准会议纪要草稿，结构必须包含 summary、memorySummary、decisions、actionItems、risks、openQuestions、progressUpdates、carryInItems、discussionChains、warnings。\n\n字段要求：
- summary: {"title":"会议摘要","content":string}
- discussionChains: 议题纪要数组，每项包含 topic、facts、opinions、disagreements、decision、openQuestions、nextActions、sourceText
- decisions: 关键结论数组，每项包含 content、rationale、sourceText
- actionItems: 待办数组，每项包含 description、ownerText、dueDate、priority、riskLevel、importance、urgency、sourceText
- risks: 风险与问题数组，每项包含 content、level、status、sourceText
- openQuestions: 遗留问题数组，每项包含 content、status、sourceText
- carryInItems: 会后跟进建议或下次带入项数组，每项包含 type、content、status
- warnings: 信息缺失、负责人/截止时间不确定、来源不足等提醒

上下文：${JSON.stringify(context).slice(0, 28000)}`,
      },
    ]);

    return this.normalizeReport(result ?? fallback);
  }

  async generateDiscussionChains(userId: string, context: unknown) {
    const systemPrompt = [
      '你是会议讨论链路整理助手。',
      '你的任务不是写普通摘要，而是解释讨论如何形成结论。',
      '请输出严格 JSON，结构必须包含 discussionChains 和 warnings。',
      '如果某个议题没有结论，把未解决部分放进 openQuestions 或 warnings。',
    ].join('\n');

    const fallback = {
      discussionChains: [
        {
          topic: '待用户确认的会议议题',
          facts: [],
          opinions: [],
          disagreements: [],
          decision: '',
          openQuestions: ['当前未配置模型，讨论链路需要用户手动补充。'],
          nextActions: [],
          sourceText: '',
        },
      ],
      warnings: ['当前未配置可用模型，讨论链路为兜底结果。'],
    };

    const result = await this.callJson(userId, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `请抽取讨论链路，返回 JSON：{"discussionChains":[...],"warnings":[...]}\n\n上下文：${JSON.stringify(context).slice(0, 24000)}`,
      },
    ]);

    return {
      discussionChains: this.arrayValue(result?.discussionChains ?? fallback.discussionChains),
      warnings: this.arrayValue(result?.warnings ?? fallback.warnings),
    };
  }

  async testConnection(userId: string): Promise<{ ok: boolean; model: string; latencyMs: number; source: string; message?: string }> {
    const startedAt = Date.now();
    const llmConfig = await this.resolveConfig(userId);
    if (!llmConfig?.apiKey || !llmConfig.baseUrl) {
      return {
        ok: false,
        model: llmConfig?.model ?? this.config.get<string>('LLM_MODEL') ?? '',
        latencyMs: Date.now() - startedAt,
        source: llmConfig?.source ?? 'system',
        message: 'LLM is not configured',
      };
    }

    try {
      await this.callChatCompletion(llmConfig, [{ role: 'user', content: 'ping' }], false);
      return {
        ok: true,
        model: llmConfig.model,
        latencyMs: Date.now() - startedAt,
        source: llmConfig.source,
      };
    } catch (error) {
      return {
        ok: false,
        model: llmConfig.model,
        latencyMs: Date.now() - startedAt,
        source: llmConfig.source,
        message: error instanceof Error ? error.message : 'LLM test failed',
      };
    }
  }

  async resolveConfig(userId: string): Promise<LlmConfig | null> {
    const custom = await this.prisma.userLlmConfig.findUnique({ where: { userId } });
    if (custom) {
      return {
        provider: custom.provider,
        baseUrl: custom.baseUrl,
        model: custom.model,
        apiKey: this.encryption.decrypt(custom.encryptedApiKey),
        source: 'user',
      };
    }

    return {
      provider: 'openai-compatible',
      baseUrl: this.config.get<string>('LLM_BASE_URL') ?? '',
      model: this.config.get<string>('LLM_MODEL') ?? 'gpt-5.5',
      apiKey: this.config.get<string>('LLM_API_KEY') ?? '',
      source: 'system',
    };
  }

  private async callJson(userId: string, messages: ChatMessage[]): Promise<Record<string, unknown> | null> {
    const llmConfig = await this.resolveConfig(userId);
    if (!llmConfig?.apiKey || !llmConfig.baseUrl) return null;

    try {
      const content = await this.callChatCompletion(llmConfig, messages, true);
      return this.parseJson(content);
    } catch {
      return null;
    }
  }

  private async callChatCompletion(llmConfig: LlmConfig, messages: ChatMessage[], jsonMode: boolean): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75000);
    const response = await fetch(`${llmConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      throw new Error(`LLM request failed with ${response.status}`);
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? '';
  }

  private parseJson(content: string): Record<string, unknown> | null {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
          return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private normalizeReport(raw: Record<string, unknown>) {
    return {
      summary:
        typeof raw.summary === 'object' && raw.summary
          ? raw.summary
          : { title: '会议摘要', content: this.stringValue(raw.summary) },
      memorySummary: this.stringValue(raw.memorySummary),
      decisions: this.arrayValue(raw.decisions),
      actionItems: this.arrayValue(raw.actionItems),
      risks: this.arrayValue(raw.risks),
      openQuestions: this.arrayValue(raw.openQuestions),
      progressUpdates: this.arrayValue(raw.progressUpdates),
      carryInItems: this.arrayValue(raw.carryInItems),
      discussionChains: this.arrayValue(raw.discussionChains),
      warnings: this.arrayValue(raw.warnings),
    };
  }

  private fallbackReport(context: unknown): Record<string, unknown> {
    const text = JSON.stringify(context).slice(0, 600);
    return {
      summary: {
        title: '会议摘要',
        content: '模型尚未配置，系统已生成一份可编辑的兜底草稿。请补充会议结论、待办和下次带入项。',
      },
      memorySummary: text ? `本次会议待用户确认。上下文摘要：${text}` : '本次会议待用户确认。',
      decisions: [],
      actionItems: [],
      risks: [],
      openQuestions: [],
      progressUpdates: [],
      carryInItems: [],
      discussionChains: [],
      warnings: ['当前未配置可用模型，报告草稿为规则兜底结果。'],
    };
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
}
