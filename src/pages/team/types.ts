/** Kiểu dùng chung cho màn 06 (team) — một định nghĩa, không để hai bản sao trôi lệch. */
import type { Verdict } from '@/types/api'

export interface TeamView {
  id: string
  name: string
  createdAt: string
  descriptionMd: string | null
  leaderId: string
  isLeader: boolean
  /** `avatarUrl` là ảnh Discord đã dựng sẵn URL; `null` = Avatar lùi về chữ cái đầu. */
  members: { id: string; displayName: string; isLeader: boolean; avatarUrl: string | null }[]
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
  /** Tên bài — `null` nếu bài đã bị xoá. */
  problemTitle: string | null
  languageId: string
  verdict: Verdict | null
  score: number | null
  receivedAt: string
  source: string | null
  sourceEmbargoedUntil: string | null
}
