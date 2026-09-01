/**
 * Một bài có nhận được lượt chấm bằng ngôn ngữ này không.
 *
 * Sống ở tầng judge chứ không ở một file route, vì nó là LUẬT MIỀN chứ không phải
 * việc riêng của một endpoint — và vì đã có một lần nó chỉ được đặt ở đường member
 * rồi quên đường mentor: `POST /mentor/problems/:id/validate` xếp lượt validate chỉ
 * dựa vào `solution_language_id`, không kiểm bài dạng function có harness cho đúng
 * ngôn ngữ đó không. Kết quả đo được: bài function có harness cho c11, lời giải mẫu
 * viết python3 → route trả 201, worker ném `harness_missing`, mentor nhận IE và không
 * biết mình thiếu gì. Đúng chế độ hỏng mà FR-D6 nói phải loại bỏ, chỉ khác chỗ nó rơi
 * vào người duy nhất có quyền sửa.
 */
import { sql } from 'drizzle-orm'
import { q } from '../db/pool'

export async function languageAllowed(problemId: string, languageId: string): Promise<boolean> {
  const [row] = await q<{ allowed: boolean }>(sql`
    SELECT (
      l.enabled
      AND (p.allowed_language_ids IS NULL OR ${languageId} = ANY (p.allowed_language_ids))
      AND (
        p.kind <> 'function'
        OR (l.function_source_filename IS NOT NULL
            AND coalesce(btrim(p.harness ->> l.id), '') <> '')
      )
    ) AS allowed
    FROM problems p, languages l
    WHERE p.id = ${problemId} AND l.id = ${languageId}
  `)
  return row?.allowed === true
}
