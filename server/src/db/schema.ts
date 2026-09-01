/**
 * Schema Drizzle (design.md §2). Quy ước copy từ imath-test:
 * id text pk mặc định gen_random_uuid()::text, citext cho email/code, timestamptz
 * mọi nơi, soft delete bằng deleted_at, enum = cột text + CHECK.
 *
 * SQL DDL nằm ở drizzle/0001_init.sql (viết tay: có composite FK deferrable, partial
 * index, trigger append-only mà drizzle-kit không sinh được — design.md ADR-14, §2.6).
 * Hai file phải khớp nhau; `npm run db:check` so lại bằng cách migrate rồi truy vấn.
 */
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const citext = customType<{ data: string }>({ dataType: () => 'citext' })
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })
const inet = customType<{ data: string }>({ dataType: () => 'inet' })

const id = () => text('id').primaryKey().default(sql`gen_random_uuid()::text`)
/** timestamptz NOT NULL DEFAULT now() — luôn truyền TÊN CỘT thật, đừng hardcode. */
const ts = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow()
const createdAt = () => ts('created_at')
const updatedAt = () => ts('updated_at')

// ─────────────────────────────────────────────────────────── §2.1 Danh tính & phiên

export const users = pgTable(
  'users',
  {
    id: id(),
    email: citext('email').notNull(),
    username: citext('username'),
    displayName: text('display_name').notNull(),
    role: text('role').notNull(), // admin | mentor | member
    passwordHash: text('password_hash'),
    hashAlgo: text('hash_algo'),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    totpSecret: text('totp_secret'),
    disabled: boolean('disabled').notNull().default(false),
    createdAt: createdAt(),
    lastLogin: timestamp('last_login', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email), uniqueIndex('users_username_key').on(t.username), index('users_role_idx').on(t.role)],
)

export const userSessions = pgTable(
  'user_sessions',
  {
    tokenHash: bytea('token_hash').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ip: inet('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('user_sessions_user_idx').on(t.userId)],
)

// ────────────────────────────────────────────────────────── §2.2 Khoá học & nội dung

export const courses = pgTable(
  'courses',
  {
    id: id(),
    code: citext('code').notNull(),
    name: text('name').notNull(),
    descriptionMd: text('description_md'),
    status: text('status').notNull().default('draft'), // draft | open | archived
    selfEnroll: boolean('self_enroll').notNull().default(false),
    createdBy: text('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('courses_code_key').on(t.code), index('courses_status_idx').on(t.status)],
)

export const courseMentors = pgTable(
  'course_mentors',
  {
    courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    assignedBy: text('assigned_by').references(() => users.id),
    assignedAt: ts('assigned_at'),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.userId] }), index('course_mentors_user_idx').on(t.userId)],
)

export const courseEnrollments = pgTable(
  'course_enrollments',
  {
    id: id(),
    courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'), // active | removed
    enrolledBy: text('enrolled_by').references(() => users.id),
    enrolledAt: ts('enrolled_at'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => [unique('course_enrollments_course_user_key').on(t.courseId, t.userId), index('course_enrollments_user_idx').on(t.userId, t.status)],
)

export const sections = pgTable(
  'sections',
  {
    id: id(),
    courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: integer('position').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sections_course_pos_idx').on(t.courseId, t.position)],
)

export const items = pgTable(
  'items',
  {
    id: id(),
    sectionId: text('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // lesson | problem
    title: text('title').notNull(),
    position: integer('position').notNull(),
    status: text('status').notNull().default('draft'), // draft | published
    visibleFrom: timestamp('visible_from', { withTimezone: true }),
    lessonBodyMd: text('lesson_body_md'),
    problemId: text('problem_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('items_section_pos_idx').on(t.sectionId, t.position), index('items_problem_idx').on(t.problemId)],
)

// ────────────────────────────────────────────────────── §2.3 Ngân hàng bài & testcase

export const problems = pgTable(
  'problems',
  {
    id: id(),
    title: text('title').notNull(),
    /** stdio = chương trình trọn vẹn; function = chỉ một hàm, ghép với harness. */
    kind: text('kind').notNull().default('stdio'),
    /** {languageId: harness}. CHỈ mentor đọc — xem serialize/problem.ts. */
    harness: jsonb('harness').notNull().default(sql`'{}'::jsonb`),
    statementMd: text('statement_md').notNull(),
    inputDescMd: text('input_desc_md'),
    outputDescMd: text('output_desc_md'),
    constraintsMd: text('constraints_md'),
    examples: jsonb('examples').notNull().default(sql`'[]'::jsonb`),
    timeLimitMs: integer('time_limit_ms'),
    memoryLimitMb: integer('memory_limit_mb'),
    difficulty: text('difficulty'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    allowedLanguageIds: text('allowed_language_ids').array(),
    compareMode: text('compare_mode').notNull().default('trim'),
    floatEps: doublePrecision('float_eps'),
    starterCode: jsonb('starter_code').notNull().default(sql`'{}'::jsonb`),
    solutionLanguageId: text('solution_language_id'),
    solutionSource: text('solution_source'),
    solutionVisibility: text('solution_visibility').notNull().default('mentor'),
    testcaseRev: integer('testcase_rev').notNull().default(1),
    validatedTestcaseRev: integer('validated_testcase_rev'),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    scopeCourseId: text('scope_course_id').references(() => courses.id),
    createdBy: text('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('problems_scope_idx').on(t.scopeCourseId)],
)

export const testcases = pgTable(
  'testcases',
  {
    id: id(),
    problemId: text('problem_id').notNull().references(() => problems.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    kind: text('kind').notNull(), // sample | hidden
    weight: integer('weight').notNull().default(1),
    input: bytea('input').notNull(),
    expected: bytea('expected'),
    inputBytes: integer('input_bytes').notNull(),
    expectedBytes: integer('expected_bytes'),
    inputSha256: bytea('input_sha256').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('testcases_problem_pos_idx').on(t.problemId, t.position)],
)

export const files = pgTable('files', {
  id: id(),
  kind: text('kind').notNull().default('image'),
  bytes: bytea('bytes').notNull(),
  mime: text('mime').notNull(),
  width: integer('width'),
  height: integer('height'),
  sha256: bytea('sha256'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: createdAt(),
})

// ───────────────────────────────────────────────────────── §2.4 Ngôn ngữ & cấu hình

export const languages = pgTable('languages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  versionLabel: text('version_label'),
  image: text('image').notNull(),
  sourceFilename: text('source_filename').notNull(),
  /** Tên file chứa mã người học ở dạng function; NULL = ngôn ngữ chưa hỗ trợ dạng đó. */
  functionSourceFilename: text('function_source_filename'),
  compileArgv: jsonb('compile_argv'),
  /** NULL = dùng lại compileArgv; xem drizzle/0003_function_problems.sql. */
  compileArgvFunction: jsonb('compile_argv_function'),
  runArgv: jsonb('run_argv').notNull(),
  timeFactor: numeric('time_factor', { precision: 4, scale: 2 }).notNull().default('1'),
  memoryExtraMb: integer('memory_extra_mb').notNull().default(0),
  cmMode: text('cm_mode'),
  enabled: boolean('enabled').notNull().default(false),
  position: integer('position'),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
  updatedBy: text('updated_by').references(() => users.id),
})

// ────────────────────────────────────────────────────────────────────── §2.5 Contest

export const contests = pgTable(
  'contests',
  {
    id: id(),
    courseId: text('course_id').references(() => courses.id),
    title: text('title').notNull(),
    descriptionMd: text('description_md'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('draft'), // draft | published
    scoring: text('scoring').notNull().default('sum_score'),
    penaltyMinutes: integer('penalty_minutes').notNull().default(20),
    sequential: boolean('sequential').notNull().default(false),
    freezeMinutes: integer('freeze_minutes').notNull().default(0),
    createdBy: text('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('contests_status_start_idx').on(t.status, t.startAt)],
)

export const contestProblems = pgTable(
  'contest_problems',
  {
    id: id(),
    contestId: text('contest_id').notNull().references(() => contests.id, { onDelete: 'cascade' }),
    problemId: text('problem_id').notNull().references(() => problems.id),
    position: integer('position').notNull(),
    label: text('label'),
    maxScore: integer('max_score').notNull().default(100),
  },
  (t) => [
    unique('contest_problems_contest_problem_key').on(t.contestId, t.problemId),
    index('contest_problems_contest_pos_idx').on(t.contestId, t.position),
  ],
)

export const contestParticipants = pgTable(
  'contest_participants',
  {
    contestId: text('contest_id').notNull().references(() => contests.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    firstOpenedAt: ts('first_opened_at'),
  },
  (t) => [primaryKey({ columns: [t.contestId, t.userId] })],
)

export const contestEvents = pgTable(
  'contest_events',
  {
    seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    contestId: text('contest_id').notNull().references(() => contests.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // started | standings.changed
    payload: jsonb('payload'),
    createdAt: createdAt(),
  },
  (t) => [index('contest_events_contest_seq_idx').on(t.contestId, t.seq)],
)

// ───────────────────────────────────────────────────────────── §2.6 Bài nộp & chấm

export const submissions = pgTable(
  'submissions',
  {
    id: id(),
    seq: bigint('seq', { mode: 'number' }).notNull().generatedAlwaysAsIdentity(),
    kind: text('kind').notNull(), // submit | run
    userId: text('user_id').notNull().references(() => users.id),
    problemId: text('problem_id').notNull().references(() => problems.id),
    itemId: text('item_id'),
    contestId: text('contest_id').references(() => contests.id),
    contestProblemId: text('contest_problem_id'),
    languageId: text('language_id').notNull().references(() => languages.id),
    source: text('source').notNull(),
    sourceBytes: integer('source_bytes').notNull(),
    customInput: bytea('custom_input'),
    runTarget: text('run_target'), // samples | custom | validate
    status: text('status').notNull().default('pending'), // pending | running | done
    verdict: text('verdict'),
    passedWeight: integer('passed_weight'),
    totalWeight: integer('total_weight'),
    timeMsMax: integer('time_ms_max'),
    memoryKbMax: integer('memory_kb_max'),
    compileOutput: text('compile_output'),
    testcaseRev: integer('testcase_rev'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    queuedMs: integer('queued_ms'),
    judgeMs: integer('judge_ms'),
    workerId: text('worker_id'),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
    attempt: integer('attempt').notNull().default(0),
    priority: smallint('priority').notNull().default(1),
    ieReason: text('ie_reason'),
    ieRetry: boolean('ie_retry').notNull().default(true),
  },
  (t) => [
    uniqueIndex('submissions_seq_key').on(t.seq),
    index('submissions_user_problem_idx').on(t.userId, t.problemId, t.seq),
    index('submissions_contest_standings_idx').on(t.contestId, t.contestProblemId, t.userId, t.receivedAt),
    index('submissions_problem_idx').on(t.problemId, t.seq),
  ],
)

export const submissionResults = pgTable(
  'submission_results',
  {
    submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    position: integer('position').notNull(),
    testcaseId: text('testcase_id').references(() => testcases.id, { onDelete: 'set null' }),
    isSample: boolean('is_sample').notNull(),
    verdict: text('verdict').notNull(),
    timeMs: integer('time_ms'),
    memoryKb: integer('memory_kb'),
    exitCode: integer('exit_code'),
    termSignal: integer('term_signal'),
    detail: text('detail'),
    stdout: text('stdout'),
    stderr: text('stderr'),
    mentorStdout: text('mentor_stdout'),
    firstDiffLine: integer('first_diff_line'),
  },
  (t) => [primaryKey({ columns: [t.submissionId, t.attempt, t.position] })],
)

export const submissionScoreAudit = pgTable('submission_score_audit', {
  id: id(),
  submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  verdictBefore: text('verdict_before'),
  verdictAfter: text('verdict_after'),
  passedWeightBefore: integer('passed_weight_before'),
  passedWeightAfter: integer('passed_weight_after'),
  reason: text('reason').notNull(),
  actor: text('actor').references(() => users.id),
  at: ts('at'),
})

export const rejudgeQueue = pgTable('rejudge_queue', {
  submissionId: text('submission_id').primaryKey().references(() => submissions.id, { onDelete: 'cascade' }),
  requestedAt: ts('requested_at'),
  actor: text('actor').references(() => users.id),
  reason: text('reason'),
  claimedBy: text('claimed_by'),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  shadowAttempt: integer('shadow_attempt'),
})

export const drafts = pgTable(
  'drafts',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    problemId: text('problem_id').notNull().references(() => problems.id, { onDelete: 'cascade' }),
    languageId: text('language_id').notNull().references(() => languages.id),
    source: text('source').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.problemId, t.languageId] })],
)

export const workers = pgTable('workers', {
  id: text('id').primaryKey(),
  slots: integer('slots').notNull(),
  version: text('version'),
  startedAt: ts('started_at'),
  lastSeenAt: ts('last_seen_at'),
})

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: text('actor_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: inet('ip'),
    at: ts('at'),
  },
  (t) => [index('audit_log_at_idx').on(t.at)],
)

// ──────────────────────────────────────────────────────── §2.8 Team & Leader (FR-J)

export const teams = pgTable(
  'teams',
  {
    id: id(),
    name: text('name').notNull(),
    descriptionMd: text('description_md'),
    /** Composite FK (id, leader_id) → team_members deferrable: xem drizzle/0001_init.sql. */
    leaderId: text('leader_id').notNull().references(() => users.id),
    courseId: text('course_id').references(() => courses.id),
    createdBy: text('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('teams_course_idx').on(t.courseId)],
)

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    addedBy: text('added_by').references(() => users.id),
    addedAt: ts('added_at'),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    // FR-J1: mỗi member thuộc TỐI ĐA một team — thi hành ở DB, không phải ở guard.
    uniqueIndex('team_members_user_key').on(t.userId),
  ],
)

export type User = typeof users.$inferSelect
export type Course = typeof courses.$inferSelect
export type Problem = typeof problems.$inferSelect
export type Testcase = typeof testcases.$inferSelect
export type Submission = typeof submissions.$inferSelect
export type Contest = typeof contests.$inferSelect
export type Team = typeof teams.$inferSelect
export type LanguageRow = typeof languages.$inferSelect
