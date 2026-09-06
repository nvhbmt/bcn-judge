/**
 * Xem bài nộp của MỘT bài tập — hai panel (FR-G3).
 *
 * Trái: danh sách lượt nộp của bài này. Phải: mã nguồn của lượt đang chọn.
 *
 * Là màn RIÊNG chứ không phải tab thứ ba trong màn soạn bài: nó cần cả hai khung, mà
 * khung phải của màn soạn đang là bản xem trước đề — nhét vào đó thì hoặc mất bản xem
 * trước, hoặc mã nguồn bị ép vào nửa khung bên trái.
 *
 * Vào từ nút "Xem bài nộp" cạnh nút Lưu.
 */
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SplitPane } from '@/components/layout/SplitPane'
import { SubmissionDetail, type CodeView } from '@/components/submission/SubmissionDetail'
import { Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import type { LanguageOption } from '@/types/api'
import { DownloadDialog } from './DownloadDialog'
import { ProblemSubmissions } from './ProblemSubmissions'

export function ProblemSubmissionsPage() {
  const { problemId } = useParams()
  const [picked, setPicked] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const { data: problem } = useQuery({
    queryKey: ['mentor', 'problem', problemId],
    queryFn: () => api.get<{ title: string }>(`/api/mentor/problems/${problemId}`),
  })
  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: () => api.get<LanguageOption[]>('/api/member/languages'),
    staleTime: Infinity,
  })

  // Mã nguồn lấy RIÊNG cho lượt đang chọn — danh sách trả tới 200 dòng, kéo theo mã
  // của cả 200 là vài trăm KB cho một khung chỉ để liếc.
  const { data: chiTiet, isLoading: dangTai } = useQuery({
    queryKey: ['mentor', 'problem', problemId, 'submission', picked],
    queryFn: () => api.get<CodeView>(`/api/mentor/problems/${problemId}/submissions/${picked}`),
    enabled: Boolean(picked),
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface-1 px-5 py-2.5">
        <Link
          to={`/mentor/bai-tap/${problemId}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-5 hover:text-ink-2"
        >
          <ArrowLeft size={13} /> Sửa bài
        </Link>
        <h1 className="truncate font-display text-[16px] text-ink-1">{problem?.title ?? 'Bài nộp'}</h1>
        <span className="font-mono text-[11px] text-ink-6">chỉ đọc</span>
        <button
          type="button"
          onClick={() => setDownloading(true)}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 border border-line-strong px-2.5 py-1 font-mono text-[11px] text-ink-3 hover:border-moss hover:text-ink-1"
        >
          <Download size={13} /> Tải bài làm
        </button>
      </header>

      <div className="min-h-0 flex-1">
        <SplitPane
          storageKey="bcn:problem-submissions"
          defaultRatio={0.4}
          minPx={320}
          left={<ProblemSubmissions problemId={problemId!} selectedId={picked} onSelect={setPicked} />}
          right={
            picked && dangTai ? (
              <div className="grid h-full place-items-center">
                <Spinner />
              </div>
            ) : (
              <SubmissionDetail submission={chiTiet ?? null} languages={languages ?? []} />
            )
          }
        />
      </div>

      {downloading ? <DownloadDialog problemId={problemId!} onClose={() => setDownloading(false)} /> : null}
    </div>
  )
}
