import { db, MessageStatus, Mode } from "@papercode/database";
import z from "zod";
import { streamText as aiStreamText, stepCountIs } from "ai";
import { isSupportedChatModel, resolveChatModel, type ProviderCredentials } from "../lib/models";
import { buildTools } from "../lib/tools";
import { loadSystemPrompt } from "../lib/system-prompt";
import { shouldCompact, compactMessages } from "../lib/compaction";
import { zValidator } from "@hono/zod-validator";
import { streamSSE } from "hono/streaming";
import { getModelContextWindow, type ChatStreamEvent } from "@papercode/shared";
import { Hono } from "hono";
import { isAbsolute } from "node:path";

const MAX_STEPS        = 20
const MAX_TOKENS       = 16_000
const STREAM_TIMEOUT_MS = 120_000

const submitSchema = z.object({
  content: z.string(),
  mode: z.enum(Mode),
  model: z.string().refine(isSupportedChatModel, "Unsupported Model"),
  cwd: z.string().optional(),
})

const submitValidator = zValidator("json", submitSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid Input" }, 400);
  }
})

function buildConversationHistory(
  messages: { role: "USER" | "ASSISTANT" | "ERROR"; content: string; status: MessageStatus }[]
) {
  return messages.flatMap((m) => {
    if (m.role === "ERROR") return []
    if (m.role === "ASSISTANT" && m.content.length === 0) return []
    return [{ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content }]
  })
}

type StoredToolCall = {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  result?: string
  isError?: boolean
}

type StreamParams = {
  sessionId: string;
  mode: Mode;
  model: string;
  history: { role: "user" | "assistant"; content: string }[]
  dbMessages: { id: string; role: string; content: string; createdAt: Date }[]
  abortController: AbortController;
  credentials?: ProviderCredentials;
  cwd: string;
  contextWindow: number;
}

async function streamAIResponse(
  stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
  params: StreamParams,
) {
  const { sessionId, mode, model, history, dbMessages, abortController, credentials, cwd, contextWindow } = params;
  const startTime = Date.now();
  const resolvedModel = resolveChatModel(model, credentials)
  const tools = buildTools(cwd, mode)
  const systemPrompt = loadSystemPrompt(cwd)
  let fullText = ""
  const toolCallParts: StoredToolCall[] = []

  const timeoutId = setTimeout(() => abortController.abort(), STREAM_TIMEOUT_MS)

  try {
    // Check if compaction is needed before sending to LLM
    const compactionCheck = shouldCompact(history, systemPrompt, contextWindow)
    let activeHistory = history

    if (compactionCheck.needed && dbMessages.length > 0) {
      const startEvent: ChatStreamEvent = {
        type: "compaction-start",
        messageCount: dbMessages.length,
        reason: `Context usage at ${Math.round(compactionCheck.usage * 100)}%`,
      }
      await stream.writeSSE({ event: "compaction-start", data: JSON.stringify(startEvent) })

      const compactionResult = await compactMessages({
        sessionId,
        messages: dbMessages,
        model: resolvedModel.model,
        modelId: model,
        systemPrompt,
        contextWindow,
      })

      activeHistory = compactionResult.compactedHistory
      const tokensSaved = Math.max(0, compactionResult.record.tokensBefore - compactionResult.record.tokensAfter)
      const summaryPreview = compactionResult.record.summary.slice(0, 100) + (compactionResult.record.summary.length > 100 ? "..." : "")

      const doneCompactEvent: ChatStreamEvent = {
        type: "compaction-done",
        summaryPreview,
        tokensSaved,
      }
      await stream.writeSSE({ event: "compaction-done", data: JSON.stringify(doneCompactEvent) })
    }

    const result = aiStreamText({
      model: resolvedModel.model,
      system: systemPrompt,
      messages: activeHistory,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      maxOutputTokens: MAX_TOKENS,
      abortSignal: abortController.signal,
    })

    for await (const part of result.fullStream) {
      if (stream.aborted || abortController.signal.aborted) break

      if (part.type === "reasoning") {
        const event: ChatStreamEvent = { type: "reasoning-delta", text: (part as any).text ?? "" }
        await stream.writeSSE({ event: "reasoning-delta", data: JSON.stringify(event) })
      }

      if (part.type === "text-delta") {
        fullText += part.text
        const event: ChatStreamEvent = { type: "text-delta", text: part.text }
        await stream.writeSSE({ event: "text-delta", data: JSON.stringify(event) })
      }

      if (part.type === "tool-call") {
        const args = (part.input ?? {}) as Record<string, unknown>
        toolCallParts.push({ toolCallId: part.toolCallId, toolName: part.toolName, args })
        const event: ChatStreamEvent = {
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args,
        }
        await stream.writeSSE({ event: "tool-call", data: JSON.stringify(event) })
      }

      if (part.type === "tool-result") {
        const raw = part.output as { success: boolean; output: string } | unknown
        const resultStr = raw && typeof raw === "object" && "output" in raw
          ? String((raw as any).output)
          : JSON.stringify(raw)
        const isError = raw && typeof raw === "object" && "success" in raw
          ? (raw as any).success === false
          : false

        const entry = toolCallParts.find(t => t.toolCallId === part.toolCallId)
        if (entry) { entry.result = resultStr; entry.isError = isError }

        const event: ChatStreamEvent = {
          type: "tool-result",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          result: resultStr,
          isError,
        }
        await stream.writeSSE({ event: "tool-result", data: JSON.stringify(event) })
      }

      if (part.type === "error") {
        throw part.error
      }

      if (stream.aborted || abortController.signal.aborted) return
    }

    const elapsedMs = Date.now() - startTime

    const assistantMessage = await db.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: fullText,
        status: MessageStatus.COMPLETE,
        model,
        mode,
        duration: Math.round(elapsedMs / 1000),
        parts: toolCallParts.length > 0 ? (toolCallParts as unknown as Parameters<typeof db.message.create>[0]["data"]["parts"]) : undefined,
      },
    })

    const doneEvent: ChatStreamEvent = { type: "done", messageId: assistantMessage.id, durationMs: elapsedMs }
    await stream.writeSSE({ event: "done", data: JSON.stringify(doneEvent) })
  } catch (e) {
    if (abortController.signal.aborted) return

    const message = e instanceof Error ? e.message : String(e)

    await db.message.create({
      data: {
        sessionId,
        role: "ERROR",
        status: MessageStatus.COMPLETE,
        model,
        content: message,
        mode,
      }
    });

    const errorEvent: ChatStreamEvent = { type: "error", message }
    await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) })
  } finally {
    clearTimeout(timeoutId)
  }
}

const app = new Hono()
  .post("/:sessionId/resume", async (c) => {
    const sessionId = c.req.param("sessionId")
    const session = await db.session.findUnique({ where: { id: sessionId }, include: { messages: { orderBy: { createdAt: "asc" } } } })
    if (!session) {
      return c.json({ error: "Session not found" }, 404)
    }
    const lastMessage = session.messages[session.messages.length - 1]
    if (!lastMessage || lastMessage.role !== "USER") {
      return c.json({ error: "No pending user messages found" }, 404)
    }

    if (!isSupportedChatModel(lastMessage.model)) {
      return c.json({ error: "Unsupported chat model" }, 400)
    }

    const history = buildConversationHistory([...session.messages])

    const credentials: ProviderCredentials = {
      apiKey: c.req.header("x-provider-api-key"),
      baseUrl: c.req.header("x-provider-base-url"),
    }

    const abortController = new AbortController()

    return streamSSE(
      c,
      async (stream) => {
        stream.onAbort(() => { abortController.abort() })
        await streamAIResponse(stream, {
          sessionId, model: lastMessage.model, history, mode: lastMessage.mode, abortController, credentials,
          cwd: process.cwd(),
          contextWindow: getModelContextWindow(lastMessage.model),
          dbMessages: session.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
        })
      },
      async (err, stream) => {
        const msg = err instanceof Error ? err.message : String(err)
        const errorEvent: ChatStreamEvent = { type: "error", message: msg }
        await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) })
      },
    )
  })
  .post("/:sessionId", submitValidator, async (c) => {
    const sessionId = c.req.param("sessionId")

    const session = await db.session.findUnique({ where: { id: sessionId }, include: { messages: { orderBy: { createdAt: "asc" } } } })

    if (!session) {
      return c.json({ error: "Session not found" }, 404)
    }

    const data = c.req.valid("json")
    const cwd = data.cwd && isAbsolute(data.cwd) ? data.cwd : process.cwd()

    const credentials: ProviderCredentials = {
      apiKey: c.req.header("x-provider-api-key"),
      baseUrl: c.req.header("x-provider-base-url"),
    }

    await db.message.create({
      data: {
        sessionId,
        role: "USER",
        content: data.content,
        status: MessageStatus.COMPLETE,
        model: data.model,
        mode: data.mode,
      },
    })

    const history = buildConversationHistory([
      ...session.messages,
      { role: "USER" as const, content: data.content, status: MessageStatus.COMPLETE },
    ])

    const abortController = new AbortController()

    return streamSSE(
      c,
      async (stream) => {
        stream.onAbort(() => { abortController.abort() })
        await streamAIResponse(stream, {
          sessionId, model: data.model, history, mode: data.mode, abortController, credentials, cwd,
          contextWindow: getModelContextWindow(data.model),
          dbMessages: session.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
        })
      },
      async (err, stream) => {
        const msg = err instanceof Error ? err.message : String(err)
        const errorEvent: ChatStreamEvent = { type: "error", message: msg }
        await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) })
      },
    )
  })

  .post("/:sessionId/compact", async (c) => {
    const sessionId = c.req.param("sessionId")
    const session = await db.session.findUnique({ where: { id: sessionId }, include: { messages: { orderBy: { createdAt: "asc" } } } })
    if (!session) return c.json({ error: "Session not found" }, 404)

    const lastMessage = session.messages[session.messages.length - 1]
    if (!lastMessage) return c.json({ error: "No messages in session" }, 400)

    if (!isSupportedChatModel(lastMessage.model)) {
      return c.json({ error: "Unsupported chat model" }, 400)
    }

    const model = lastMessage.model
    const contextWindow = getModelContextWindow(model)
    const resolvedModel = resolveChatModel(model)
    const systemPrompt = loadSystemPrompt(process.cwd())

    const dbMessages = session.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }))

    const result = await compactMessages({
      sessionId,
      messages: dbMessages,
      model: resolvedModel.model,
      modelId: model,
      systemPrompt,
      contextWindow,
      force: true,
    })

    const tokensSaved = Math.max(0, result.record.tokensBefore - result.record.tokensAfter)

    if (result.record.originalMessageIds.length === 0) {
      return c.json({ compacted: false, tokensSaved: 0, messageCount: 0, summaryPreview: "" })
    }

    return c.json({
      compacted: true,
      summaryPreview: result.record.summary.slice(0, 100) + (result.record.summary.length > 100 ? "..." : ""),
      tokensSaved,
      messageCount: result.record.originalMessageIds.length,
    })
  })

export default app
