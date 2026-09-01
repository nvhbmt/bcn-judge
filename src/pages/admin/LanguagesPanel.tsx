/**
 * FR-H1 / US-8: bật-tắt và sửa ngôn ngữ chấm.
 *
 * US-8 nói "bật lên thì mentor thấy ngay, KHÔNG cần deploy lại ứng dụng" — nên
 * công tắc bật/tắt là thứ to nhất trên mỗi dòng, không giấu sau nút "Sửa".
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, SectionRule, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import { LanguageForm } from './LanguageForm'
import { toLanguagePayload } from './languagePayload'
import type { Language } from './types'
import { FailureBanner } from './ui'

export function LanguagesPanel() {
  const client = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<FailureNotice | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'languages'],
    queryFn: () => api.get<Language[]>('/api/admin/languages'),
  })

  const toggle = useMutation({
    // PUT là upsert ghi đè cả hàng: phải gửi lại đủ mọi trường, không chỉ `enabled`.
    mutationFn: (lang: Language) =>
      api.put(`/api/admin/languages/${lang.id}`, toLanguagePayload(lang, { enabled: !lang.enabled })),
    onSuccess: () => {
      setNotice(null)
      void client.invalidateQueries({ queryKey: ['admin', 'languages'] })
    },
    onError: (err) => setNotice(describeFailure(err, 'Không đổi được trạng thái ngôn ngữ.')),
  })

  return (
    <section className="mb-5">
      <div className="mb-1"><SectionRule label="Ngôn ngữ chấm" /></div>
      <p className="mb-3 text-sm text-ink-5">
        Bật một ngôn ngữ là mentor thấy nó ngay trong danh sách ngôn ngữ cho phép của bài — không cần deploy lại. Image
        Docker phải có sẵn trên máy chấm trước khi bật.
      </p>

      <FailureBanner notice={notice} />
      {isLoading ? <Spinner /> : null}
      {data && data.length === 0 ? <EmptyState title="Chưa cấu hình ngôn ngữ nào" /> : null}

      <ul className="space-y-2">
        {data?.map((lang) => (
          <li key={lang.id} className="border border-line bg-surface-2">
            <div className="flex flex-wrap items-center gap-3 p-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={lang.enabled}
                  disabled={toggle.isPending}
                  onChange={() => toggle.mutate(lang)}
                  className="size-5 accent-[var(--color-primary)]"
                />
                <span
                  className={`text-xs font-semibold ${
                    lang.enabled ? 'text-[var(--color-ac)]' : 'text-ink-6'
                  }`}
                >
                  {lang.enabled ? 'Đang bật' : 'Đang tắt'}
                </span>
              </label>

              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {lang.name}
                  {lang.versionLabel ? <span className="ml-1 text-ink-5">{lang.versionLabel}</span> : null}
                </span>
                <span className="block truncate font-mono text-xs text-ink-5">
                  {lang.id} · {lang.image}
                </span>
              </span>

              <span className="ml-auto flex items-center gap-3">
                <span className="text-xs whitespace-nowrap text-ink-5">×{Number(lang.timeFactor) || 1} thời gian</span>
                <button
                  type="button"
                  onClick={() => setEditing(editing === lang.id ? null : lang.id)}
                  aria-expanded={editing === lang.id}
                  className="inline-flex items-center gap-1 border border-line-strong px-2 py-1 text-xs
 hover:bg-surface-sel focus-visible:outline-2 focus-visible:outline-offset-1
 focus-visible:outline-[var(--color-primary)]"
                >
                  <Pencil size={13} /> Sửa
                </button>
              </span>
            </div>

            {editing === lang.id ? <LanguageForm lang={lang} onDone={() => setEditing(null)} /> : null}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-ink-5">
        Thêm ngôn ngữ hoàn toàn mới cần một id chưa tồn tại; API hiện chỉ có <code className="font-mono">PUT</code> theo
        id nên việc này làm bằng seed hoặc migration, sau đó chỉnh tại đây.
      </p>
    </section>
  )
}
