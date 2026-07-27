import { z } from 'zod'

export const serializableIdSchema = z.string().trim().min(1)

export const runIdSchema = serializableIdSchema
export const turnIdSchema = serializableIdSchema
export const eventIdSchema = serializableIdSchema
export const requestIdSchema = serializableIdSchema
export const responseIdSchema = serializableIdSchema
export const toolCallIdSchema = serializableIdSchema
export const objectIdSchema = serializableIdSchema
export const observationIdSchema = serializableIdSchema
export const noteIdSchema = serializableIdSchema

export type RunId = z.infer<typeof runIdSchema>
export type TurnId = z.infer<typeof turnIdSchema>
export type EventId = z.infer<typeof eventIdSchema>
export type RequestId = z.infer<typeof requestIdSchema>
export type ResponseId = z.infer<typeof responseIdSchema>
export type ToolCallId = z.infer<typeof toolCallIdSchema>
export type ObjectId = z.infer<typeof objectIdSchema>
export type ObservationId = z.infer<typeof observationIdSchema>
export type NoteId = z.infer<typeof noteIdSchema>
