import z from "zod";

export const toolCallArgsSchema = z.record(z.string(), z.unknown())

export const messagePartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("reasoning"),
    id: z.string(),
  }),
  z.object({
    type: z.literal("tool-call"),
    id: z.string(),
    name: z.string(),
    args: toolCallArgsSchema,
    result: z.string().optional(),
  }),
  z.object({
    type: z.literal("text"),
    text: z.string()
  })
])

export const messagePartsSchema = z.array(messagePartSchema)

export type MessagePart = z.infer<typeof messagePartSchema>

export const chatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text-delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("reasoning-delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    args: toolCallArgsSchema,
    toolName: z.string(),
  }),
  z.object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.string(),
    isError: z.boolean(),
  }),
  z.object({
    type: z.literal("done"),
    messageId: z.string(),
    durationMs: z.number(),
  }),
  z.object({
    type: z.literal("compaction-start"),
    messageCount: z.number(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("compaction-done"),
    summaryPreview: z.string(),
    tokensSaved: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string()
  })
])

export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>

export const skillSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, "Skill name must be lowercase alphanumeric with hyphens"),
  description: z.string().min(1),
  prompt: z.string().min(1),
  mode: z.enum(["BUILD", "PLAN"]).optional(),
})

export const skillsFileSchema = z.array(skillSchema)

export type Skill = z.infer<typeof skillSchema>

