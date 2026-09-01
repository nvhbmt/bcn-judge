/** Kiểu dùng chung cho màn 06 (team) — một định nghĩa, không để hai bản sao trôi lệch. */
import type { Verdict } from '@/types/api'

export interface TeamView {
  id: string
  name: string
  createdAt: string
  descriptionMd: string | null
  leaderId: string
  isLeader: boolean
  members: { id: string; displayName: string; isLeader: boolean }[]
}

export interface TeamProgressRow {
  userId: string
  displayName: string
  courseId: string
  courseName: string
  acCount: number
  totalItems: number
  lastSubmittedAt: string | null
}

export interface TeamSubmissionRow {
  id: string
  userId: string
  languageId: string
  verdict: Verdict | null
  score: number | null
  receivedAt: string
  source: string | null
  sourceEmbargoedUntil: string | null
}
