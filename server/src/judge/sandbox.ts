/**
 * Driver Docker cho sandbox chấm bài (design.md §3.2 / NFR-1).
 *
 * Một container mỗi submission. Input testcase đi vào bằng **stdin của exec**, ra
 * bằng **stdout của exec** — hidden testcase không bao giờ tồn tại dưới dạng file ở
 * bất kỳ đâu code member nhìn thấy được (US-6), và không judge path nào cần bind
 * mount từ host.
 *
 * Worker chỉ nói chuyện với Docker Engine API qua dockerode; ở production biến
 * DOCKER_HOST trỏ tới docker-socket-proxy chứ không phải socket thô (ADR-5).
 */
import Docker from 'dockerode'
import { PassThrough } from 'node:stream'
import type { JudgeMeta } from './types'

export const docker = new Docker()

const META_PREFIX = '__JUDGE_META__ '
/** Baseline pids trong container sạch (tini + sleep + chuỗi run.sh). Vượt ngưỡng
 *  này sau khi pkill ⇒ namespace nhiễm độc, phải thay container (§3.2). */
export const PIDS_POISON_THRESHOLD = 24

export interface SandboxCreateOptions {
  image: string
  /** Trần bộ nhớ lúc tạo (cỡ biên dịch); thu hẹp bằng updateMemory() trước khi chạy. */
  memoryMb: number
  maxOutputBytes: number
  cpus?: number
  /** Pin core cho đo thời gian ổn định; bỏ trống khi chạy dev trên máy ít core. */
  cpusetCpus?: string
  pidsLimit?: number
  labels?: Record<string, string>
}

export interface ExecOptions {
  stdin?: Buffer
  maxOutputBytes: number
  /** Hạn chót phía worker; quá hạn coi như kẹt → IE (§3.3). */
  wallDeadlineMs: number
  maxStderrBytes?: number
}

export interface ExecOutcome {
  meta: JudgeMeta | null
  stdout: Buffer
  /** stderr của member, đã bỏ các dòng meta và đã cắt. */
  stderr: string
  outputTruncated: boolean
  timedOut: boolean
  elapsedMs: number
  execExitCode: number | null
}

/** Đọc dòng `__JUDGE_META__` **cuối cùng** — member có thể in ra dòng giả, nhưng
 *  dòng thật do run.sh in sau cùng (§3.2). */
export function parseMeta(stderr: string): JudgeMeta | null {
  const lines = stderr.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line || !line.startsWith(META_PREFIX)) continue
    try {
      const raw = JSON.parse(line.slice(META_PREFIX.length)) as Record<string, number>
      return {
        st: Number(raw.st ?? 0),
        wall: Number(raw.wall ?? 0),
        cpu: Number(raw.cpu ?? 0),
        rssKb: Number(raw.rss_kb ?? 0),
        oom: Number(raw.oom ?? 0),
        pids: Number(raw.pids ?? 0),
        bset: Number(raw.bset ?? 0),
      }
    } catch {
      return null
    }
  }
  return null
}

export function stripMeta(stderr: string): string {
  return stderr
    .split('\n')
    .filter((line) => !line.startsWith(META_PREFIX))
    .join('\n')
    .replace(/\n+$/, '')
}

export class Sandbox {
  readonly id: string

  private constructor(
    private readonly container: Docker.Container,
    private readonly opts: SandboxCreateOptions,
  ) {
    this.id = container.id
  }

  static async create(opts: SandboxCreateOptions): Promise<Sandbox> {
    const memBytes = opts.memoryMb * 1024 * 1024
    // Hard limit ở mức container phải đủ cho BINARY biên dịch (C++ tĩnh vài MB), vì
    // tiến trình không đặc quyền KHÔNG nâng được hard limit (P0 phát hiện: prlimit
    // báo "Operation not permitted"). Trần chặt cho từng lượt chạy do run.sh hạ
    // xuống bằng prlimit --fsize (hạ thì luôn được).
    const fsize = Math.max(opts.maxOutputBytes + 1024 * 1024, 32 * 1024 * 1024)

    const container = await docker.createContainer({
      Image: opts.image,
      Cmd: ['sleep', 'infinity'],
      WorkingDir: '/w',
      User: '0:0',
      Hostname: 'sandbox',
      Env: [
        // design.md §3.2 ghi PATH=/usr/bin:/bin, nhưng image python chính thức đặt
        // interpreter ở /usr/local/bin → mọi bài Python thành CE(127). Thêm
        // /usr/local/bin (root sở hữu, rootfs read-only) không nới lỏng gì.
        'PATH=/usr/local/bin:/usr/bin:/bin',
        'HOME=/tmp',
        'LANG=C.UTF-8',
        'PYTHONDONTWRITEBYTECODE=1',
        'PYTHONIOENCODING=utf-8',
        'OMP_NUM_THREADS=1',
      ],
      Labels: { 'bcnjudge.sandbox': '1', ...(opts.labels ?? {}) },
      NetworkDisabled: true,
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      HostConfig: {
        Init: true,
        NetworkMode: 'none',
        ReadonlyRootfs: true,
        Tmpfs: {
          // /w thuộc uid 1000: compiler (chạy dưới uid 1000) phải ghi được artifact.
          // File source vẫn uid 0 mode 0644 → member không sửa được nội dung (§3.2 phase 1).
          //
          // gid=0,mode=0775 (P0 phát hiện): root trong container KHÔNG có
          // CAP_DAC_OVERRIDE (đã --cap-drop ALL, chỉ giữ SETUID/SETGID/KILL), nên với
          // mode 0755 do uid 1000 sở hữu thì chính root cũng không tạo nổi file source.
          // Mở quyền ghi cho group 0 rẻ hơn và hẹp hơn nhiều so với thêm CAP_DAC_OVERRIDE.
          //
          // `exec` phải ghi TƯỜNG MINH (P0 phát hiện): Docker mặc định gắn noexec cho
          // mọi --tmpfs. Danh sách cờ của design.md §3.2 không có `exec`, nên /w sẽ là
          // noexec và MỌI bài C/C++ nhận RE(exit 126) — binary biên dịch xong không chạy
          // nổi. /tmp vẫn giữ noexec đúng như thiết kế.
          '/w': 'rw,exec,nosuid,nodev,size=64m,uid=1000,gid=0,mode=0775',
          '/tmp': 'rw,noexec,nosuid,nodev,size=16m,mode=1777',
        },
        Memory: memBytes,
        MemorySwap: memBytes,
        NanoCpus: Math.round((opts.cpus ?? 1) * 1e9),
        ...(opts.cpusetCpus ? { CpusetCpus: opts.cpusetCpus } : {}),
        PidsLimit: opts.pidsLimit ?? 64,
        Ulimits: [
          { Name: 'nofile', Soft: 64, Hard: 64 },
          { Name: 'core', Soft: 0, Hard: 0 },
          { Name: 'fsize', Soft: fsize, Hard: fsize },
          { Name: 'stack', Soft: 268_435_456, Hard: 268_435_456 },
        ],
        CapDrop: ['ALL'],
        // SETPCAP thêm so với design.md §3.2 (P0 phát hiện): `setpriv --bounding-set=-all`
        // cần CAP_SETPCAP. util-linux 2.38 (debian bookworm — image gcc) im lặng bỏ qua,
        // nhưng 2.41 (trixie — image python) trả "Operation not permitted" và setpriv
        // exit 127 ⇒ MỌI bài Python thành CE. Cấp SETPCAP không nới quyền cho member:
        // code member chạy uid 1000 với no-new-privs và cap set rỗng; SETPCAP chỉ cho
        // phép chính run.sh HẠ bounding set — tức là để bước siết an ninh chạy được.
        CapAdd: ['SETUID', 'SETGID', 'KILL', 'SETPCAP'],
        SecurityOpt: ['no-new-privileges:true'],
        IpcMode: 'none',
        OomScoreAdj: 500,
        AutoRemove: false,
      },
    })

    await container.start()
    return new Sandbox(container, opts)
  }

  /**
   * Nạp source vào /w: file uid 0, mode 0644 (§3.2 phase 1).
   *
   * **Lệch design.md có lý do (P0 phát hiện)**: bản thiết kế nạp source bằng
   * `putArchive` (tar in-memory), nhưng Docker daemon TỪ CHỐI mọi putArchive vào
   * container có `ReadonlyRootfs: true` — "container rootfs is marked read-only" —
   * kể cả khi đích là một tmpfs mount ghi được. Daemon kiểm cờ ở mức container
   * chứ không xét đích. Hai lựa chọn: bỏ `--read-only` (mất một lớp cách ly
   * NFR-1), hoặc đưa source vào bằng **stdin của một exec chạy dưới root** —
   * đúng nguyên tắc "mọi thứ vào bằng stdin" mà thiết kế đã chọn cho testcase.
   * Chọn cách sau: giữ nguyên rootfs read-only, không thêm bề mặt nào.
   */
  async putSource(filename: string, content: string): Promise<void> {
    // Tên file đi từ bảng `languages` — dữ liệu admin sửa được — nên chặn ở đây
    // thay vì tin tầng gọi: một tên như `../etc/passwd` sẽ ghi ra ngoài /w.
    if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.startsWith('.')) {
      throw new Error(`tên file nguồn không hợp lệ: ${filename}`)
    }
    const target = `/w/${filename}`
    const outcome = await this.exec(
      // Không chown: file do root tạo nên đã là 0:0, mà CAP_CHOWN cũng đã bị drop.
      ['sh', '-c', 'cat > "$0" && chmod 0644 "$0"', target],
      {
        stdin: Buffer.from(content, 'utf8'),
        maxOutputBytes: 4096,
        wallDeadlineMs: 15_000,
        maxStderrBytes: 4096,
      },
    )
    if (outcome.execExitCode !== 0) {
      throw new Error(`nạp source thất bại (exit ${outcome.execExitCode}): ${outcome.stderr.slice(0, 300)}`)
    }
  }

  /** Thu hẹp lồng bộ nhớ sau biên dịch (§3.2 phase 3). */
  async updateMemory(memoryMb: number): Promise<void> {
    const bytes = memoryMb * 1024 * 1024
    await this.container.update({ Memory: bytes, MemorySwap: bytes })
  }

  /** Gặt mọi tiến trình của uid 1000 (khi output tràn — §3.3). */
  async killUser(): Promise<void> {
    try {
      const exec = await this.container.exec({
        Cmd: ['pkill', '-KILL', '-u', '1000'],
        User: '0',
        AttachStdout: false,
        AttachStderr: false,
      })
      const stream = await exec.start({})
      stream.resume()
    } catch {
      // Namespace có thể đã cạn pids — worker xử bằng cách thay container.
    }
  }

  async exec(argv: string[], opts: ExecOptions): Promise<ExecOutcome> {
    const started = Date.now()
    const maxStderr = opts.maxStderrBytes ?? 64 * 1024

    const exec = await this.container.exec({
      Cmd: argv,
      User: '0',
      WorkingDir: '/w',
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    })

    const stream = await exec.start({ hijack: true, stdin: true })

    const outChunks: Buffer[] = []
    const errChunks: Buffer[] = []
    let outBytes = 0
    let errBytes = 0
    let truncated = false
    let killIssued = false

    const stdoutPipe = new PassThrough()
    const stderrPipe = new PassThrough()
    docker.modem.demuxStream(stream, stdoutPipe, stderrPipe)

    stdoutPipe.on('data', (chunk: Buffer) => {
      const room = opts.maxOutputBytes - outBytes
      if (room > 0) {
        const slice = chunk.length <= room ? chunk : chunk.subarray(0, room)
        outChunks.push(slice)
        outBytes += slice.length
      }
      if (chunk.length > room) {
        truncated = true
        if (!killIssued) {
          killIssued = true
          void this.killUser()
        }
      }
    })

    stderrPipe.on('data', (chunk: Buffer) => {
      if (errBytes >= maxStderr) return
      const slice = chunk.subarray(0, maxStderr - errBytes)
      errChunks.push(slice)
      errBytes += slice.length
    })

    const timedOut = await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (viaTimeout: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        // Cho các chunk đang trên đường về kịp cập nhật buffer.
        setTimeout(() => resolve(viaTimeout), 25)
      }
      const timer = setTimeout(() => {
        void this.killUser()
        finish(true)
      }, opts.wallDeadlineMs)

      stream.on('end', () => finish(false))
      stream.on('close', () => finish(false))
      stream.on('error', () => finish(true))

      // Bơm input rồi half-close: chương trình đọc tới EOF nhận được EOF thật.
      if (opts.stdin && opts.stdin.length > 0) stream.end(opts.stdin)
      else stream.end()
    })

    let execExitCode: number | null = null
    try {
      const info = await exec.inspect()
      execExitCode = typeof info.ExitCode === 'number' ? info.ExitCode : null
    } catch {
      execExitCode = null
    }

    const rawStderr = Buffer.concat(errChunks).toString('utf8')
    return {
      meta: timedOut ? null : parseMeta(rawStderr),
      stdout: Buffer.concat(outChunks),
      stderr: stripMeta(rawStderr),
      outputTruncated: truncated,
      timedOut,
      elapsedMs: Date.now() - started,
      execExitCode,
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.container.remove({ force: true })
    } catch {
      // Container có thể đã biến mất — không phải lỗi.
    }
  }

  /** Dòng `docker run` tương đương, để dán lại lúc debug (§3). */
  dockerRunHint(argv: string[]): string {
    const o = this.opts
    return [
      'docker run --rm -i --init --network none --read-only',
      `--tmpfs /w:rw,nosuid,nodev,size=64m,uid=1000,gid=0,mode=0775`,
      '--tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777',
      `--memory ${o.memoryMb}m --memory-swap ${o.memoryMb}m --cpus ${o.cpus ?? 1}`,
      `--pids-limit ${o.pidsLimit ?? 64} --ulimit nofile=64:64 --ulimit core=0:0`,
      '--cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add KILL',
      '--security-opt no-new-privileges:true --ipc none',
      `${o.image} ${argv.map((a) => (/[^\w./:=-]/.test(a) ? JSON.stringify(a) : a)).join(' ')}`,
    ].join(' ')
  }
}

/** Dọn container mồ côi của một worker (khởi động lại sau sự cố). */
export async function reapOrphanSandboxes(labelSelector = 'bcnjudge.sandbox=1'): Promise<number> {
  const list = await docker.listContainers({ all: true, filters: { label: [labelSelector] } })
  let removed = 0
  for (const info of list) {
    try {
      await docker.getContainer(info.Id).remove({ force: true })
      removed++
    } catch {
      // bỏ qua
    }
  }
  return removed
}
