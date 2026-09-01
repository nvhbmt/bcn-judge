#!/usr/bin/env node
/**
 * Hai ràng buộc bắt buộc của design.md §1, mã hoá hai sự cố production có thật
 * của imath-test. Cả hai ở mức LỖI — vi phạm thì exit khác 0.
 *
 *   1. `.tsx` dưới src/ không quá 250 dòng không-trắng. Component phình to là nơi
 *      lỗi trốn; cách xử đúng là tách tiếp, không phải nới trần.
 *   2. Không regex lookbehind `(?<=` / `(?<!`. Safari < 16.4 ném SyntaxError ngay
 *      lúc PARSE MODULE — giết cả chunk, try/catch không đỡ được. NFR-8 yêu cầu
 *      Safari iOS cũ vẫn đọc được đề.
 *
 * Tại sao là script chứ không phải ESLint rule: typescript-eslint chưa hỗ trợ
 * TypeScript 7 (issue #10940) nên không parser nào của nó nạp được. Ràng buộc thì
 * không đợi được — script này chạy hôm nay; khi typescript-eslint hỗ trợ TS 7 thì
 * chuyển hai hàm dưới đây thành rule là việc cơ học.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const MAX_TSX_LINES = 250
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'server'])
const LOOKBEHIND = /\(\?<[=!]/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (['.ts', '.tsx', '.js', '.mjs'].includes(extname(path))) out.push(path)
  }
  return out
}

const problems = []

for (const path of walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'tests')))) {
  const rel = relative(ROOT, path)
  const source = readFileSync(path, 'utf8')

  if (path.endsWith('.tsx') && !path.includes('/tests/') && !path.endsWith('.test.tsx')) {
    const lines = source.split('\n').filter((line) => line.trim().length > 0).length
    if (lines > MAX_TSX_LINES) {
      problems.push(`${rel}: ${lines} dòng không-trắng, vượt trần ${MAX_TSX_LINES} — tách component thay vì nới trần.`)
    }
  }

  source.split('\n').forEach((line, i) => {
    if (LOOKBEHIND.test(line)) {
      problems.push(`${rel}:${i + 1}: regex lookbehind — Safari < 16.4 ném SyntaxError lúc parse module.`)
    }
  })
}

if (problems.length > 0) {
  console.error('Vi phạm ràng buộc nguồn:\n')
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  console.error(`\n${problems.length} lỗi.`)
  process.exit(1)
}

console.log('✓ Ràng buộc nguồn: đạt (kích thước component, không lookbehind).')
