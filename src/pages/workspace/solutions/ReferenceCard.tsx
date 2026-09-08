/**
 * Lời giải mẫu của mentor (FR-D7) — gập sẵn: nó là "đáp án của thầy", người ta mở khi
 * muốn đối chiếu chứ không phải thứ đập vào mắt trước cả bài của bạn bè.
 */
import { useMemo } from 'react'
import { highlightCode } from '@/components/markdown/render'
import type { LanguageOption } from '@/types/api'
import type { SolutionsData } from './types'

export function ReferenceCard({
  reference,
  languages,
}: {
  reference: NonNullable<SolutionsData['reference']>
  languages: LanguageOption[]
}) {
  const lang = languages.find((l) => l.id === reference.languageId)
  const html = useMemo(() => highlightCode(reference.source, lang?.cmMode ?? null), [reference.source, lang?.cmMode])
  return (
    <details className="border border-earth bg-(--tint-earth)">
      <summary className="cursor-pointer px-3 py-2 text-[14px] font-semibold text-ink-1">
        Lời giải mẫu của mentor
        <span className="ml-2 font-mono text-[12px] font-normal text-ink-5">{lang?.name ?? reference.languageId ?? ''}</span>
      </summary>
      <div
        className="markdown-body max-h-96 overflow-auto border-t border-earth bg-surface-editor px-3 py-2 text-[12.5px]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </details>
  )
}
