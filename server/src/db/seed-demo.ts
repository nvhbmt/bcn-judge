/**
 * Dữ liệu mẫu để xem hệ thống lúc "có người dùng" — không phải seed sản xuất.
 *
 *   npm run db:seed:demo              # tạo dữ liệu, bài nộp ghi thẳng ở trạng thái done
 *   npm run db:seed:demo -- --judge   # thêm một ít bài pending để worker chấm thật
 *   npm run db:seed:demo -- --reset   # xoá sạch rồi tạo lại
 *
 * Mọi tài khoản mẫu dùng chung mật khẩu `matkhau123` và KHÔNG bắt đổi lần đầu, để
 * đăng nhập xem ngay. Vì vậy script từ chối chạy nếu DATABASE_URL trông giống
 * production.
 */
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { hashPassword } from '@/auth/hash'
import { config } from '@/config'
import { pool, q, qt, tx } from './pool'
import { seed as seedBase } from './seed'

const JUDGE_FOR_REAL = process.argv.includes('--judge')
const RESET = process.argv.includes('--reset')
const PASSWORD = 'matkhau123'

/** Ngẫu nhiên tất định: chạy lại cho ra đúng bộ dữ liệu cũ, dễ so sánh khi debug. */
let seedState = 20260901
function rnd(): number {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff
  return seedState / 0x7fffffff
}
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)]!
const chance = (p: number): boolean => rnd() < p
/** `now() - n giờ`; n âm là tương lai. make_interval() không suy được kiểu tham số bind. */
const hoursAgo = (n: number) => sql`now() - (${Math.round(n)}::int * interval '1 hour')`

// ── Nội dung ────────────────────────────────────────────────────────────────

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô']
const DEM = ['Văn', 'Thị', 'Hữu', 'Đức', 'Minh', 'Thanh', 'Quang', 'Hải', 'Thu', 'Xuân']
const TEN = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hùng', 'Khánh', 'Lâm', 'Mai',
  'Nam', 'Ngọc', 'Phong', 'Quân', 'Sơn', 'Thảo', 'Trang', 'Tuấn', 'Vy', 'Yến']

interface ProblemSeed {
  key: string
  title: string
  statementMd: string
  inputDescMd: string
  outputDescMd: string
  constraintsMd: string
  timeLimitMs: number
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  languageId: string
  solution: string
  /** [input, expected] — hai phần tử đầu thành testcase mẫu, còn lại là ẩn. */
  testcases: [string, string][]
}

const PROBLEMS: ProblemSeed[] = [
  {
    key: 'tong-hai-so',
    title: 'Tổng hai số',
    statementMd: 'Cho hai số nguyên $a$ và $b$. Hãy in ra tổng của chúng.',
    inputDescMd: 'Một dòng chứa hai số nguyên $a$ và $b$.',
    outputDescMd: 'Một số nguyên duy nhất là $a + b$.',
    constraintsMd: '$-10^9 \\le a, b \\le 10^9$',
    timeLimitMs: 1000,
    difficulty: 'easy',
    tags: ['nhập xuất'],
    languageId: 'c11',
    solution: `#include <stdio.h>

int main(void) {
    long long a, b;
    scanf("%lld %lld", &a, &b);
    printf("%lld\\n", a + b);
    return 0;
}
`,
    testcases: [
      ['3 5\n', '8\n'],
      ['-2 7\n', '5\n'],
      ['1000000000 1000000000\n', '2000000000\n'],
      ['0 0\n', '0\n'],
      ['-1000000000 -1000000000\n', '-2000000000\n'],
    ],
  },
  {
    key: 'uoc-chung-lon-nhat',
    title: 'Ước chung lớn nhất',
    statementMd:
      'Cho hai số nguyên dương $a$ và $b$, tìm ước chung lớn nhất $\\gcd(a, b)$.\n\n' +
      'Gợi ý: thuật toán Euclid — $\\gcd(a, b) = \\gcd(b, a \\bmod b)$.',
    inputDescMd: 'Một dòng chứa $a$ và $b$.',
    outputDescMd: 'Ước chung lớn nhất của $a$ và $b$.',
    constraintsMd: '$1 \\le a, b \\le 10^{18}$ — chú ý kiểu dữ liệu.',
    timeLimitMs: 1000,
    difficulty: 'easy',
    tags: ['số học'],
    languageId: 'python3',
    solution: `import math

a, b = map(int, input().split())
print(math.gcd(a, b))
`,
    testcases: [
      ['12 18\n', '6\n'],
      ['7 13\n', '1\n'],
      ['1000000000000000000 500000000000000000\n', '500000000000000000\n'],
      ['100 100\n', '100\n'],
    ],
  },
  {
    key: 'dem-uoc',
    title: 'Đếm ước số',
    statementMd: 'Cho số nguyên dương $n$. Đếm xem $n$ có bao nhiêu ước số dương.',
    inputDescMd: 'Một số nguyên dương $n$.',
    outputDescMd: 'Số lượng ước dương của $n$.',
    constraintsMd: '$1 \\le n \\le 10^{12}$ — duyệt tới $n$ chắc chắn quá thời gian.',
    timeLimitMs: 1000,
    difficulty: 'easy',
    tags: ['số học'],
    languageId: 'c11',
    solution: `#include <stdio.h>

int main(void) {
    long long n, cnt = 0;
    scanf("%lld", &n);
    for (long long i = 1; i * i <= n; i++)
        if (n % i == 0) cnt += (i * i == n) ? 1 : 2;
    printf("%lld\\n", cnt);
    return 0;
}
`,
    testcases: [
      ['12\n', '6\n'],
      ['1\n', '1\n'],
      ['36\n', '9\n'],
      ['999999999989\n', '2\n'],
      ['1000000000000\n', '169\n'],
    ],
  },
  {
    key: 'so-nguyen-to',
    title: 'Kiểm tra số nguyên tố',
    statementMd:
      'Cho $t$ truy vấn, mỗi truy vấn là một số $n$. Với mỗi số hãy cho biết nó có phải số nguyên tố hay không.',
    inputDescMd: 'Dòng đầu là $t$. $t$ dòng sau, mỗi dòng một số $n$.',
    outputDescMd: 'Mỗi truy vấn in `YES` nếu $n$ là số nguyên tố, ngược lại in `NO`.',
    constraintsMd: '$1 \\le t \\le 100$, $1 \\le n \\le 2 \\cdot 10^9$',
    timeLimitMs: 2000,
    difficulty: 'easy',
    tags: ['số học'],
    languageId: 'c11',
    solution: `#include <stdio.h>

int nguyen_to(long long n) {
    if (n < 2) return 0;
    for (long long i = 2; i * i <= n; i++)
        if (n % i == 0) return 0;
    return 1;
}

int main(void) {
    int t;
    scanf("%d", &t);
    while (t--) {
        long long n;
        scanf("%lld", &n);
        puts(nguyen_to(n) ? "YES" : "NO");
    }
    return 0;
}
`,
    testcases: [
      ['3\n2\n4\n17\n', 'YES\nNO\nYES\n'],
      ['1\n1\n', 'NO\n'],
      ['4\n999999937\n1000000000\n7919\n1\n', 'YES\nNO\nYES\nNO\n'],
      ['2\n2147483647\n4\n', 'YES\nNO\n'],
    ],
  },
  {
    key: 'chuoi-doi-xung',
    title: 'Chuỗi đối xứng',
    statementMd:
      'Cho một chuỗi $s$ chỉ gồm chữ cái thường. Kiểm tra xem $s$ có phải chuỗi đối xứng (palindrome) hay không, ' +
      'tức đọc xuôi và đọc ngược cho ra cùng một chuỗi.',
    inputDescMd: 'Một dòng chứa chuỗi $s$.',
    outputDescMd: 'In `YES` nếu $s$ đối xứng, ngược lại in `NO`.',
    constraintsMd: '$1 \\le |s| \\le 10^5$',
    timeLimitMs: 1000,
    difficulty: 'easy',
    tags: ['chuỗi'],
    languageId: 'python3',
    solution: `s = input().strip()
print("YES" if s == s[::-1] else "NO")
`,
    testcases: [
      ['aba\n', 'YES\n'],
      ['abc\n', 'NO\n'],
      ['a\n', 'YES\n'],
      ['abccba\n', 'YES\n'],
      ['abcabc\n', 'NO\n'],
    ],
  },
  {
    key: 'tong-day-con',
    title: 'Tổng đoạn con lớn nhất',
    statementMd:
      'Cho dãy $n$ số nguyên. Tìm tổng lớn nhất của một đoạn con **liên tiếp không rỗng**.\n\n' +
      'Ví dụ với dãy `-2 1 -3 4 -1`, đoạn tốt nhất là `4` với tổng bằng $4$.',
    inputDescMd: 'Dòng đầu là $n$, dòng sau là $n$ số nguyên.',
    outputDescMd: 'Tổng lớn nhất tìm được.',
    constraintsMd: '$1 \\le n \\le 2 \\cdot 10^5$, $|a_i| \\le 10^9$',
    timeLimitMs: 1000,
    difficulty: 'medium',
    tags: ['quy hoạch động'],
    languageId: 'cpp17',
    solution: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    scanf("%d", &n);
    long long best = LLONG_MIN, cur = 0;
    for (int i = 0; i < n; i++) {
        long long x;
        scanf("%lld", &x);
        cur = max(x, cur + x);
        best = max(best, cur);
    }
    printf("%lld\\n", best);
    return 0;
}
`,
    testcases: [
      ['5\n-2 1 -3 4 -1\n', '4\n'],
      ['3\n-5 -2 -9\n', '-2\n'],
      ['8\n-2 -3 4 -1 -2 1 5 -3\n', '7\n'],
      ['1\n-1000000000\n', '-1000000000\n'],
    ],
  },
  {
    key: 'day-con-tang',
    title: 'Dãy con tăng dài nhất',
    statementMd:
      'Cho dãy $a_1, a_2, \\dots, a_n$. Tìm độ dài dãy con tăng ngặt dài nhất.\n\n' +
      'Dãy con **không cần liên tiếp**, nhưng phải giữ nguyên thứ tự các phần tử.',
    inputDescMd: 'Dòng đầu là $n$. Dòng sau là $n$ số nguyên.',
    outputDescMd: 'Một số nguyên là độ dài dãy con tăng dài nhất.',
    constraintsMd: '$1 \\le n \\le 2 \\cdot 10^5$, $|a_i| \\le 10^9$ — cần thuật toán $O(n \\log n)$.',
    timeLimitMs: 2000,
    difficulty: 'medium',
    tags: ['quy hoạch động', 'tìm kiếm nhị phân'],
    languageId: 'cpp17',
    solution: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    vector<int> tails;
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        auto it = lower_bound(tails.begin(), tails.end(), x);
        if (it == tails.end()) tails.push_back(x);
        else *it = x;
    }
    printf("%zu\\n", tails.size());
    return 0;
}
`,
    testcases: [
      ['6\n1 3 2 4 3 5\n', '4\n'],
      ['1\n7\n', '1\n'],
      ['5\n5 4 3 2 1\n', '1\n'],
      ['8\n10 9 2 5 3 7 101 18\n', '4\n'],
      ['4\n2 2 2 2\n', '1\n'],
    ],
  },
  {
    key: 'sap-xep-diem',
    title: 'Xếp hạng điểm thi',
    statementMd:
      'Cho $n$ bạn, mỗi bạn có tên và điểm. Hãy in danh sách theo điểm **giảm dần**; ' +
      'nếu bằng điểm thì xếp theo tên **tăng dần** theo thứ tự từ điển.',
    inputDescMd: 'Dòng đầu là $n$. $n$ dòng sau, mỗi dòng gồm tên (không chứa dấu cách) và điểm.',
    outputDescMd: '$n$ dòng, mỗi dòng là tên và điểm sau khi đã sắp xếp.',
    constraintsMd: '$1 \\le n \\le 10^5$, điểm nguyên $0 \\le p \\le 100$',
    timeLimitMs: 2000,
    difficulty: 'medium',
    tags: ['sắp xếp'],
    languageId: 'python3',
    solution: `import sys

data = sys.stdin.read().split()
n = int(data[0])
rows = [(data[1 + 2 * i], int(data[2 + 2 * i])) for i in range(n)]
rows.sort(key=lambda r: (-r[1], r[0]))
print("\\n".join(f"{name} {score}" for name, score in rows))
`,
    testcases: [
      ['3\nan 8\nbinh 9\nchi 8\n', 'binh 9\nan 8\nchi 8\n'],
      ['1\nnam 0\n', 'nam 0\n'],
      ['4\nz 10\na 10\nm 5\nb 5\n', 'a 10\nz 10\nb 5\nm 5\n'],
      ['5\nk 100\nj 100\ni 0\nh 50\ng 50\n', 'j 100\nk 100\ng 50\nh 50\ni 0\n'],
    ],
  },
]

const problemByKey = new Map(PROBLEMS.map((p) => [p.key, p]))

/** Lời giải sai điển hình, để bài nộp hỏng trông giống lỗi người thật hay mắc. */
const WRONG_SOLUTIONS: Record<string, { languageId: string; source: string }[]> = {
  'tong-hai-so': [
    { languageId: 'c11', source: '#include <stdio.h>\n\n/* int tràn khi a + b vượt 2^31 */\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}\n' },
  ],
  'dem-uoc': [
    { languageId: 'c11', source: '#include <stdio.h>\n\n/* duyệt tới n — quá thời gian với n lớn */\nint main(void) {\n    long long n, c = 0;\n    scanf("%lld", &n);\n    for (long long i = 1; i <= n; i++)\n        if (n % i == 0) c++;\n    printf("%lld\\n", c);\n    return 0;\n}\n' },
  ],
  'day-con-tang': [
    { languageId: 'python3', source: 'n = int(input())\na = list(map(int, input().split()))\n# đếm số phần tử phân biệt, không phải dãy con tăng\nprint(max(1, len(set(a))))\n' },
  ],
  'chuoi-doi-xung': [
    { languageId: 'python3', source: 's = input()\n# quên strip(), ký tự xuống dòng làm lệch so sánh\nprint("YES" if s == s[::-1] else "NO")\n' },
  ],
  'tong-day-con': [
    { languageId: 'cpp17', source: '#include <bits/stdc++.h>\nusing namespace std;\n\n/* best = 0 nên dãy toàn số âm ra sai */\nint main() {\n    int n;\n    scanf("%d", &n);\n    long long best = 0, cur = 0;\n    for (int i = 0; i < n; i++) {\n        long long x;\n        scanf("%lld", &x);\n        cur = max(0LL, cur + x);\n        best = max(best, cur);\n    }\n    printf("%lld\\n", best);\n    return 0;\n}\n' },
  ],
}

const BROKEN_SOURCE = '#include <stdio.h>\n\nint main(void) {\n    int a, b\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}\n'

interface CourseSeed {
  code: string
  name: string
  descriptionMd: string
  sections: { title: string; items: ({ lesson: string; body: string } | { problem: string })[] }[]
}

const COURSES: CourseSeed[] = [
  {
    code: 'c-co-ban-k12',
    name: 'C cơ bản — khoá 12',
    descriptionMd:
      '## Mục tiêu\n\nLàm quen cú pháp C, đọc ghi dữ liệu chuẩn, vòng lặp và mảng.\n\n' +
      'Mỗi tuần một buổi lý thuyết kèm 2–3 bài tập. Bài tập **bắt buộc AC** trước buổi kế tiếp.',
    sections: [
      {
        title: 'Chương 1 — Nhập xuất và biểu thức',
        items: [
          {
            lesson: 'Đọc và ghi dữ liệu chuẩn',
            body:
              'Chương trình trên hệ thống chấm đọc từ **stdin** và in ra **stdout** — không đọc ghi file.\n\n' +
              '```c\n#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}\n```\n\n' +
              'Nhớ dùng `long long` với `%lld` khi giá trị có thể vượt $2 \\cdot 10^9$. ' +
              'Đây là lỗi phổ biến nhất ở bài đầu tiên: `int` tràn thành số âm mà chương trình vẫn chạy bình thường.',
          },
          { problem: 'tong-hai-so' },
          { problem: 'uoc-chung-lon-nhat' },
        ],
      },
      {
        title: 'Chương 2 — Vòng lặp và số học',
        items: [
          {
            lesson: 'Độ phức tạp và vòng lặp',
            body:
              'Một vòng lặp chạy $n$ bước với $n = 10^{12}$ thì **không bao giờ** kịp trong 1 giây.\n\n' +
              'Với bài đếm ước, duyệt tới $\\sqrt{n}$ là đủ: mỗi ước $i \\le \\sqrt{n}$ luôn đi kèm một ước $n / i$. ' +
              'Nhớ trừ trường hợp $i \\times i = n$ để khỏi đếm hai lần.',
          },
          { problem: 'dem-uoc' },
          { problem: 'so-nguyen-to' },
        ],
      },
      {
        title: 'Chương 3 — Chuỗi (đang soạn)',
        items: [{ problem: 'chuoi-doi-xung' }],
      },
    ],
  },
  {
    code: 'thuat-toan-k12',
    name: 'Thuật toán cơ bản — khoá 12',
    descriptionMd:
      '## Nội dung\n\nQuy hoạch động nhập môn, sắp xếp và tìm kiếm nhị phân.\n\n' +
      'Yêu cầu: đã hoàn thành khoá **C cơ bản**.',
    sections: [
      {
        title: 'Chương 1 — Quy hoạch động nhập môn',
        items: [
          {
            lesson: 'Bài toán đoạn con lớn nhất',
            body:
              'Ý tưởng Kadane: gọi $f_i$ là tổng lớn nhất của đoạn con **kết thúc tại** $i$.\n\n' +
              '$$f_i = \\max(a_i,\\; f_{i-1} + a_i)$$\n\n' +
              'Đáp án là $\\max_i f_i$. Độ phức tạp $O(n)$, bộ nhớ $O(1)$.\n\n' +
              'Bẫy hay gặp: khởi tạo `best = 0`. Khi cả dãy toàn số âm, đáp án đúng là số âm lớn nhất ' +
              'chứ không phải $0$ — vì đề yêu cầu đoạn con **không rỗng**.',
          },
          { problem: 'tong-day-con' },
          { problem: 'day-con-tang' },
        ],
      },
      {
        title: 'Chương 2 — Sắp xếp',
        items: [{ problem: 'sap-xep-diem' }],
      },
    ],
  },
]

// ── Dựng dữ liệu ────────────────────────────────────────────────────────────

function assertSafeDatabase(): void {
  const url = config.databaseUrl
  if (!/localhost|127\.0\.0\.1|test|demo|dev/i.test(url)) {
    throw new Error(
      `Từ chối tạo dữ liệu mẫu trên database trông giống production: ${url}\n` +
        'Mọi tài khoản mẫu dùng chung một mật khẩu công khai — chỉ chạy trên máy dev.',
    )
  }
}

async function makeUsers(): Promise<{ mentors: string[]; members: { id: string; name: string }[] }> {
  const { hash, algo } = await hashPassword(PASSWORD)

  const mentors: string[] = []
  for (const [i, name] of ['Nguyễn Minh Trí', 'Trần Thu Hà', 'Lê Quang Huy'].entries()) {
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO users (email, display_name, role, password_hash, hash_algo, must_change_password)
      VALUES (${`mentor${i + 1}@bcn.local`}, ${name}, 'mentor', ${hash}, ${algo}, false)
      ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id
    `)
    mentors.push(row!.id)
  }

  const members: { id: string; name: string }[] = []
  const used = new Set<string>()
  for (let i = 1; i <= 32; i++) {
    let name = `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`
    while (used.has(name)) name = `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`
    used.add(name)
    // Người cuối bị khoá sẵn, để thử nhánh từ chối đăng nhập (FR-A4).
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO users (email, display_name, role, password_hash, hash_algo, must_change_password, disabled)
      VALUES (${`member${i}@bcn.local`}, ${name}, 'member', ${hash}, ${algo}, false, ${i === 32})
      ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, disabled = EXCLUDED.disabled
      RETURNING id
    `)
    members.push({ id: row!.id, name })
  }
  return { mentors, members }
}

async function makeProblems(createdBy: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  for (const p of PROBLEMS) {
    const examples = p.testcases.slice(0, 2).map(([input, output]) => ({ input, output }))
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO problems (title, statement_md, input_desc_md, output_desc_md, constraints_md,
                            examples, time_limit_ms, memory_limit_mb, difficulty, tags,
                            solution_language_id, solution_source, created_by,
                            testcase_rev, validated_testcase_rev, validated_at)
      VALUES (${p.title}, ${p.statementMd}, ${p.inputDescMd}, ${p.outputDescMd}, ${p.constraintsMd},
              ${JSON.stringify(examples)}::jsonb, ${p.timeLimitMs}, 256, ${p.difficulty},
              -- Template sql không dựng nổi mảng Postgres từ mảng JS; đi vòng qua jsonb.
              ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.tags)}::jsonb)),
              ${p.languageId}, ${p.solution}, ${createdBy}, 1, 1, now())
      RETURNING id
    `)
    const problemId = row!.id
    ids.set(p.key, problemId)

    for (const [i, [input, expected]] of p.testcases.entries()) {
      const inputBuf = Buffer.from(input, 'utf8')
      const expectedBuf = Buffer.from(expected, 'utf8')
      await q(sql`
        INSERT INTO testcases (problem_id, position, kind, weight, input, expected,
                               input_bytes, expected_bytes, input_sha256)
        VALUES (${problemId}, ${i + 1}, ${i < 2 ? 'sample' : 'hidden'}, 1, ${inputBuf}, ${expectedBuf},
                ${inputBuf.length}, ${expectedBuf.length}, ${createHash('sha256').update(inputBuf).digest()})
      `)
    }
  }
  return ids
}

interface CourseBuilt {
  courseId: string
  name: string
  /** Chỉ những mục đã publish — mục nháp không nhận bài nộp. */
  itemsByProblem: Map<string, string>
}

async function makeCourses(
  problemIds: Map<string, string>,
  mentors: string[],
  members: { id: string }[],
): Promise<CourseBuilt[]> {
  const out: CourseBuilt[] = []

  for (const [ci, course] of COURSES.entries()) {
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO courses (code, name, description_md, status, created_by)
      VALUES (${course.code}, ${course.name}, ${course.descriptionMd}, 'open', ${mentors[0]})
      RETURNING id
    `)
    const courseId = row!.id

    // Mentor 1 phụ trách mọi khoá, mentor 2 và 3 chia nhau — để thấy hai phạm vi quyền khác nhau.
    for (const mentorId of [mentors[0]!, mentors[ci + 1] ?? mentors[1]!]) {
      await q(sql`
        INSERT INTO course_mentors (course_id, user_id, assigned_by)
        VALUES (${courseId}, ${mentorId}, ${mentors[0]})
        ON CONFLICT DO NOTHING
      `)
    }

    // Khoá 1 cả lớp; khoá 2 chỉ 2/3 đầu, để còn người "chưa ghi danh" mà thử nhánh 403.
    const enrolled = ci === 0 ? members : members.slice(0, Math.floor((members.length * 2) / 3))
    for (const m of enrolled) {
      await q(sql`
        INSERT INTO course_enrollments (course_id, user_id, enrolled_by)
        VALUES (${courseId}, ${m.id}, ${mentors[0]})
        ON CONFLICT DO NOTHING
      `)
    }

    const itemsByProblem = new Map<string, string>()
    for (const [si, section] of course.sections.entries()) {
      const [sec] = await q<{ id: string }>(sql`
        INSERT INTO sections (course_id, title, position) VALUES (${courseId}, ${section.title}, ${si + 1})
        RETURNING id
      `)
      for (const [ii, item] of section.items.entries()) {
        if ('lesson' in item) {
          await q(sql`
            INSERT INTO items (section_id, kind, title, position, status, lesson_body_md)
            VALUES (${sec!.id}, 'lesson', ${item.lesson}, ${ii + 1}, 'published', ${item.body})
          `)
          continue
        }
        // Chương cuối của khoá 1 để nháp — kiểm chứng mục nháp không lộ với member.
        const draft = ci === 0 && si === course.sections.length - 1
        // Chương cuối của khoá 2 đã XUẤT BẢN nhưng hẹn giờ mở — hai trạng thái rất
        // khác nhau mà màn hình từng nói bằng cùng một khoảng trống. Có dòng này thì
        // trạng thái "🔒 mở DD/MM HH:MM" mới xem được trên dữ liệu mẫu.
        const hengio = ci === 1 && si === course.sections.length - 1
        const problemId = problemIds.get(item.problem)!
        const [it] = await q<{ id: string }>(sql`
          INSERT INTO items (section_id, kind, title, position, status, problem_id, visible_from)
          VALUES (${sec!.id}, 'problem', ${problemByKey.get(item.problem)!.title}, ${ii + 1},
                  ${draft ? 'draft' : 'published'}, ${problemId},
                  ${hengio ? sql`now() + interval '5 days'` : sql`NULL`})
          RETURNING id
        `)
        if (!draft && !hengio) itemsByProblem.set(item.problem, it!.id)
      }
    }
    out.push({ courseId, name: course.name, itemsByProblem })
  }
  return out
}

async function makeTeams(members: { id: string; name: string }[], courseId: string): Promise<number> {
  const names = ['Nhóm Alpha', 'Nhóm Beta', 'Nhóm Gamma', 'Nhóm Delta', 'Nhóm Epsilon']
  const size = 6
  let created = 0

  for (const [ti, name] of names.entries()) {
    const group = members.slice(ti * size, (ti + 1) * size)
    if (group.length < 2) break
    const leader = group[0]!
    // Composite FK (id, leader_id) → team_members là DEFERRABLE INITIALLY DEFERRED,
    // nên team và thành viên bắt buộc nằm chung một transaction (ADR-14).
    await tx(async (t) => {
      const [team] = await qt<{ id: string }>(t, sql`
        INSERT INTO teams (name, description_md, leader_id, course_id, created_by)
        VALUES (${name}, ${`Nhóm sinh hoạt hằng tuần. Leader: ${leader.name}.`},
                ${leader.id}, ${courseId}, ${leader.id})
        RETURNING id
      `)
      for (const m of group) {
        await qt(t, sql`
          INSERT INTO team_members (team_id, user_id, added_by)
          VALUES (${team!.id}, ${m.id}, ${leader.id})
        `)
      }
    })
    created++
  }
  return created
}

interface ContestBuilt {
  id: string
  title: string
  /** Số giờ TRƯỚC hiện tại của mốc bắt đầu/kết thúc; số âm nghĩa là còn ở tương lai. */
  startedHoursAgo: number
  endedHoursAgo: number
  problems: { contestProblemId: string; problemId: string; key: string }[]
}

async function makeContests(
  problemIds: Map<string, string>,
  courseId: string,
  mentorId: string,
): Promise<ContestBuilt[]> {
  const plans = [
    { title: 'Contest tuần 35 — đã kết thúc', start: 14 * 24, end: 7 * 24, freeze: 0, seq: false,
      keys: ['tong-hai-so', 'dem-uoc', 'chuoi-doi-xung'] },
    { title: 'Contest tuần 36 — đang diễn ra', start: 2 * 24, end: -5 * 24, freeze: 60, seq: false,
      keys: ['uoc-chung-lon-nhat', 'tong-day-con', 'day-con-tang'] },
    { title: 'Contest tuần 37 — sắp diễn ra', start: -5 * 24, end: -12 * 24, freeze: 0, seq: true,
      keys: ['so-nguyen-to', 'sap-xep-diem'] },
  ]
  const out: ContestBuilt[] = []

  for (const plan of plans) {
    const [row] = await q<{ id: string }>(sql`
      INSERT INTO contests (course_id, title, description_md, start_at, end_at, status,
                            penalty_minutes, sequential, freeze_minutes, created_by)
      VALUES (${courseId}, ${plan.title},
              ${'Mỗi bài tối đa 100 điểm, chấm theo tỉ lệ testcase đúng. ' +
                'Chỉ bài nộp trong khung thời gian mới tính vào bảng xếp hạng.'},
              ${hoursAgo(plan.start)}, ${hoursAgo(plan.end)}, 'published',
              20, ${plan.seq}, ${plan.freeze}, ${mentorId})
      RETURNING id
    `)
    const problems: ContestBuilt['problems'] = []
    for (const [i, key] of plan.keys.entries()) {
      const problemId = problemIds.get(key)!
      const [cp] = await q<{ id: string }>(sql`
        INSERT INTO contest_problems (contest_id, problem_id, position, label, max_score)
        VALUES (${row!.id}, ${problemId}, ${i + 1}, ${String.fromCharCode(65 + i)}, 100)
        RETURNING id
      `)
      problems.push({ contestProblemId: cp!.id, problemId, key })
    }
    out.push({ id: row!.id, title: plan.title, startedHoursAgo: plan.start, endedHoursAgo: plan.end, problems })
  }
  return out
}

interface SubmissionPlan {
  userId: string
  key: string
  problemId: string
  itemId: string | null
  contestId: string | null
  contestProblemId: string | null
  at: number
  /** Lần nộp thứ mấy của người này cho bài này — lần sau xác suất AC cao hơn. */
  tryIndex: number
}

/** Ghi thẳng một bài nộp đã chấm xong, kèm kết quả từng testcase. */
async function insertJudged(plan: SubmissionPlan): Promise<void> {
  const problem = problemByKey.get(plan.key)!
  const total = problem.testcases.length
  const wrongPool = WRONG_SOLUTIONS[plan.key]

  // Nộp lại thì khá hơn — người ta sửa bài chứ không nộp mù.
  let verdict: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE'
  let passed: number
  let source: string
  let languageId: string

  if (chance(0.35 + plan.tryIndex * 0.3)) {
    verdict = 'AC'
    passed = total
    source = problem.solution
    languageId = problem.languageId
  } else if (chance(0.12)) {
    verdict = 'CE'
    passed = 0
    source = BROKEN_SOURCE
    languageId = 'c11'
  } else if (wrongPool) {
    const wrong = pick(wrongPool)
    verdict = plan.key === 'dem-uoc' ? 'TLE' : 'WA'
    passed = 1 + Math.floor(rnd() * Math.max(1, total - 2))
    source = wrong.source
    languageId = wrong.languageId
  } else {
    verdict = pick(['WA', 'RE'] as const)
    passed = Math.floor(rnd() * (total - 1))
    source = problem.solution.replace('return 0;', 'return 3;')
    languageId = problem.languageId
  }

  const timeMs = verdict === 'TLE' ? problem.timeLimitMs + Math.floor(rnd() * 400) : 4 + Math.floor(rnd() * 90)
  const memoryKb = 2048 + Math.floor(rnd() * 6144)
  const ce = verdict === 'CE'

  const [row] = await q<{ id: string }>(sql`
    INSERT INTO submissions (kind, user_id, problem_id, item_id, contest_id, contest_problem_id,
                             language_id, source, source_bytes, status, verdict,
                             passed_weight, total_weight, time_ms_max, memory_kb_max,
                             compile_output, testcase_rev, attempt,
                             received_at, started_at, finished_at, queued_ms, judge_ms, worker_id)
    VALUES ('submit', ${plan.userId}, ${plan.problemId}, ${plan.itemId}, ${plan.contestId},
            ${plan.contestProblemId}, ${languageId}, ${source}, ${Buffer.byteLength(source)},
            'done', ${verdict},
            ${ce ? 0 : passed}, ${total},
            ${ce ? null : timeMs}, ${ce ? null : memoryKb},
            ${ce ? "main.c: In function 'main':\nmain.c:5:5: error: expected ';' before 'scanf'" : null},
            1, 1,
            ${hoursAgo(plan.at)}, ${hoursAgo(plan.at)}, ${hoursAgo(plan.at - 1)},
            ${Math.floor(rnd() * 600)}, ${250 + Math.floor(rnd() * 900)}, 'seed-demo')
    RETURNING id
  `)
  if (ce) return

  for (let i = 0; i < total; i++) {
    const ok = i < passed
    const tcVerdict = ok ? 'AC' : verdict
    await q(sql`
      INSERT INTO submission_results (submission_id, attempt, position, is_sample, verdict,
                                      time_ms, memory_kb, exit_code, term_signal, detail,
                                      stdout, mentor_stdout, first_diff_line)
      VALUES (${row!.id}, 1, ${i + 1}, ${i < 2}, ${tcVerdict},
              ${ok ? 4 + Math.floor(rnd() * 60) : timeMs}, ${memoryKb},
              ${tcVerdict === 'RE' ? 1 : 0}, ${tcVerdict === 'RE' ? 11 : null},
              ${tcVerdict === 'RE' ? 'signal_11' : tcVerdict === 'TLE' ? 'timeout' : null},
              ${i < 2 ? (ok ? problem.testcases[i]![1] : 'sai\n') : null},
              ${ok ? problem.testcases[i]![1] : 'sai\n'},
              ${tcVerdict === 'WA' ? 1 : null})
    `)
  }
}

/**
 * Chạy lại mà không --reset sẽ đâm vào unique key giữa chừng, sau khi đã tạo
 * một mớ bài trùng. Chặn ngay từ đầu, trước bất kỳ lệnh ghi nào.
 */
async function assertNotAlreadySeeded(): Promise<void> {
  const [row] = await q<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM courses WHERE code IN (${COURSES[0]!.code}, ${COURSES[1]!.code})
  `)
  if (row!.n > 0) {
    throw new Error(
      'Database đã có dữ liệu mẫu. Chạy lại với --reset để xoá sạch rồi tạo lại:\n' +
        '  npm run db:seed:demo -- --reset',
    )
  }
}

async function main(): Promise<void> {
  assertSafeDatabase()
  if (!RESET) await assertNotAlreadySeeded()

  if (RESET) {
    console.log('==> Xoá sạch dữ liệu cũ')
    const { rows } = await pool.query<{ list: string | null }>(`
      SELECT string_agg(quote_ident(tablename), ', ') AS list
      FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_migrations'
    `)
    if (rows[0]?.list) await pool.query(`TRUNCATE TABLE ${rows[0].list} RESTART IDENTITY CASCADE`)
  }

  console.log('==> Nền: ngôn ngữ, settings, admin')
  await seedBase(() => {})

  console.log('==> Tài khoản')
  const { mentors, members } = await makeUsers()
  console.log(`    ${mentors.length} mentor · ${members.length} member (member32 bị khoá sẵn)`)

  console.log('==> Bài tập và testcase')
  const problemIds = await makeProblems(mentors[0]!)
  const tcCount = PROBLEMS.reduce((n, p) => n + p.testcases.length, 0)
  console.log(`    ${problemIds.size} bài · ${tcCount} testcase (2 mẫu mỗi bài, còn lại ẩn) · đã validate`)

  console.log('==> Khoá học')
  const courses = await makeCourses(problemIds, mentors, members)
  for (const c of courses) console.log(`    ${c.name} — ${c.itemsByProblem.size} bài đã publish`)

  console.log('==> Nhóm')
  const teamCount = await makeTeams(members, courses[0]!.courseId)
  console.log(`    ${teamCount} nhóm, mỗi nhóm 6 người, người đầu danh sách làm leader`)

  console.log('==> Contest')
  const contests = await makeContests(problemIds, courses[0]!.courseId, mentors[0]!)
  for (const ct of contests) console.log(`    ${ct.title} — ${ct.problems.length} bài`)

  console.log('==> Bài nộp')
  const plans: SubmissionPlan[] = []

  // Bài nộp trong khoá: càng đầu danh sách càng chăm, để bảng xếp hạng có độ dốc thật.
  for (const [ci, course] of courses.entries()) {
    for (const [key, itemId] of course.itemsByProblem) {
      for (const [mi, member] of members.entries()) {
        const diligence = 1 - mi / members.length
        if (!chance(0.15 + diligence * 0.7)) continue
        const tries = 1 + Math.floor(rnd() * 3)
        const base = 24 * (2 + Math.floor(rnd() * 18)) + ci * 12
        for (let t = 0; t < tries; t++) {
          plans.push({
            userId: member.id, key, problemId: problemIds.get(key)!, itemId,
            contestId: null, contestProblemId: null, at: base - t * 2, tryIndex: t,
          })
        }
      }
    }
  }

  // Bài nộp contest — chỉ hai contest đã bắt đầu, và mốc nhận PHẢI nằm trong cửa sổ,
  // nếu không truy vấn xếp hạng loại hết (FR-I4) và bảng trông rỗng.
  for (const contest of contests) {
    if (contest.startedHoursAgo <= 0) continue
    const windowHours = contest.startedHoursAgo - Math.max(0, contest.endedHoursAgo)
    for (const cp of contest.problems) {
      for (const [mi, member] of members.entries()) {
        if (!chance(0.55 - mi / (members.length * 2))) continue
        const tries = 1 + Math.floor(rnd() * 2)
        for (let t = 0; t < tries; t++) {
          // Lùi 1 giờ khỏi hai đầu cửa sổ cho chắc chắn nằm trong.
          const offset = 1 + rnd() * (windowHours - 2)
          plans.push({
            userId: member.id, key: cp.key, problemId: cp.problemId, itemId: null,
            contestId: contest.id, contestProblemId: cp.contestProblemId,
            at: contest.startedHoursAgo - offset, tryIndex: t,
          })
        }
      }
    }
  }

  // Cũ trước mới sau, để seq tăng dần theo thời gian đúng như hệ thống thật.
  plans.sort((a, b) => b.at - a.at)
  for (const plan of plans) await insertJudged(plan)
  console.log(`    ${plans.length} bài nộp đã chấm (AC/WA/TLE/RE/CE trộn lẫn)`)

  if (JUDGE_FOR_REAL) {
    let queued = 0
    for (const course of courses) {
      for (const [key, itemId] of course.itemsByProblem) {
        const problem = problemByKey.get(key)!
        for (const member of members.slice(0, 5)) {
          await q(sql`
            INSERT INTO submissions (kind, user_id, problem_id, item_id, language_id,
                                     source, source_bytes, status)
            VALUES ('submit', ${member.id}, ${problemIds.get(key)}, ${itemId}, ${problem.languageId},
                    ${problem.solution}, ${Buffer.byteLength(problem.solution)}, 'pending')
          `)
          queued++
        }
      }
    }
    console.log(`    + ${queued} bài đang pending — bật worker để xem chấm trực tiếp`)
  }

  // Ghi chú của leader, để trang Nhóm có nội dung thật (FR-J6).
  const teams = await q<{ id: string; leaderId: string }>(sql`
    SELECT id, leader_id AS "leaderId" FROM teams ORDER BY name LIMIT 2
  `)
  const NOTES = [
    'Tuần này còn 2 bài chưa AC, cố gắng xong trước buổi thứ Sáu nhé.',
    'Bài "Dãy con tăng dài nhất" nên dùng tìm kiếm nhị phân, cách duyệt bậc hai sẽ TLE ở test lớn.',
    'Em nộp tốt lắm, tuần sau thử làm thêm phần nâng cao trong contest.',
  ]
  let noteCount = 0
  for (const team of teams) {
    const mates = await q<{ userId: string }>(sql`
      SELECT user_id AS "userId" FROM team_members
      WHERE team_id = ${team.id} AND user_id <> ${team.leaderId} LIMIT 2
    `)
    for (const [i, m] of mates.entries()) {
      await q(sql`
        INSERT INTO team_notes (team_id, author_id, target_user_id, body, created_at, read_at)
        VALUES (${team.id}, ${team.leaderId}, ${m.userId}, ${NOTES[noteCount % NOTES.length]},
                ${hoursAgo(10 + noteCount * 26)}, ${i === 0 ? null : sql`now()`})
      `)
      noteCount++
    }
  }
  console.log(`    ${noteCount} ghi chú của leader`)

  const [stat] = await q<{ total: number; ac: number; users: number }>(sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE verdict = 'AC')::int AS ac,
           count(DISTINCT user_id)::int AS users
    FROM submissions
  `)

  console.log(`
──────────────────────────────────────────────────────────────
Xong: ${stat!.total} bài nộp của ${stat!.users} người, ${stat!.ac} lượt AC.

Đăng nhập thử:
  Admin    ${config.seedAdminEmail}   / ${config.seedAdminPassword}   (bị bắt đổi mật khẩu)
  Mentor   mentor1@bcn.local    / ${PASSWORD}   (phụ trách cả hai khoá)
  Leader   member1@bcn.local    / ${PASSWORD}   (leader Nhóm Alpha)
  Member   member9@bcn.local    / ${PASSWORD}
  Bị khoá  member32@bcn.local   / ${PASSWORD}   (thử nhánh từ chối đăng nhập)

Chỗ đáng xem: tiến độ trong trang khoá học, Bảng xếp hạng trên thanh icon,
"Contest tuần 36" đang diễn ra (đóng băng 60 phút cuối), trang Nhóm của member1.
`)
}

await main()
await pool.end()
