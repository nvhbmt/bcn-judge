/**
 * Bộ abuse P0 (design.md §10.4, §11) — cổng go/no-go của toàn dự án.
 *
 * Cần Docker + hai runner image:
 *   bash scripts/build-runner-images.sh
 *   cd server && npm run test:sandbox
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from './languages'
import { judgeSubmission } from './runner'
import { Sandbox, docker } from './sandbox'
import { DEFAULT_LIMITS, type JudgeLimits, type TestcaseInput } from './types'
import { drainPool } from './pool'

const RUN_DOCKER = process.env.DOCKER === '1'
const ABUSE_DIR = join(import.meta.dirname, '../../runner/abuse')

const src = (file: string): string => readFileSync(join(ABUSE_DIR, file), 'utf8')

function tc(position: number, input: string, expected: string | null, isSample = true): TestcaseInput {
  return {
    position,
    isSample,
    weight: 1,
    input: Buffer.from(input, 'utf8'),
    expected: expected === null ? null : Buffer.from(expected, 'utf8'),
  }
}

function judge(
  langId: keyof typeof LANGUAGES,
  file: string,
  testcases: TestcaseInput[],
  limits: Partial<JudgeLimits> = {},
) {
  return judgeSubmission({
    language: LANGUAGES[langId],
    files: [{ name: LANGUAGES[langId].sourceFilename, content: src(file) }],
    testcases,
    limits: { ...DEFAULT_LIMITS, ...limits },
  })
}

describe.skipIf(!RUN_DOCKER)('P0 — sandbox trên Docker thật', () => {
  // ---- Ca số 0: biên dịch + chạy được. Lớp lỗi "mọi bài thành CE" (§3.2 phase 1).
  it('ca 0 — C: biên dịch và chạy end-to-end', async () => {
    const out = await judge('c11', 'hello.c', [tc(1, '', 'hello')])
    expect(out.compileOutput).not.toMatch(/error/i)
    expect(out.verdict).toBe('AC')
    expect(out.score).toBe(100)
  })

  it('ca 0 — C++: biên dịch và chạy end-to-end', async () => {
    const out = await judge('cpp17', 'hello.cpp', [tc(1, '', 'hello')])
    expect(out.verdict).toBe('AC')
  })

  it('ca 0 — Python: py_compile và chạy end-to-end', async () => {
    const out = await judge('python3', 'hello.py', [tc(1, '', 'hello')])
    expect(out.verdict).toBe('AC')
  })

  // Mức S: image build sẵn, tắt trong seed. Ca này canh lớp lỗi PATH đã cắn hai
  // lần (python ở /usr/local/bin, JDK ở /opt/java/openjdk/bin) — image phải tự
  // đưa toolchain lên PATH chuẩn chứ không nới PATH của sandbox.
  it.each([
    ['java17', 'Main.java'],
    ['node20', 'hello.js'],
  ])('ca 0 — %s: biên dịch và chạy end-to-end', async (langId, file) => {
    const out = await judge(langId as keyof typeof LANGUAGES, file, [tc(1, '', 'hello')], {
      timeLimitMs: 5000,
      memoryLimitMb: 512,
    })
    expect(out.compileOutput).not.toMatch(/error|not found/i)
    expect(out.verdict).toBe('AC')
  })

  it('java: JVM chạy lọt trần 64 tiến trình của sandbox', async () => {
    const out = await judge('java17', 'Main.java', [tc(1, '3 5\n', '8')], {
      timeLimitMs: 5000,
      memoryLimitMb: 512,
    })
    expect(out.verdict).toBe('AC')
  })

  // ---- Rủi ro P0 có tên: half-close/EOF của stdin qua Docker exec API (§12 #1).
  it('stdin nhận EOF thật — chương trình đọc tới EOF không bị treo', async () => {
    const out = await judge('python3', 'cat_eof.py', [tc(1, 'abcde', '5')])
    expect(out.verdict).toBe('AC')
    expect(out.results[0]?.timeMs).toBeLessThan(3000)
  })

  it('input đi vào đúng chương trình (tổng hai số)', async () => {
    const out = await judge('c11', 'sum.c', [tc(1, '3 5\n', '8'), tc(2, '-2 7\n', '5')])
    expect(out.verdict).toBe('AC')
    expect(out.results.map((r) => r.verdict)).toEqual(['AC', 'AC'])
  })

  it('WA báo đúng dòng khác biệt', async () => {
    const out = await judge('c11', 'sum.c', [tc(1, '3 5\n', '9')])
    expect(out.verdict).toBe('WA')
    expect(out.results[0]?.firstDiffLine).toBe(1)
  })

  it('điểm chuẩn hoá 0–100 theo trọng số (FR-F2 v0.5)', async () => {
    const out = await judge('c11', 'sum.c', [
      tc(1, '1 1\n', '2'),
      tc(2, '2 2\n', '4'),
      tc(3, '3 3\n', '7'), // sai
    ])
    expect(out.verdict).toBe('WA')
    expect(out.passedWeight).toBe(2)
    expect(out.totalWeight).toBe(3)
    expect(out.score).toBe(66.67)
  })

  it('trọng số KHÁC 1 thật sự được tính (FR-F2 v0.5)', async () => {
    // Ca trên tên là "theo trọng số" nhưng cả ba testcase đều weight 1, nên nó không
    // kiểm trọng số một chút nào — mọi test trong repo đều hardcode weight 1. Thay
    // `passedWeight += tc.weight` bằng `+= 1` và `totalWeight` bằng số testcase thì
    // 209 test vẫn xanh, trong khi mentor đặt trọng số 1–1000 ở giao diện và điểm
    // contest cùng bảng xếp hạng đều dựa vào hai con số đó.
    const nang = (position: number, input: string, expected: string, weight: number): TestcaseInput => ({
      ...tc(position, input, expected),
      weight,
    })
    const out = await judge('c11', 'sum.c', [
      nang(1, '1 1\n', '2', 1),
      nang(2, '2 2\n', '4', 3),
      nang(3, '3 3\n', '7', 6), // sai — trọng số nặng nhất
    ])

    expect(out.verdict).toBe('WA')
    expect(out.passedWeight).toBe(4)
    expect(out.totalWeight).toBe(10)
    expect(out.score).toBe(40)
  })

  // ---- Bảng verdict trên hành vi thật.
  it('lỗi cú pháp → CE kèm CHẨN ĐOÁN THẬT của compiler', async () => {
    const out = await judge('c11', 'syntax_error.c', [tc(1, '', 'x')])
    expect(out.verdict).toBe('CE')
    expect(out.results).toHaveLength(0)

    // Bản trước chỉ kiểm `length > 0`, mà chuỗi dự phòng "Biên dịch thất bại."
    // cũng thoả — nên test vẫn xanh suốt trong khi run.sh nuốt sạch stderr của
    // compiler (thứ tự chuyển hướng `2>/dev/null >&2` đẩy cả fd1 vào /dev/null).
    // Người học nhận CE mà không biết sai ở đâu. Phải đòi nội dung THẬT:
    // Nguồn được nạp vào container dưới tên của ngôn ngữ (main.c), không phải tên
    // file fixture trên máy host.
    expect(out.compileOutput).toContain('main.c')
    expect(out.compileOutput).toMatch(/error/i)
    expect(out.compileOutput).toContain('khong_ton_tai')
    expect(out.compileOutput).not.toBe('Biên dịch thất bại.')
  })

  it('vòng lặp vô hạn → TLE (không treo worker)', async () => {
    const out = await judge('c11', 'infinite_loop.c', [tc(1, '', null)], { timeLimitMs: 1000 })
    expect(out.verdict).toBe('TLE')
  })

  it('cấp phát vượt trần → MLE (xác minh thu hẹp lồng bộ nhớ §3.2 phase 3)', async () => {
    const out = await judge('c11', 'memory_hog.c', [tc(1, '', null)], {
      memoryLimitMb: 256,
      timeLimitMs: 5000,
    })
    expect(out.verdict).toBe('MLE')
    expect(out.results[0]?.stdout ?? '').not.toContain('allocated 400MB')
  })

  it('segfault → RE kèm tên signal', async () => {
    const out = await judge('c11', 'segfault.c', [tc(1, '', null)])
    expect(out.verdict).toBe('RE')
    expect(out.results[0]?.detail).toBe('SIGSEGV')
  })

  // ---- US-9: code phá hoại không giết worker.
  it('tràn output → RE(output_limit), không phải TLE, container vẫn sống', async () => {
    const out = await judge('c11', 'output_flood.c', [tc(1, '', null)], {
      maxOutputBytes: 1024 * 1024,
      timeLimitMs: 3000,
    })
    expect(out.verdict).toBe('RE')
    expect(out.results[0]?.detail).toBe('output_limit')
    expect((out.results[0]?.stdout ?? '').length).toBeLessThanOrEqual(64 * 1024)
  })

  it('fork bomb → testcase đó hỏng nhưng TESTCASE SAU vẫn được chấm (US-9)', async () => {
    const out = await judge('c11', 'forkbomb.c', [
      tc(1, '1\n', null), // bomb
      tc(2, '0\n', 'ok'), // phải vẫn chấm được
    ], { timeLimitMs: 2000 })

    expect(['RE', 'TLE']).toContain(out.results[0]?.verdict)
    expect(out.results[1]?.verdict).toBe('AC')
    expect(out.results.some((r) => r.verdict === 'IE')).toBe(false)
  })

  it('ghi đĩa ồ ạt bị chặn (không đầy đĩa host)', async () => {
    const out = await judge('python3', 'disk_flood.py', [tc(1, '', null)], { timeLimitMs: 5000 })
    const stdout = out.results[0]?.stdout ?? ''
    expect(stdout).not.toContain('WROTE 209715200')
    expect(out.results[0]?.verdict === 'RE' || stdout.includes('WRITE_FAIL')).toBe(true)
  })

  // ---- NFR-1 / US-6: cách ly mạng và hệ thống file.
  it('không có mạng — mọi lối ra ngoài thất bại', async () => {
    const out = await judge('python3', 'net_probe.py', [tc(1, '', null)], { timeLimitMs: 8000 })
    const stdout = out.results[0]?.stdout ?? ''
    expect(stdout).toContain('NET_FAIL')
    expect(stdout).toContain('DNS_FAIL')
    expect(stdout).not.toContain('NET_OK')
  })

  it('không đọc được run.sh, file đo, /etc/shadow; rootfs không ghi được; /w chỉ có source', async () => {
    const out = await judge('python3', 'fs_probe.py', [tc(1, '', null)], { timeLimitMs: 8000 })
    const stdout = out.results[0]?.stdout ?? ''
    expect(stdout).toMatch(/shadow DENY/)
    expect(stdout).toMatch(/runsh DENY/)
    expect(stdout).toMatch(/meta DENY/)
    expect(stdout).not.toContain('rootfs WRITABLE')
    // Không có thư mục testcase nào để đọc — input chỉ đi qua stdin (US-6).
    expect(stdout).toMatch(/workdir \[[^\]]*'main\.py'/)
    expect(stdout).not.toMatch(/\.in'|\.out'/)
  })

  it('giả mạo dòng __JUDGE_META__ không lừa được worker', async () => {
    const out = await judge('c11', 'fake_meta.c', [tc(1, '', null)], { timeLimitMs: 1000 })
    expect(out.verdict).toBe('TLE')
  })

  it('giả mạo __JUDGE_META__ KÈM xả tràn stderr cũng không lừa được worker', async () => {
    // Ca trên xanh suốt mà lỗ vẫn mở: fake_meta.c không xả rác nên dòng thật vẫn về
    // tới nơi. Chỉ thêm 9 KB stderr là dòng thật rơi ra ngoài ngân sách thu và dòng
    // giả thắng — người học tự chọn verdict cho mọi bài, kể cả trong contest.
    const out = await judge('c11', 'fake_meta_flood.c', [tc(1, '', null)], { timeLimitMs: 1000 })
    expect(out.verdict).toBe('TLE')
  })

  it('bài ĐÚNG in nhiều stderr vẫn AC, không bị IE oan', async () => {
    // Mặt không ác ý của cùng một lỗi: `fprintf(stderr, ...)` gỡ lỗi để quên trong
    // vòng lặp làm mất dòng meta thật → IE, thứ giao diện gọi là "lỗi hệ thống".
    const out = await judge('c11', 'noisy_ok.c', [tc(1, '', 'ok\n')], { timeLimitMs: 5000 })
    expect(out.verdict).toBe('AC')
  })

  // ---- Lớp siết an ninh phải áp được trên MỌI runner image, không im lặng hỏng.
  it.each([
    ['gcc', LANGUAGES.c11.image],
    ['python', LANGUAGES.python3.image],
  ])('hạ được bounding set của capability trên image %s', async (_name, image) => {
    const sb = await Sandbox.create({ image, memoryMb: 256, maxOutputBytes: 65536 })
    try {
      const out = await sb.exec(['/opt/judge/run.sh', '--cpu', '5', '--wall', '10', '--out', '4096', '--', 'true'], {
        maxOutputBytes: 4096,
        wallDeadlineMs: 20_000,
      })
      expect(out.meta?.st).toBe(0)
      expect(out.meta?.bset).toBe(1)
    } finally {
      await sb.destroy()
    }
  })

  // ---- Vệ sinh: không để lại container mồ côi.
  it('không còn container sandbox nào sót lại (sau khi xả bể ấm)', async () => {
    // PHẢI xả bể trước khi đếm. Phép kiểm này viết TRƯỚC khi có bể container ấm
    // (pool.ts): hồi đó "còn container mang nhãn" đồng nghĩa "rò rỉ". Nay bể cố ý
    // giữ container Up để lượt chấm sau khỏi trả giá khởi động, nên đếm thẳng là
    // đếm nhầm đồ đang dùng thành đồ bỏ quên — bộ này đỏ ở chính ca vệ sinh mà
    // không ai thấy suốt, vì nó chỉ chạy khi DOCKER=1.
    //
    // Xả-rồi-đếm còn kiểm được NHIỀU hơn bản cũ: nếu drainPool bỏ sót một container
    // (đúng lớp lỗi mà reap.ts phải dọn ở production), phép đếm dưới đây bắt được.
    await drainPool()
    const list = await docker.listContainers({
      all: true,
      filters: { label: ['bcnjudge.sandbox=1'] },
    })
    expect(list).toHaveLength(0)
  })
})
