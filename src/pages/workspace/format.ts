/**
 * Định dạng số đo của một lượt chấm — dùng chung cho mọi chỗ hiện thời gian và bộ nhớ.
 *
 * Trước đây `formatMemory` được chép ba bản (bảng kết quả, chi tiết testcase, lịch sử
 * nộp) và một biến thể thứ tư viết thẳng trong tab stdin. Bốn bản không giống nhau: bản
 * stdin làm tròn về MB nguyên nên 1,7 MB hiện thành "2 MB", còn hai bản kia ra "1.7 MB".
 * Cùng một lượt chấm, đọc ở hai tab ra hai con số — đó là lỗi, không phải khác biệt về
 * phong cách.
 */

/**
 * KB → chuỗi đọc được. Dưới 1 MB thì GIỮ đơn vị KB: "0.0 MB" không nói gì về một chương
 * trình đang chạy. Chưa đo được thì "—", không phải 0 — 0 là một phép đo.
 */
export function formatMemory(kb: number | null | undefined): string {
  if (kb === null || kb === undefined) return '—'
  return kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`
}

/**
 * ms → chuỗi. Cùng lý do với bộ nhớ: chưa đo được thì "—", không phải "0 ms".
 *
 * Tên là `formatDuration` chứ không phải `formatTime`: đây là KHOẢNG chạy của chương
 * trình, khác hẳn giờ nộp bài mà `SubmissionsPanel` vẫn tự định dạng riêng.
 */
export function formatDuration(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? '—' : `${ms} ms`
}
