import { db, MessageStatus, Mode } from "@papercode/database";
import z from "zod";
import { streamText as aiStreamText } from "ai";
import { isSupportedChatModel, resolveChatModel, type ProviderCredentials } from "../lib/models";
import { zValidator } from "@hono/zod-validator";
import { streamSSE } from "hono/streaming";
import type { ChatStreamEvent } from "@papercode/shared";
import { Hono } from "hono";

const submitSchema = z.object({
  content: z.string(),
  mode: z.enum(Mode),
  model: z.string().refine(isSupportedChatModel, "Unsupported Model"),
})

const submitValidator = zValidator("json", submitSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid Input" }, 400);
  }
})

// strip error msg and assistant msg from the convo
function buildConversationHistory(
  messages: { role: "USER" | "ASSISTANT" | "ERROR"; content: string;  status: MessageStatus}[]
) {
  return messages.flatMap((m) => {
    if (m.role == "ERROR") return []
    if (m.role == "ASSISTANT" && m.content.length === 0) return []

    return [
      {
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content
      }
    ]
})
}

type StreamParams = {
  sessionId: string;
  mode: Mode;
  model: string;
  history: { role: "user" | "assistant"; content: string }[]
  abortController: AbortController;
  credentials?: ProviderCredentials;
}

async function streamAIResponse(
  stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
  params: StreamParams,
) {
  const { sessionId, mode, model, history, abortController, credentials } = params;
  const startTime = Date.now();
  const resolvedModel = resolveChatModel(model, credentials)
  let fullText = ""

  try {
    const result = aiStreamText({
      model: resolvedModel.model,
      messages: history,
      abortSignal: abortController.signal,
    })

    for await (const part of result.fullStream) {
      if (stream.aborted) break

      if (part.type === "text-delta") {
        fullText += part.text
        const event: ChatStreamEvent = { type: "text-delta", text: part.text }
        await stream.writeSSE({ event: "text-delta", data: JSON.stringify(event) })
      }

      if (part.type === "error") {
        throw part.error
      }

      if (stream.aborted || abortController.signal.aborted) {
        return
      }
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
      },
    })

    const doneEvent: ChatStreamEvent = {
      type: "done", messageId: assistantMessage.id, durationMs: elapsedMs
    }
    await stream.writeSSE({ event: "done", data: JSON.stringify(doneEvent) })
  }
  catch (e) {
    if (abortController.signal.aborted) return

    const message = e instanceof Error ? e.message : String(e)

    await db.message.create({
      data: {
        sessionId,
        role: "ERROR",
        status: MessageStatus.COMPLETE,
        model,
        content: message,
        mode
      }
    });

    const errorEvent: ChatStreamEvent = { type: "error", message: message }
    await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) })

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

    if(!isSupportedChatModel(lastMessage.model)) {
      return c.json({ error: "Unsupported chat model" }, 400)
    }

    const history = buildConversationHistory([
      ...session.messages,
    ])

    const credentials: ProviderCredentials = {
      apiKey: c.req.header("x-provider-api-key"),
      baseUrl: c.req.header("x-provider-base-url"),
    }

    const abortController = new AbortController()

    return streamSSE(
      c,
      async (stream) => {
        stream.onAbort(() => {
          abortController.abort()
        })

        await streamAIResponse(stream, {
          sessionId, model:lastMessage.model, history, mode: lastMessage.mode, abortController, credentials
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
  const sessionId  = c.req.param("sessionId")

  const session = await db.session.findUnique({ where: { id: sessionId }, include: { messages: { orderBy: { createdAt: "asc" } } } })

  if (!session) {
    return c.json({ error: "Session not found" }, 404)
  }

  const data = c.req.valid("json")
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
    {
      role: "USER" as const,
      content: data.content,
      status: MessageStatus.COMPLETE,
    }
  ])

  const abortController = new AbortController()

  return streamSSE(
    c,
    async (stream) => {
      stream.onAbort(() => {
        abortController.abort()
      })

      await streamAIResponse(stream, {
        sessionId, model: data.model, history, mode: data.mode, abortController, credentials
      })
    },
    async (err, stream) => {
      const msg = err instanceof Error ? err.message : String(err)
      const ErrorEvent: ChatStreamEvent = { type: "error", message: msg }
      await stream.writeSSE({event: "error", data: JSON.stringify(ErrorEvent)})
    },
  )
})

export default app
