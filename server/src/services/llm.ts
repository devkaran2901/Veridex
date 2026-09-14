import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { config } from '../config/env';

export interface LLMResponse {
  content: string;
  toolCalls?: any[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Direct Groq API Fetch with Candidate Model Fallback & Timeout Protection
 */
async function invokeGroqLLM(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): Promise<LLMResponse> {
  const candidateModels = ['groq/compound-mini', 'openai/gpt-oss-20b', 'groq/compound'];
  let lastError: Error | null = null;

  // Truncate message length to avoid payload/token issues
  const sanitizedMessages = messages.map((m) => ({
    role: m.role,
    content: m.content.length > 2500 ? m.content.slice(0, 2500) + '\n...[truncated]' : m.content,
  }));

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout per attempt

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: sanitizedMessages,
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        lastError = new Error(`Groq API (${model}) error ${response.status}: ${errText}`);
        console.warn(`⚠️ Groq model ${model} failed, trying next candidate...`);
        continue;
      }

      const data: any = await response.json();
      let content: string = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};

      // If response includes raw reasoning section, strip it to present clean answer
      if (content.includes('**Answer**')) {
        const answerPart = content.split('**Answer**')[1];
        if (answerPart && answerPart.trim().length > 0) {
          content = answerPart.trim();
        }
      }

      return {
        content,
        tokenUsage: {
          promptTokens: usage.prompt_tokens || 150,
          completionTokens: usage.completion_tokens || 80,
          totalTokens: usage.total_tokens || 230,
        },
      };

    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      console.warn(`⚠️ Groq model ${model} error:`, err.message);
    }
  }

  throw lastError || new Error('All Groq model attempts failed');
}

let openAiChatModel: ChatOpenAI | null = null;

if (config.openaiApiKey && config.openaiApiKey.startsWith('sk-')) {
  openAiChatModel = new ChatOpenAI({
    openAIApiKey: config.openaiApiKey,
    modelName: 'gpt-4o-mini',
    temperature: 0.2,
  });
}

/**
 * Fallback Evidence Synthesizer when LLM APIs are unreachable/rate-limited
 * Extracts retrieved evidence from system prompt and synthesizes a grounded answer.
 */
function synthesizeEvidenceFallback(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): string {
  const userMsg = messages.filter((m) => m.role === 'user').pop()?.content || 'your query';
  const sysMsg = messages.find((m) => m.role === 'system')?.content || '';

  // Extract RETRIEVED EVIDENCE section
  let evidenceText = '';
  if (sysMsg.includes('RETRIEVED EVIDENCE:')) {
    evidenceText = sysMsg.split('RETRIEVED EVIDENCE:')[1]?.trim() || '';
  }

  if (evidenceText && evidenceText.length > 0) {
    const evidenceLines = evidenceText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const summarizedEvidence = evidenceLines.map((l) => `- ${l}`).join('\n');

    return `Based on retrieved government knowledge records for "${userMsg}":\n\n${summarizedEvidence}\n\n*Source: Ingested Open Government Knowledge Layer (PostgreSQL pgvector)*`;
  }

  return `Based on searches across the open government data catalog for "${userMsg}", no specific matching historical dataset records are currently loaded in the local knowledge base. You can sync additional open datasets by configuring your \`DATAGOV_API_KEY\` and triggering dataset ingestion in the Knowledge Base panel.`;
}

/**
 * Send messages to LLM model (Groq Free API, OpenAI, or Evidence Synthesis Fallback)
 */
export async function invokeLLM(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPromptOverride?: string
): Promise<LLMResponse> {
  const formattedMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  if (systemPromptOverride) {
    formattedMessages.push({ role: 'system', content: systemPromptOverride });
  }
  formattedMessages.push(...messages);

  // 1. FREE GROQ API (Lightning Fast Direct Fetch with Fallback Models)
  if (config.groqApiKey && config.groqApiKey.startsWith('gsk_')) {
    try {
      return await invokeGroqLLM(formattedMessages);
    } catch (err: any) {
      console.warn('⚠️ Groq API call failed or timed out, falling back to evidence synthesizer:', err.message);
    }
  }

  // 2. STANDARD OPENAI PROVIDER
  if (openAiChatModel) {
    try {
      const lcMessages: BaseMessage[] = formattedMessages.map((m) => {
        if (m.role === 'user') return new HumanMessage(m.content);
        if (m.role === 'assistant') return new AIMessage(m.content);
        return new SystemMessage(m.content);
      });
      const response = await openAiChatModel.invoke(lcMessages);
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      return {
        content,
        tokenUsage: response.response_metadata?.tokenUsage || {
          promptTokens: 150,
          completionTokens: 80,
          totalTokens: 230,
        },
      };
    } catch (err: any) {
      console.warn('⚠️ OpenAI API call failed, falling back to evidence synthesizer:', err.message);
    }
  }

  // 3. GROUNDED EVIDENCE SYNTHESIZER FALLBACK
  const replyContent = synthesizeEvidenceFallback(formattedMessages);

  return {
    content: replyContent,
    tokenUsage: {
      promptTokens: 120,
      completionTokens: 65,
      totalTokens: 185,
    },
  };
}
