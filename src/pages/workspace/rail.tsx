import { BookOpen, HelpCircle, Info, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'

/** Bốn mục BCN đã chốt cho thanh icon (FR-E7 v0.4). */
export type RailKey = 'mo-ta' | 'giao-trinh' | 'bang-xep-hang' | 'tro-giup'

export interface RailDef {
  key: RailKey
  label: string
  icon: ReactNode
}

export const RAIL_ITEMS: RailDef[] = [
  { key: 'mo-ta', label: 'Mô tả', icon: <Info size={18} /> },
  { key: 'giao-trinh', label: 'Giáo trình', icon: <BookOpen size={18} /> },
  { key: 'bang-xep-hang', label: 'Bảng xếp hạng', icon: <Trophy size={18} /> },
  { key: 'tro-giup', label: 'Trợ giúp', icon: <HelpCircle size={18} /> },
]

export const RAIL_LABEL: Record<RailKey, string> = {
  'mo-ta': 'Mô tả',
  'giao-trinh': 'Giáo trình',
  'bang-xep-hang': 'Bảng xếp hạng',
  'tro-giup': 'Trợ giúp',
}
