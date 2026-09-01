/** FR-H1: sửa image Docker và lệnh biên dịch/chạy của một ngôn ngữ. */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { describeFailure, type FailureNotice } from './conflicts'
import { formatArgv, parseArgv, toLanguagePayload } from './languagePayload'
import type { Language } from './types'
import { Field, FailureBanner, TextArea, TextInput } from './ui'

export function LanguageForm({ lang, onDone }: { lang: Language; onDone: () => void }) {
  const client = useQueryClient()
  const [form, setForm] = useState({
    name: lang.name,
    versionLabel: lang.versionLabel ?? '',
    image: lang.image,
    sourceFilename: lang.sourceFilename,
    compileArgv: formatArgv(lang.compileArgv),
    runArgv: formatArgv(lang.runArgv),
    timeFactor: String(Number(lang.timeFactor) || 1),
    memoryExtraMb: String(lang.memoryExtraMb ?? 0),
    cmMode: lang.cmMode ?? '',
  })
  const [notice, setNotice] = useState<FailureNotice | null>(null)

  const save = useMutation({
    mutationFn: () => {
      const compile = parseArgv(form.compileArgv)
      return api.put(
        `/api/admin/languages/${lang.id}`,
        toLanguagePayload(lang, {
          name: form.name.trim(),
          image: form.image.trim(),
          sourceFilename: form.sourceFilename.trim(),
          compileArgv: compile.length > 0 ? compile : null,
          runArgv: parseArgv(form.runArgv),
          timeFactor: Number(form.timeFactor) || 1,
          memoryExtraMb: Number(form.memoryExtraMb) || 0,
          // Chuỗi rỗng phải thành "bỏ khoá", không phải gửi "" — schema đòi min(1)/max.
          ...(form.versionLabel.trim() ? { versionLabel: form.versionLabel.trim() } : { versionLabel: undefined }),
          ...(form.cmMode.trim() ? { cmMode: form.cmMode.trim() } : { cmMode: undefined }),
        }),
      )
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'languages'] })
      onDone()
    },
    onError: (err) => setNotice(describeFailure(err, 'Không lưu được ngôn ngữ.')),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (parseArgv(form.runArgv).length === 0) {
      return setNotice({ message: 'Lệnh chạy không được để trống.', nextStep: 'Nhập ít nhất một dòng tham số.' })
    }
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200 p-3 dark:border-slate-700">
      <FailureBanner notice={notice} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên hiển thị">
          <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Nhãn phiên bản" hint="Ví dụ: 13.2 — hiện cạnh tên trong ô chọn ngôn ngữ.">
          <TextInput value={form.versionLabel} onChange={(e) => setForm({ ...form, versionLabel: e.target.value })} />
        </Field>
        <Field label="Image Docker" hint="Image phải có sẵn trên máy chấm trước khi bật ngôn ngữ.">
          <TextInput
            required
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Tên tệp mã nguồn" hint="Tên tệp ghi vào sandbox, ví dụ main.cpp hoặc Main.java.">
          <TextInput
            required
            value={form.sourceFilename}
            onChange={(e) => setForm({ ...form, sourceFilename: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Hệ số thời gian" hint="Nhân với giới hạn thời gian của bài (Java/Python thường > 1).">
          <TextInput
            type="number"
            step="0.1"
            min="0.1"
            max="20"
            value={form.timeFactor}
            onChange={(e) => setForm({ ...form, timeFactor: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Bộ nhớ cộng thêm (MB)" hint="Phần bù cho máy ảo/runtime, cộng vào giới hạn của bài.">
          <TextInput
            type="number"
            min="0"
            max="2048"
            value={form.memoryExtraMb}
            onChange={(e) => setForm({ ...form, memoryExtraMb: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Chế độ CodeMirror" hint="Khoá tô màu cú pháp ở editor, ví dụ cpp, python, java.">
          <TextInput
            value={form.cmMode}
            onChange={(e) => setForm({ ...form, cmMode: e.target.value })}
            className="font-mono"
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Lệnh biên dịch — mỗi dòng một tham số" hint="Bỏ trống với ngôn ngữ thông dịch (Python…).">
          <TextArea
            rows={5}
            value={form.compileArgv}
            onChange={(e) => setForm({ ...form, compileArgv: e.target.value })}
            spellCheck={false}
          />
        </Field>
        <Field label="Lệnh chạy — mỗi dòng một tham số" hint="Bắt buộc, ít nhất một dòng.">
          <TextArea
            rows={5}
            value={form.runArgv}
            onChange={(e) => setForm({ ...form, runArgv: e.target.value })}
            spellCheck={false}
          />
        </Field>
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? 'Đang lưu…' : 'Lưu ngôn ngữ'}
        </Button>
        <Button type="button" onClick={onDone}>
          Huỷ
        </Button>
      </div>
    </form>
  )
}
