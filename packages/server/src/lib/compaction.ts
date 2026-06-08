import { generateText, type LanguageModel } from "ai"
import { db } from "@papercode/database"

const CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export function shouldCompact(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  contextWindow: number,
  threshold = 0.70,
): { needed: boolean; usage: number; totalTokens: number } {
  const systemTokens = estimateTokens(systemPrompt)
  const messageTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  const totalTokens = systemTokens + messageTokens
  const usage = totalTokens / contextWindow
  return { needed: usage >= threshold, usage, totalTokens }
}

export function selectMessagesForCompaction(
  messages: { id: string; role: string; content: string; createdAt: Date }[],
  preserveLastExchanges = 3,
): {
  toCompact: typeof messages
  toPreserve: typeof messages
} {
  // Walk backwards from the end, counting user-assistant exchange pairs
  let preserveStartIndex = messages.length
  let exchanges = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "USER") {
      exchanges++
      if (exchanges >= preserveLastExchanges) {
        preserveStartIndex = i
        break
      }
    }
  }

  // Ensure we compact at least something
  if (preserveStartIndex <= 1) {
    return { toCompact: [], toPreserve: messages }
  }

  return {
    toCompact: messages.slice(0, preserveStartIndex),
    toPreserve: messages.slice(preserveStartIndex),
  }
}

const COMPACTION_SYSTEM_PROMPT = `You are a conversation summarizer. Your task is to condense a conversation between a user and an AI coding assistant into a structured summary that preserves all essential context.

The summary MUST preserve:
- Key decisions made and their rationale
- Files that were created, modified, or deleted
- The current state of the task/project
- Important constraints or requirements the user mentioned
- Tool call outcomes that changed project state (file writes, edits, shell commands)
- Any errors encountered and how they were resolved

The summary should be concise but complete enough that the conversation can continue naturally without re-asking questions. Format the summary as clear, structured prose. Do NOT use bullet points excessively — write it as flowing context.

Begin your summary with "[CONTEXT SUMMARY]" and keep it under 2000 tokens.`

export function buildCompactionPrompt(
  messages: { role: string; content: string }[],
): string {
  const transcript = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n---\n\n")

  return `Summarize the following conversation between a user and an AI coding assistant. Preserve all information needed to continue the conversation naturally.\n\n${transcript}`
}

type CompactParams = {
  sessionId: string
  messages: { id: string; role: string; content: string; createdAt: Date }[]
  model: LanguageModel
  modelId: string
  systemPrompt: string
  contextWindow: number
  force?: boolean
  onStart?: (messageCount: number, reason: string) => void
  onDone?: (summaryPreview: string, tokensSaved: number) => void
}

type CompactResult = {
  compactedHistory: { role: "user" | "assistant"; content: string }[]
  record: {
    summary: string
    originalMessageIds: string[]
    tokensBefore: number
    tokensAfter: number
  }
}

export async function compactMessages(params: CompactParams): Promise<CompactResult> {
  const { sessionId, messages, model, modelId, systemPrompt, contextWindow, force, onStart, onDone } = params

  const check = force
    ? null
    : shouldCompact(
        messages.map((m) => ({ role: m.role, content: m.content })),
        systemPrompt,
        contextWindow,
      )

  const { toCompact, toPreserve } = selectMessagesForCompaction(messages)

  if (toCompact.length === 0) {
    // Nothing to compact — return original history
    const totalTokens = check?.totalTokens ?? estimateTokens(systemPrompt) + messages.reduce((s, m) => s + estimateTokens(m.content), 0)
    return {
      compactedHistory: messages
        .filter((m) => m.role !== "ERROR")
        .map((m) => ({
          role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
      record: {
        summary: "",
        originalMessageIds: [],
        tokensBefore: totalTokens,
        tokensAfter: totalTokens,
      },
    }
  }

  const reason = force ? "Manual compaction" : `Context usage at ${Math.round(check!.usage * 100)}%`
  onStart?.(toCompact.length, reason)

  // Generate summary using the LLM
  const prompt = buildCompactionPrompt(toCompact)
  const result = await generateText({
    model,
    system: COMPACTION_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 4000,
  })

  const summary = result.text

  // Build compacted history: summary as assistant message + preserved messages
  const compactedHistory: { role: "user" | "assistant"; content: string }[] = [
    { role: "assistant", content: summary },
    ...toPreserve
      .filter((m) => m.role !== "ERROR")
      .filter((m) => !(m.role === "ASSISTANT" && m.content.length === 0))
      .map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
  ]

  const tokensBefore = check?.totalTokens ?? estimateTokens(systemPrompt) + messages.reduce((s, m) => s + estimateTokens(m.content), 0)
  const tokensAfter =
    estimateTokens(systemPrompt) +
    compactedHistory.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  const tokensSaved = Math.max(0, tokensBefore - tokensAfter)

  // Persist compaction record
  await db.compactionRecord.create({
    data: {
      sessionId,
      summary,
      originalMessageIds: toCompact.map((m) => m.id),
      tokensBeforeCompaction: tokensBefore,
      tokensAfterCompaction: tokensAfter,
      model: modelId,
    },
  })

  // Mark original messages as compacted
  await db.message.updateMany({
    where: { id: { in: toCompact.map((m) => m.id) } },
    data: { compactedAt: new Date() },
  })

  const summaryPreview = summary.slice(0, 100) + (summary.length > 100 ? "..." : "")
  onDone?.(summaryPreview, tokensSaved)

  return {
    compactedHistory,
    record: {
      summary,
      originalMessageIds: toCompact.map((m) => m.id),
      tokensBefore,
      tokensAfter,
    },
  }
}
