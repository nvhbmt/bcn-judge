# Kế hoạch: so sánh lời giải · điểm theo độ khó & BXH gộp contest · tự khoá khi rời Discord

| | |
|---|---|
| Ngày | 08/09/2026 |
| Nguồn | Ba mục "chưa làm" trong lượt rà thắc mắc của BCN (xem cuối `README.md` §Trạng thái) |
| Trạng thái | Đang triển khai theo thứ tự 3 → 2a → 2b → 1a → 1b; mỗi phần một commit lên `main`, có test canh. **Cả năm phần xong 08/09/2026.** |
| Ước lượng | ≈ 9–10 ngày công, thứ tự đề xuất: Phần 3 → 2a → 2b → 1a → 1b |

Bốn quyết định cần BCN chốt nằm ở mục **0**. Không mục nào chặn việc bắt đầu phần 3.

---

## 0. Cần BCN chốt

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| Q1 | Điểm tối đa theo độ khó: Dễ / Trung bình / Khó / Chưa đặt = ? | **100 / 150 / 200 / 100**, chỉnh được ở trang Cài đặt |
| Q2 | Khi bài khó đáng nhiều điểm hơn, BXH khoá và BXH toàn ban xếp theo **tổng điểm trước** (như contest) hay giữ **số bài AC trước** (FR-G6 hiện tại)? | **Tổng điểm trước** — giữ AC-trước thì 10 bài dễ vẫn thắng 8 bài khó, hệ số thành vô nghĩa. Cần sửa FR-G6 lên v0.8. |
| Q3 | Lời giải AC của member cho người khác xem: **mặc định chia sẻ, ai không muốn thì tắt** (opt-out) hay **mặc định ẩn, ai muốn thì bật** (opt-in)? | **Opt-out** — ban nội bộ 120 người, mục tiêu là học lẫn nhau; opt-in thì tab trống suốt tháng đầu. |
| Q4 | Tự khoá khi rời Discord áp cho **chỉ tài khoản do cổng Discord sinh ra** (không mật khẩu) hay **cả tài khoản admin cấp tay**? | **Chỉ tài khoản do cổng sinh** — đúng chính sách hiện có (`README.md` §Đăng nhập bằng Discord); mentor rời server không bị mất tài khoản. Có cờ cài đặt để mở rộng sau. |

---

## 1. So sánh lời giải + tab Thống kê của bài

### Hiện trạng đã đo

- Member chỉ đọc được bài nộp **của mình** (`server/src/routes/member/submissions.ts` — mọi query đều `user_id = me`).
- `serialize/problem.ts` có `mayMemberSeeSolution()` cho FR-D7 (mở lời giải mẫu sau AC / sau contest) nhưng **không route nào gọi**, và `MemberProblemView.solutionSource` khai kiểu `never` — tức lời giải mẫu chưa bao giờ tới member dù mentor có chọn "mở sau AC".
- Thảo luận (`routes/member/discussions.ts`) đã có cổng "chỉ ai đã AC" (`hasAced`) — dùng lại cho lời giải.
- Thống kê: mentor có `GET /api/mentor/contests/:id/stats`; **không** có thống kê cấp bài cho member. `design.md` §5 ghi tab Thống kê chỉ dành cho mentor với `GET /api/mentor/problems/:id/stats` — endpoint đó cũng chưa có.
- Thanh icon: `src/pages/workspace/rail.tsx` có ba biến thể rail (thường / có Thảo luận / bài đọc). Contest dùng rail thường (không Thảo luận).

### 1a. Tab Thống kê (FR-E3) — ≈ 1,5 ngày

**Phạm vi dữ liệu**

- Ngữ cảnh khoá (`itemId`): mọi bài nộp `submit` đã chấm xong của `problem_id` đó, **mọi ngữ cảnh** (khoá khác, contest đã qua) — nhiều dữ liệu hơn, và bài dùng chung thì thống kê chung.
- Ngữ cảnh contest (`contestProblemId`): chỉ bài nộp của contest đó **trong cửa sổ** — khớp standings. Không lộ gì mới: standings đã cho biết ai AC.
- Không có tên người. Chỉ số gộp.

**Server** — file mới `server/src/routes/member/stats.ts`, mount `member.route('/stats', …)` trong `app.ts` (tên riêng, tránh đụng thứ tự với `/problems`).

```
GET /api/member/stats/problem?itemId=… | contestProblemId=…
→ {
    submissions: 412,             // tổng lượt nộp
    users: 61,                    // số người đã nộp
    solvedUsers: 48,              // số người có ≥ 1 AC
    verdicts: { AC: 190, WA: 140, TLE: 40, MLE: 2, RE: 30, CE: 10 },
    languages: [{ id: 'c11', count: 300 }, …],
    time: { p50: 12, p90: 95, buckets: [{ upToMs: 10, count: 9 }, …] },  // theo bài AC TỐT NHẤT mỗi người
    mine: { bestTimeMs: 8, bestMemoryKb: 1200, fasterThanPct: 87 } | null
  }
```

- Quyền: đi qua `resolveAccess()` của `routes/member/access.ts` y như `/api/member/problems`.
- "Tốt nhất mỗi người" = `DISTINCT ON (user_id)` bài AC có `time_ms_max` nhỏ nhất; `fasterThanPct` = `count(peers có time > mine) / count(peers) × 100`.
- Bucket thời gian: 8 mốc cố định theo `time_limit_ms` của bài (1/64 … 1/1 giới hạn), để biểu đồ đọc được ngay cả khi mọi bài đều 5 ms.
- Cache 15 s (cùng hạng BXH khoá, ADR-9).

**SPA**

- `rail.tsx`: thêm key `'thong-ke'` (icon `BarChart3`) vào `RAIL_ITEMS` gốc → có ở cả khoá lẫn contest; không thêm vào rail bài đọc.
- `src/pages/workspace/stats/StatsPanel.tsx` + `VerdictBars.tsx` + `TimeHistogram.tsx` (mỗi file ≤ 250 dòng). Thanh ngang xếp chồng bằng div + token màu verdict đã có ở `design-system/`, **không** thêm thư viện chart. Dòng "Bạn: 8 ms · nhanh hơn 87 % người đã AC" nổi bằng moss như mọi chỗ đánh dấu "mình".
- Invalidate `['stats', handle]` khi verdict của mình về (cùng chỗ đang invalidate bài nộp).

**Test**

- `server/src/routes/stats.test.ts` (INTEGRATION): đếm đúng theo verdict; một người nộp 5 lần chỉ tính 1 trong `users`/`solvedUsers`; `run` và `pending` không tính; contest chỉ tính trong cửa sổ; chưa ghi danh → 404; `mine` null khi chưa AC.
- `tests/pages/workspace/StatsPanel.test.tsx`: render ba trạng thái (rỗng / có dữ liệu / có "mình").
- e2e `member.spec.ts`: bấm icon Thống kê → panel hiện số lượt nộp.

### 1b. Xem và so sánh lời giải — ≈ 3 ngày

**Luật truy cập (server là cổng, UI chỉ che)**

1. Chỉ người **đã AC bài** (kind `submit`) hoặc mentor/admin. Dùng lại `hasAced` — chuyển nó ra `routes/member/solved.ts` để thảo luận và lời giải dùng chung một hàm.
2. **Cấm vận contest**: nếu `problem_id` đang nằm trong một contest `published` có `now()` trong `[start_at, end_at)` thì **mọi người** (kể cả người AC qua khoá) bị 403 `contest_embargo` kèm `until`. Chặt hơn thảo luận hiện tại — và **áp luôn cho thảo luận** (một lỗ đang mở: AC qua khoá rồi đọc thảo luận trong lúc contest dùng chung bài).
3. Chỉ hiện **bài AC tốt nhất của mỗi người** (AC, `time_ms_max` nhỏ nhất, rồi sớm nhất). Không hiện WA/TLE của ai cả.
4. Tôn trọng `users.share_solutions` (Q3). Mentor/admin vẫn thấy hết qua đường mentor sẵn có — cờ này chỉ chi phối đường member.

**Schema** — migration `0008_share_solutions.sql`, chỉ-additive:

```sql
ALTER TABLE users ADD COLUMN share_solutions boolean NOT NULL DEFAULT true;
```

**Server**

- File mới `routes/member/solutions.ts`, mount `/solutions`:

```
GET /api/member/solutions?itemId=…|contestProblemId=…&languageId=&sort=time|memory|recent
→ { canAccess, reason: null | 'not_solved' | 'contest_embargo', embargoUntil,
    mine:      { id, languageId, timeMsMax, memoryKbMax, sourceBytes } | null,
    reference: { languageId, source } | null,      // FR-D7 — nối lại mayMemberSeeSolution()
    peers:    [{ id, authorName, avatarUrl, languageId, timeMsMax, memoryKbMax, sourceBytes, receivedAt }] }

GET /api/member/solutions/:submissionId  → { …meta, source }   // source chỉ trả ở chi tiết
PATCH /auth/me { shareSolutions }                               // công tắc ở /tai-khoan
```

- `serialize/submission.ts`: thêm `PeerSubmissionView` với `results?: never`, `compileOutput?: never`, `stdout?: never`, `stderr?: never` — và thêm ca vào `serialize/leak.test.ts`.
- `serialize/problem.ts`: thêm `ReferenceSolutionView` riêng; **giữ** `solutionSource: never` trên `MemberProblemView` — lời giải mẫu đi đường riêng, không đi kèm đề.
- `hasAc` cho `mayMemberSeeSolution` lấy từ `hasAced`; `contestEnded` từ `resolveAccess().contestEndAt`.

**SPA**

- `rail.tsx`: key `'loi-giai'` (icon `Lightbulb`), nằm cạnh Thảo luận. Hiện khi **không phải contest** hoặc **contest đã kết thúc** (`WorkspacePage` đã biết phase). Trong contest đang diễn ra không hiện — giống Thảo luận.
- `src/pages/workspace/solutions/`:
  - `SolutionsPanel.tsx` — ba trạng thái: chưa giải (khoá + câu "Giải được bài này rồi mới xem lời giải người khác"), cấm vận (đếm ngược tới `until`), mở.
  - `ReferenceCard.tsx` — lời giải mẫu của mentor (nếu bài cho phép), CodeMirror readOnly.
  - `PeerList.tsx` — bảng: tên · ngôn ngữ · thời gian · bộ nhớ · dung lượng; lọc ngôn ngữ, sắp xếp; hàng của mình nổi moss.
  - `CompareView.tsx` — **so sánh**: hai cột CodeMirror readOnly (trái: bài của tôi, phải: bài đang chọn), đầu cột là 3 số đo; dưới 900 px xếp dọc. Nút "Nạp vào editor" cho bài của người khác **không có** — tránh biến thành nút chép.
- `/tai-khoan`: công tắc "Cho thành viên khác xem lời giải AC của tôi".

**Test**

- `routes/solutions.test.ts`: chưa AC → `canAccess=false` và `peers=[]` (không rò một byte); đã AC → chỉ AC, một dòng mỗi người, đúng bài tốt nhất; `share_solutions=false` biến mất khỏi danh sách nhưng chính chủ vẫn thấy `mine`; cấm vận khi bài nằm trong contest đang mở (kể cả người AC qua khoá); ba chế độ `solution_visibility`; `GET /:id` của người tắt chia sẻ → 404.
- `discussions.test.ts`: thêm ca cấm vận contest.
- SPA: `SolutionsPanel` ba trạng thái, `CompareView` render hai cột.
- e2e `full-flow.spec.ts`: hai member cùng AC → người thứ hai mở Lời giải, thấy bài của người thứ nhất, bấm So sánh.

---

## 2. Điểm theo độ khó cho bài luyện + BXH gộp contest

### Hiện trạng đã đo

- Công thức điểm bài luyện nằm **một chỗ**: `bestSubmissions()` trong `routes/member/syllabus.ts` (`passed/total × 100`). Bốn nơi dùng lại: BXH khoá, BXH toàn ban (`leaderboard.ts`), team (`teams.ts`), ma trận tiến độ mentor (`mentor/progress.ts`). Không có bảng điểm — dẫn xuất on-demand (ADR-9).
- Điểm contest tính riêng trong `contest/standings.ts` (`ratio × max_score`, đóng băng theo `cutoffFor`). BXH toàn ban cố ý **không** trộn contest (chú thích đầu `BXHPage.tsx`).
- `problems.difficulty` là `easy | medium | hard | null`; khoá C cơ bản đã gán 42 / 31 / 6.
- Settings (`lib/settings.ts`) là nơi đặt mọi hằng số cấu hình; trang Cài đặt tự hiện khoá mới trong nhóm "Khác" (`settingsMeta.ts`).

### 2a. Điểm theo độ khó — ≈ 1,5 ngày

**Quyết định thiết kế**: hệ số theo độ khó đặt ở **settings**, **không** thêm cột điểm cho từng bài/mục.

- 79 bài hiện có nhận điểm mới ngay, mentor không phải nhập lại gì.
- Cột `max_score` riêng từng mục là bước sau nếu thật sự cần (ví dụ bài thưởng), không làm bây giờ.

**Settings** — thêm vào `JudgeSettings` + `DEFAULTS` + zod của `PATCH /api/admin/settings` + `settingsMeta.ts` nhóm mới "Điểm bài luyện":

| khoá | mặc định |
|---|---|
| `points_easy` | 100 |
| `points_medium` | 150 |
| `points_hard` | 200 |
| `points_unset` | 100 |

**Công thức** — sửa **đúng một chỗ**, `bestSubmissions()`:

```sql
JOIN problems p ON p.id = s.problem_id
…
ROUND(s.passed_weight::numeric / NULLIF(s.total_weight, 0) * pts.max_points, 2) AS points,
pts.max_points
-- pts = CASE p.difficulty WHEN 'easy' THEN (SELECT …'points_easy') … ELSE points_unset END,
--       đọc từ bảng settings ngay trong câu SQL (COALESCE về mặc định) → builder vẫn đồng bộ,
--       bốn nơi gọi không phải đổi chữ ký.
```

- `scoreOf()` trong serializer **giữ nguyên thang 0–100** cho một bài nộp (phần trăm testcase đúng). "Điểm" chỉ đổi ở tầng tiến độ/BXH.
- Thứ tự xếp hạng (Q2): đổi `ORDER BY` của BXH khoá, BXH toàn ban và team sang `totalPoints DESC, acCount DESC, lastGain ASC` — trùng contest. Nếu BCN giữ AC-trước thì bỏ bước này.

**API/SPA** — thêm `maxPoints` để màn hình nói "120 / 150 đ":

- `syllabus` item: `points`, `maxPoints`; `ProblemView`: `maxPoints` (từ difficulty + settings) → `StatementPanel` hiện "150 điểm" cạnh chip độ khó.
- 8 file hiện điểm: `course/SyllabusList`, `course/CourseSide` (tổng đạt / tổng có thể), `home/CourseStandings`, `workspace/LeaderboardPanel`, `leaderboard/{types,LeaderboardTable,Podium}`, `team/TeamStandings`. Mentor progress và team progress đi qua `bestSubmissions` nên tự đổi.
- Trang Trợ giúp (`HelpPanel.tsx`): thêm một câu về thang điểm theo độ khó.

**Test**

- `leaderboard.test.ts`, `courses.test.ts`: 1 AC khó (200) xếp trên 1 AC dễ + 1 AC trung bình một phần; đổi settings → điểm đổi theo (không cần chấm lại — bằng chứng cho ADR-9); `difficulty NULL` → `points_unset`.
- `serialize/submission.test.ts`: `scoreOf` vẫn 0–100.
- SPA: định dạng "x / max đ".

**Tài liệu**: `requirements.md` FR-F2 thêm câu "điểm tích luỹ = tỉ lệ × điểm tối đa theo độ khó", FR-G6 đổi thứ tự (v0.8); `design.md` §2.7 cập nhật công thức.

### 2b. BXH gộp contest — ≈ 1,5 ngày

**Ngữ nghĩa**

- Trang `/bang-xep-hang` thêm trục thứ ba **Nguồn điểm**: *Bài luyện* · *Contest* · *Tổng hợp* (mặc định **Tổng hợp**). Hai trục cũ (Cá nhân/Team × Tuần/Tháng/Toàn thời gian) giữ nguyên.
- Điểm contest của một người = tổng `totalPoints` của họ trong **từng contest** `published`, đã bắt đầu, tính bằng đúng công thức standings (`ratio × max_score`, bài tốt nhất mỗi bài trong cửa sổ, **tôn trọng mốc đóng băng** như member đang thấy).
- Contest thuộc kỳ nào: theo **`end_at`** — contest kết thúc trong tuần này tính cho tuần này; contest đang diễn ra (`end_at` ở tương lai) cũng tính vào kỳ hiện tại. Điểm bài luyện vẫn theo `received_at` như cũ.
- Hạng Tổng hợp: `totalPoints DESC, (acLuyện + acContest) DESC, lastGain ASC`.
- Panel BXH ở trang chủ / workspace / team **không đổi** — chúng theo khoá hoặc theo contest, đã đúng phạm vi.

**Server**

- `contest/standings.ts`: tách phần CTE `scored` thành builder `contestBestSubmissions({ contestId?: string, since?: SQL })` với mốc cắt tính trong SQL:
  `s.received_at < LEAST(win.end_at, CASE WHEN win.freeze_minutes > 0 AND now() < win.end_at THEN win.end_at - win.freeze_minutes * interval '1 minute' ELSE 'infinity' END)`.
  `computeStandings` dùng lại builder này (mentor truyền `cutoff='infinity'` như cũ) → một công thức, hai chỗ dùng.
- `routes/member/leaderboard.ts`: thêm `source=practice|contest|total` (mặc định `total`), CTE `contest_best` từ builder trên, gộp theo user/team. Response thêm `practicePoints`, `contestPoints`, `contestAcCount`; `totalPoints` là tổng theo `source`.

**SPA**

- `BXHPage.tsx`: `TabBar` thứ ba; mô tả đầu trang đổi thành "Cộng điểm bài luyện và contest…".
- `LeaderboardTable.tsx`: ở *Tổng hợp* hiện ba cột Luyện · Contest · Tổng; ở hai chế độ kia giữ một cột điểm.
- `Podium.tsx`: dòng phụ "luyện 820 · contest 300" khi ở Tổng hợp.
- Xoá chú thích "KHÔNG trộn điểm contest" đầu file `BXHPage.tsx` — nó sẽ nói dối.

**Test**

- `leaderboard.test.ts`: contest kết thúc 10 ngày trước không vào "tuần này" nhưng vào "tháng này"/toàn thời gian; contest đang đóng băng → điểm sau mốc băng chưa tính; contest `draft` không tính; `source=practice` cho kết quả **y hệt** trước khi sửa (bảo vệ hồi quy); team = tổng thành viên.
- `contests.test.ts`: standings không đổi sau refactor (chạy lại bộ hiện có là đủ).
- SPA: ba tab, ba cột.

---

## 3. Tự khoá tài khoản khi bị kick khỏi Discord

### Hiện trạng đã đo

- Cổng guild (`auth/discordRoutes.ts`) chỉ kiểm **lúc đăng nhập bằng Discord**, bằng **token của chính người dùng** (`fetchGuildMember` gọi `/users/@me/guilds/{id}/member`). Không lưu refresh token → không thể tự kiểm lại sau đó bằng token của họ.
- Phiên sống `SESSION_TTL_DAYS` = 30 ngày. Khoá tài khoản (`disabled=true`) đã có sẵn cơ chế cắt phiên `revokeAllSessionsOf()` và `resolveSession()` từ chối user `disabled`.
- Worker (`worker.ts`) là **tiến trình đơn** với các timer 10 s / 60 s / 1 giờ — chỗ hợp lý để treo một việc quét nền (API chạy hai bản blue/green nên không đặt ở đó).

### Cơ chế — ≈ 1,5 ngày

**Chọn**: **quét định kỳ bằng Bot token** qua REST `GET /guilds/{id}/members?limit=1000` (một request mỗi lượt), mặc định 10 phút một lần. **Chạy trong API, không phải worker** (đổi so với bản nháp): biến `DISCORD_*` chỉ nằm ở `.env.api`, và chỉ role Postgres của API có quyền `UPDATE users`; hai bản blue/green giành `pg_try_advisory_lock` nên không quét đôi.

| Phương án | Độ trễ | Thêm gì | Kết luận |
|---|---|---|---|
| A. Bot Gateway (websocket, `GUILD_MEMBER_REMOVE`) | tức thì | kết nối thường trực + thư viện `discord.js` + intent riêng | Bước sau, nếu 10 phút là quá chậm. Dùng chung hàm khoá bên dưới. |
| **B. Quét REST định kỳ bằng Bot token** | ≤ 10 phút | 1 biến env, 0 thư viện | **Chọn** |
| C. Kiểm lại bằng token người dùng ở mỗi request | — | phải lưu refresh token | Không làm: lưu thêm bí mật để đổi lấy thứ B đã đủ |

Bot cần: tạo Bot trong cùng Application ở Developer Portal → bật **Server Members Intent** (guild < 100 server không cần duyệt) → mời vào server với scope `bot`, **không** quyền gì. Ghi vào `README.md` §Discord và `docs/deploy.md`.

**Cấu hình** (`config.ts`, `.env.example`, `.env.worker`):

| biến | mặc định | ý nghĩa |
|---|---|---|
| `DISCORD_BOT_TOKEN` | rỗng | rỗng = không quét |
| `DISCORD_KICK_SWEEP_MINUTES` | 10 | 0 = tắt |

Quét chỉ chạy khi `guildGateOn()` **và** có bot token — thiếu một là tắt hẳn, log một dòng lúc khởi động (cùng kỷ luật "thiếu cấu hình thì tắt, không chạy nửa vời" của `discordEnabled()`).

**Ai bị khoá** (Q4): tài khoản có `discord_id` **và** `password_hash IS NULL` — đúng tập mà cổng đang cai quản. Mất role khi có `DISCORD_ROLE_ID` cũng tính là "rời" (cùng luật `thieu_vai_tro`). Cờ settings `discord_kick_locks_password_accounts` (mặc định `false`) để mở rộng sang tài khoản admin cấp nếu BCN muốn sau này.

**Schema** — migration `0009_auto_lock.sql`, chỉ-additive:

```sql
ALTER TABLE users ADD COLUMN disabled_reason text;      -- 'admin' | 'discord_kick'
ALTER TABLE users ADD COLUMN disabled_at timestamptz;
```

Route khoá tay của admin (`routes/admin/users.ts`) ghi `disabled_reason='admin'` từ nay.

**Luồng** — file mới `server/src/auth/discordSweep.ts`:

1. `fetchGuildMemberIds(botToken, guildId)` → `Set<discordId>` kèm role; phân trang bằng `after` nếu > 1000.
2. `diffKicked(accounts, guildMembers, roleId)` — **hàm thuần**, test đơn vị.
3. Với mỗi tài khoản bị kick: `UPDATE users SET disabled=true, disabled_reason='discord_kick', disabled_at=now()` + `revokeAllSessionsOf()` + `audit(null, 'user.auto_lock', …, { discordId, guildId })`.
4. Ghi kết quả lượt quét vào `settings` khoá `discord_sweep_last` = `{ at, checked, locked, error }` để trang quản trị hiện.

**Lan can an toàn** — cùng triết lý với cổng ("lỗi mạng không được mở toang cũng không được báo oan"):

- Discord trả lỗi / 401 / 403 (thiếu intent) / 429 / mạng hỏng → **bỏ lượt**, log rõ, **không khoá ai**.
- Danh sách trả về rỗng → coi là lỗi, bỏ lượt.
- Một lượt định khoá **> 50 %** số tài khoản do cổng sinh → **huỷ lượt**, log cảnh báo (chống danh sách thiếu trang).
- Không bao giờ **xoá** — chỉ `disabled`; bài nộp, tiến độ giữ nguyên (FR-A4).

**Vào lại server → mở lại**: trong callback Discord, sau khi cổng cho qua, nếu `disabled && disabled_reason = 'discord_kick'` → `disabled=false`, audit `user.auto_unlock`, đăng nhập tiếp. `disabled_reason='admin'` **không** tự mở — admin khoá thì admin mở.

**Giao diện**

- Màn đăng nhập: mã lỗi mới `roi_server` → "Tài khoản bị khoá vì bạn đã rời server Discord của ban. Vào lại server rồi đăng nhập bằng Discord."
- `/quan-tri/tai-khoan`: nhãn "Khoá tự động · rời Discord · 08/09 14:10" thay cho "Đã khoá" chung chung.
- `/quan-tri` (Tình trạng chấm) hoặc Cài đặt: dòng "Quét Discord lần cuối: 14:10 · 118 tài khoản · khoá 1".

**Test**

- Đơn vị `discordSweep.test.ts`: `diffKicked` với các ca còn/mất/mất role/tài khoản có mật khẩu; mock `fetch` như `discordGuild.test.ts` đang làm.
- Tích hợp: khoá → phiên bị thu hồi, có dòng audit, `resolveSession` trả null; API lỗi → không đổi gì; quá 50 % → huỷ; vào lại + đăng nhập Discord → mở lại; khoá bởi admin → không mở.
- e2e không cần: không có luồng trình duyệt mới ngoài thông báo đăng nhập (thêm một ca vào `auth.spec.ts` cho mã `roi_server`).

---

## 4. Thứ tự và cột mốc

| Bước | Việc | Ngày | Điều kiện xong |
|---|---|---|---|
| 1 | Phần 3 — quét Discord | 1,5 | test xanh; chạy thử trên server Discord thật của ban với 1 tài khoản kick/vào lại |
| 2 | 2a — điểm theo độ khó | 1,5 | BXH khoá C đổi thứ hạng đúng như bảng tay; `source=practice` khớp số cũ |
| 3 | 2b — BXH gộp contest | 1,5 | tuần có contest: tổng = luyện + contest; đóng băng được tôn trọng |
| 4 | 1a — tab Thống kê | 1,5 | panel hiện ở khoá và contest; "nhanh hơn X %" khớp SQL tay |
| 5 | 1b — lời giải & so sánh | 3 | leak test xanh; cấm vận contest áp cho cả thảo luận |
| | **Tổng** | **9** | + 1 ngày đệm cho lint 250 dòng và e2e |

Mỗi bước: cập nhật `README.md` §Trạng thái và `requirements.md` (v0.8: FR-F2, FR-G6, FR-D7 nối lại, FR-E3 tab Thống kê, mục mới FR-K "Lời giải chia sẻ", FR-A6 "tự khoá theo Discord").

## 5. Ngoài phạm vi (ghi để khỏi trôi)

- Diff màu giữa hai lời giải (chỉ đặt cạnh nhau ở bản này).
- Phát hiện trùng code (FR-G7, mức C) — dữ liệu "bài AC tốt nhất mỗi người" của 1b là đầu vào sẵn cho việc này sau.
- Điểm tối đa riêng cho từng mục/bài (chỉ làm khi hệ số theo độ khó tỏ ra không đủ).
- Bot Gateway thời gian thực cho Discord.
