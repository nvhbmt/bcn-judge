/**
 * Chạy thử tầng judge bằng tay, không cần DB/API (nguyên mẫu P0).
 *
 *   npm run judge:demo                        # bài mẫu "Tổng hai số", C
 *   npm run judge:demo -- --lang python3
 *   npm run judge:demo -- --lang c11 --source ../runner/abuse/infinite_loop.c
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getLanguage } from './languages'
import { judgeSubmission } from './runner'
import { DEFAULT_LIMITS, type TestcaseInput } from './types'

const argv = process.argv.slice(2)
function opt(name: string, fallback?: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : fallback
}

const langId = opt('lang', 'c11')!
const language = getLanguage(langId)
const timeLimitMs = Number(opt('time', '1000'))
const memoryLimitMb = Number(opt('memory', '256'))

const DEMO_SOURCE: Record<string, string> = {
  c11: 'sum.c',
  cpp17: 'hello.cpp',
  python3: 'hello.py',
}

const sourcePath = opt('source') ?? join(import.meta.dirname, '../../runner/abuse', DEMO_SOURCE[langId] ?? 'hello.py')
const source = readFileSync(sourcePath, 'utf8')

const isSumDemo = sourcePath.endsWith('sum.c')
const testcases: TestcaseInput[] = isSumDemo
  ? [
      { position: 1, isSample: true, weight: 1, input: Buffer.from('3 5\n'), expected: Buffer.from('8\n') },
      { position: 2, isSample: true, weight: 1, input: Buffer.from('-2 7\n'), expected: Buffer.from('5\n') },
      { position: 3, isSample: false, weight: 1, input: Buffer.from('1000000000 1000000000\n'), expected: Buffer.from('2000000000\n') },
      { position: 4, isSample: false, weight: 1, input: Buffer.from('0 0\n'), expected: Buffer.from('0\n') },
    ]
  : [{ position: 1, isSample: true, weight: 1, input: Buffer.from(''), expected: null }]

const started = Date.now()
console.log(`Ngôn ngữ : ${language.label} (${language.image})`)
console.log(`Source   : ${sourcePath}`)
console.log(`Giới hạn : ${timeLimitMs} ms × ${language.timeFactor}, ${memoryLimitMb} MB\n`)

const outcome = await judgeSubmission(
  {
    language,
    files: [{ name: language.sourceFilename, content: source }],
    testcases,
    limits: { ...DEFAULT_LIMITS, timeLimitMs, memoryLimitMb },
  },
  {
    onCompiled: (out) => {
      if (out.trim()) console.log(`[biên dịch] ${out.trim().slice(0, 500)}`)
    },
    onTestcase: (r) => {
      const kind = r.isSample ? 'mẫu' : 'ẩn '
      const detail = r.detail ? ` (${r.detail})` : ''
      console.log(
        `  test ${String(r.position).padStart(2)} [${kind}] ${r.verdict.padEnd(3)}` +
          ` ${String(r.timeMs).padStart(5)} ms  ${String(Math.round(r.memoryKb / 1024)).padStart(4)} MB${detail}`,
      )
    },
    log: (m) => console.log(`[worker] ${m}`),
  },
)

console.log(`\nVerdict  : ${outcome.verdict}`)
console.log(`Điểm     : ${outcome.score} (${outcome.passedWeight}/${outcome.totalWeight} trọng số)`)
console.log(`Thời gian: tối đa ${outcome.timeMsMax} ms · bộ nhớ tối đa ${Math.round(outcome.memoryKbMax / 1024)} MB`)
console.log(`Chấm hết : ${outcome.judgeMs} ms (tổng CLI ${Date.now() - started} ms)`)
if (outcome.ieReason) console.log(`IE       : ${outcome.ieReason}`)
