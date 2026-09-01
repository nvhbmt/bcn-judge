/**
 * Bài dạng FUNCTION (kiểu LeetCode) chấm trên Docker thật.
 *
 *   bash scripts/build-runner-images.sh --all
 *   cd server && DOCKER=1 npx vitest run src/judge/function-mode.test.ts
 *
 * Bài mẫu là Two Sum: người học chỉ viết hàm `twoSum`, harness của mentor đọc
 * stdin, gọi hàm đó rồi in kết quả. Sau khi ghép, chương trình vẫn là stdin →
 * stdout như mọi bài stdio — đó chính là lý do không tầng nào bên dưới phải đổi.
 */
import { describe, expect, it } from 'vitest'
import { LANGUAGES, type LanguageConfig } from './languages'
import { judgeSubmission } from './runner'
import { DEFAULT_LIMITS, type SourceFile, type TestcaseInput } from './types'

const RUN_DOCKER = process.env.DOCKER === '1'

function tc(position: number, input: string, expected: string): TestcaseInput {
  return { position, isSample: position === 1, weight: 1, input: Buffer.from(input), expected: Buffer.from(expected) }
}

/** `[nums…] target` → chỉ số hai phần tử có tổng bằng target. */
const TESTCASES = [
  tc(1, '4\n2 7 11 15\n9\n', '0 1\n'),
  tc(2, '3\n3 2 4\n6\n', '1 2\n'),
  tc(3, '2\n3 3\n6\n', '0 1\n'),
]

interface Case {
  harness: string
  /** Lời giải đúng của người học — chỉ có hàm, không có main. */
  solution: string
  /** Lời giải sai: trả về chỉ số ngược, để chắc verdict WA đến từ hàm người học. */
  wrong: string
  /** Sai cú pháp — phải ra CE chứ không phải RE. */
  broken: string
}

const CASES: Partial<Record<keyof typeof LANGUAGES, Case>> = {
  c11: {
    harness: `#include <stdio.h>
#include <stdlib.h>
#include "solution.c"

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    int *a = malloc((size_t)n * sizeof(int));
    for (int i = 0; i < n; i++) scanf("%d", &a[i]);
    int target;
    scanf("%d", &target);
    int rn = 0;
    int *r = twoSum(a, n, target, &rn);
    for (int i = 0; i < rn; i++) printf("%d%s", r[i], i + 1 < rn ? " " : "");
    printf("\\n");
    return 0;
}
`,
    solution: `int *twoSum(int *nums, int n, int target, int *returnSize) {
    static int r[2];
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            if (nums[i] + nums[j] == target) { r[0] = i; r[1] = j; *returnSize = 2; return r; }
    *returnSize = 0;
    return r;
}
`,
    wrong: `int *twoSum(int *nums, int n, int target, int *returnSize) {
    static int r[2];
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            if (nums[i] + nums[j] == target) { r[0] = j; r[1] = i; *returnSize = 2; return r; }
    *returnSize = 0;
    return r;
}
`,
    broken: 'int *twoSum(int *nums, int n, int target, int *returnSize) { return 0\n}\n',
  },
  cpp17: {
    harness: `#include <bits/stdc++.h>
#include "solution.cpp"
using namespace std;

int main() {
    int n;
    if (!(cin >> n)) return 1;
    vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    int target;
    cin >> target;
    vector<int> r = twoSum(a, target);
    for (size_t i = 0; i < r.size(); i++) cout << (i ? " " : "") << r[i];
    cout << "\\n";
    return 0;
}
`,
    solution: `#include <vector>
std::vector<int> twoSum(std::vector<int>& nums, int target) {
    for (size_t i = 0; i < nums.size(); i++)
        for (size_t j = i + 1; j < nums.size(); j++)
            if (nums[i] + nums[j] == target) return {(int)i, (int)j};
    return {};
}
`,
    wrong: `#include <vector>
std::vector<int> twoSum(std::vector<int>& nums, int target) {
    for (size_t i = 0; i < nums.size(); i++)
        for (size_t j = i + 1; j < nums.size(); j++)
            if (nums[i] + nums[j] == target) return {(int)j, (int)i};
    return {};
}
`,
    broken: '#include <vector>\nstd::vector<int> twoSum(std::vector<int>& nums, int target) { return {}\n}\n',
  },
  python3: {
    harness: `import sys
from solution import Solution

data = sys.stdin.read().split()
n = int(data[0])
nums = [int(x) for x in data[1 : 1 + n]]
target = int(data[1 + n])
print(" ".join(str(x) for x in Solution().twoSum(nums, target)))
`,
    solution: `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i
        return []
`,
    wrong: `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [i, seen[target - x]]
            seen[x] = i
        return []
`,
    broken: 'class Solution:\n    def twoSum(self, nums, target)\n        return []\n',
  },
  java17: {
    harness: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        int n = s.nextInt();
        int[] a = new int[n];
        for (int i = 0; i < n; i++) a[i] = s.nextInt();
        int target = s.nextInt();
        int[] r = new Solution().twoSum(a, target);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < r.length; i++) { if (i > 0) sb.append(' '); sb.append(r[i]); }
        System.out.println(sb);
    }
}
`,
    solution: `public class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++)
            for (int j = i + 1; j < nums.length; j++)
                if (nums[i] + nums[j] == target) return new int[] { i, j };
        return new int[0];
    }
}
`,
    wrong: `public class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++)
            for (int j = i + 1; j < nums.length; j++)
                if (nums[i] + nums[j] == target) return new int[] { j, i };
        return new int[0];
    }
}
`,
    broken: 'public class Solution { public int[] twoSum(int[] nums, int target) { return new int[0] } }\n',
  },
  node20: {
    harness: `const { twoSum } = require("./solution.js");
const d = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
const n = d[0];
console.log(twoSum(d.slice(1, 1 + n), d[1 + n]).join(" "));
`,
    solution: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
  return [];
}
module.exports = { twoSum };
`,
    wrong: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [i, seen.get(target - nums[i])];
    seen.set(nums[i], i);
  }
  return [];
}
module.exports = { twoSum };
`,
    broken: 'function twoSum(nums, target) { return [ }\nmodule.exports = { twoSum };\n',
  },
}

/** Ghép file đúng như worker làm: harness chiếm điểm vào, người học ở file bên cạnh. */
function filesFor(lang: LanguageConfig, harness: string, userSource: string): SourceFile[] {
  return [
    { name: lang.sourceFilename, content: harness, owner: 'mentor' },
    { name: lang.functionSourceFilename!, content: userSource, owner: 'member' },
  ]
}

function langFor(id: keyof typeof LANGUAGES): LanguageConfig {
  const base = LANGUAGES[id]
  // Dạng function dùng lệnh biên dịch riêng khi có — đúng như toLanguageConfig().
  return { ...base, compileArgv: base.compileArgvFunction ?? base.compileArgv }
}

describe.skipIf(!RUN_DOCKER)('Bài dạng function (kiểu LeetCode)', () => {
  for (const [id, c] of Object.entries(CASES) as [keyof typeof LANGUAGES, Case][]) {
    const lang = langFor(id)

    it(`${id}: hàm đúng → AC trên cả 3 testcase`, async () => {
      const out = await judgeSubmission({
        language: lang,
        files: filesFor(lang, c.harness, c.solution),
        testcases: TESTCASES,
        limits: { ...DEFAULT_LIMITS, timeLimitMs: 5000 },
      })
      expect(out.compileOutput).not.toMatch(/error/i)
      expect(out.verdict).toBe('AC')
      expect(out.score).toBe(100)
    }, 120_000)

    it(`${id}: hàm sai → WA, và lỗi đến từ hàm người học chứ không phải harness`, async () => {
      const out = await judgeSubmission({
        language: lang,
        files: filesFor(lang, c.harness, c.wrong),
        testcases: TESTCASES,
        limits: { ...DEFAULT_LIMITS, timeLimitMs: 5000 },
      })
      expect(out.verdict).toBe('WA')
      // Trả chỉ số ngược nên sai ở đúng dòng đầu tiên của output.
      expect(out.results[0]?.firstDiffLine).toBe(1)
    }, 120_000)

    it(`${id}: hàm sai cú pháp → CE, không phải RE`, async () => {
      const out = await judgeSubmission({
        language: lang,
        files: filesFor(lang, c.harness, c.broken),
        testcases: TESTCASES,
        limits: { ...DEFAULT_LIMITS, timeLimitMs: 5000 },
      })
      // Điểm mấu chốt của compileArgvFunction: nếu chỉ kiểm file harness thì lỗi
      // cú pháp của người học rơi xuống lúc chạy và hiện thành RE khó hiểu.
      expect(out.verdict).toBe('CE')
      expect(out.compileOutput.length).toBeGreaterThan(0)
      expect(out.results).toHaveLength(0)
    }, 120_000)
  }

  it('CE của người học chỉ ra ĐÚNG file và ĐÚNG dòng họ viết', async () => {
    const lang = langFor('c11')
    const out = await judgeSubmission({
      language: lang,
      // Lỗi cú pháp cố ý ở dòng 3 của file người học.
      files: filesFor(lang, CASES.c11!.harness, '// dong 1\n// dong 2\nint *twoSum(int *a,int n,int t,int *rs){ return 0\n}\n'),
      testcases: TESTCASES,
      limits: { ...DEFAULT_LIMITS, timeLimitMs: 5000 },
    })

    expect(out.verdict).toBe('CE')
    expect(out.compileOutput).toContain('solution.c:3')
    // Đường dẫn trong container không có nghĩa gì với người học.
    expect(out.compileOutput).not.toContain('/w/')
  }, 120_000)

  it('lỗi nằm trong HARNESS: không lộ một dòng mã harness nào cho người học', async () => {
    const lang = langFor('c11')
    const harnessHong = `#include <stdio.h>
#include "solution.c"
int main(void) { int BI_MAT_CUA_MENTOR = 1 return 0; }
`
    const out = await judgeSubmission({
      language: lang,
      files: filesFor(lang, harnessHong, CASES.c11!.solution),
      testcases: TESTCASES,
      limits: { ...DEFAULT_LIMITS, timeLimitMs: 5000 },
    })

    expect(out.verdict).toBe('CE')
    // Trình biên dịch IN LẠI dòng nguồn gây lỗi — đó là đường rò mà bộ lọc chặn.
    expect(out.compileOutput).not.toContain('BI_MAT_CUA_MENTOR')
    expect(out.compileOutput).not.toContain('main.c')
    // Và nói rõ đây không phải lỗi của người học, thay vì để họ nhìn màn hình trống.
    expect(out.compileOutput).toMatch(/khung do người ra đề viết/)
  }, 120_000)

  it('mã người học KHÔNG đọc được harness lúc CHẠY (NFR-2)', async () => {
    // Bộ lọc log biên dịch chỉ chặn đường BIÊN DỊCH. Đường CHẠY từng để ngỏ: harness
    // nằm ở /w/main.c mode 0644, chương trình người học chạy với WorkingDir /w, nên
    // một `fopen` là đọc trọn. Với testcase MẪU thì stdout được trả về cho chính
    // member, nên không cần lượt nộp nào — "chạy thử" với input tự nhập là đủ.
    //
    // Đây là ca kiểm chạy THẬT qua judgeSubmission, khác với serialize/leak.test.ts:
    // bộ canary đó chỉ grep phản hồi API dựng từ dòng DB nó tự gieo, nên nó xanh suốt
    // trong khi lỗ này vẫn mở.
    const lang = langFor('c11')
    const BI_MAT = 'MENTOR_SECRET_BANG_TRA_CUU'
    const harness = CASES.c11!.harness.replace(
      '#include "solution.c"',
      `#include "solution.c"\n/* ${BI_MAT}: dap an la {11,22,33} */`,
    )
    const doLen = `int *twoSum(int *nums, int n, int target, int *returnSize) {
    FILE *fp = fopen("/w/main.c", "r");
    if (fp) { int ch; while ((ch = fgetc(fp)) != EOF) putchar(ch); fclose(fp); }
    static int r[2]; r[0] = 0; r[1] = 1; *returnSize = 2; return r;
}
`
    const out = await judgeSubmission({
      language: lang,
      files: filesFor(lang, harness, doLen),
      testcases: TESTCASES,
      limits: { ...DEFAULT_LIMITS, timeLimitMs: 5000 },
    })

    // Biên dịch phải THÀNH CÔNG — nếu CE thì test này không chứng minh được gì.
    expect(out.verdict).not.toBe('CE')
    expect(out.verdict).not.toBe('IE')
    const stdout = out.results.map((r) => r.stdout ?? '').join('\n')
    expect(stdout).not.toContain(BI_MAT)
    expect(stdout).not.toContain('int main(void)')
  }, 120_000)

  it('tên file nguồn có đường dẫn bị từ chối, không ghi ra ngoài /w', async () => {
    const lang = langFor('c11')
    await expect(
      judgeSubmission({
        language: { ...lang, sourceFilename: '../etc/passwd' },
        files: [{ name: '../etc/passwd', content: 'x' }],
        testcases: [TESTCASES[0]!],
        limits: DEFAULT_LIMITS,
      }),
    ).resolves.toMatchObject({ verdict: 'IE' })
  }, 60_000)
})
