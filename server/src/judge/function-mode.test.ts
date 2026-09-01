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
    { name: lang.sourceFilename, content: harness },
    { name: lang.functionSourceFilename!, content: userSource },
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
