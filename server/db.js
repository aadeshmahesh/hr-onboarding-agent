import "dotenv/config";
import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL);

// ── Session states ──
export const SESSION_STATES = {
  STARTED:          "started",
  CREATING_ACCOUNTS:"creating_accounts",
  ASSIGNING_EQUIPMENT: "assigning_equipment",
  WAITING_APPROVAL: "waiting_approval",
  APPROVED:         "approved",
  REJECTED:         "rejected",
  COMPLETED:        "completed",
  FAILED:           "failed",
};

export async function initDB() {
  // ── Onboarding sessions table ──
  await sql`
    CREATE TABLE IF NOT EXISTS onboarding_sessions (
      session_id      TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      employee_name   TEXT NOT NULL,
      employee_email  TEXT NOT NULL,
      employee_role   TEXT NOT NULL,
      employee_dept   TEXT NOT NULL,
      manager_email   TEXT NOT NULL,
      state           TEXT DEFAULT 'started',
      messages        JSONB DEFAULT '[]',
      steps           JSONB DEFAULT '[]',
      approval_token  TEXT UNIQUE,
      approved_by     TEXT,
      rejection_reason TEXT,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW(),
      completed_at    TIMESTAMP
    )
  `;

  // ── Completed steps for idempotency ──
  await sql`
    CREATE TABLE IF NOT EXISTS completed_steps (
      id          SERIAL PRIMARY KEY,
      session_id  TEXT NOT NULL,
      step_name   TEXT NOT NULL,
      result      JSONB,
      created_at  TIMESTAMP DEFAULT NOW(),
      UNIQUE(session_id, step_name)
    )
  `;

  console.log("✅ DB initialized — onboarding tables ready");
}

// ── Save session ──
export async function saveSession(sessionId, data) {
  await sql`
    INSERT INTO onboarding_sessions
      (session_id, user_id, employee_name, employee_email,
       employee_role, employee_dept, manager_email,
       state, messages, steps, approval_token, updated_at)
    VALUES (
      ${sessionId},
      ${data.userId},
      ${data.employeeName},
      ${data.employeeEmail},
      ${data.employeeRole},
      ${data.employeeDept},
      ${data.managerEmail},
      ${data.state},
      ${JSON.stringify(data.messages)},
      ${JSON.stringify(data.steps)},
      ${data.approvalToken || null},
      NOW()
    )
    ON CONFLICT (session_id) DO UPDATE SET
      state          = EXCLUDED.state,
      messages       = EXCLUDED.messages,
      steps          = EXCLUDED.steps,
      approval_token = COALESCE(EXCLUDED.approval_token, onboarding_sessions.approval_token),
      updated_at     = NOW()
  `;
}

// ── Load session ──
export async function loadSession(sessionId) {
  const rows = await sql`
    SELECT * FROM onboarding_sessions
    WHERE session_id = ${sessionId}
  `;
  return rows[0] || null;
}

// ── Load session by approval token ──
export async function loadSessionByToken(token) {
  const rows = await sql`
    SELECT * FROM onboarding_sessions
    WHERE approval_token = ${token}
  `;
  return rows[0] || null;
}

// ── Update session state ──
export async function updateState(sessionId, state, extra = {}) {
  await sql`
    UPDATE onboarding_sessions SET
      state        = ${state},
      updated_at   = NOW(),
      approved_by  = ${extra.approvedBy  || null},
      rejection_reason = ${extra.rejectionReason || null},
      completed_at = ${state === SESSION_STATES.COMPLETED ? sql`NOW()` : null}
    WHERE session_id = ${sessionId}
  `;
}

// ── Check if step already completed (idempotency) ──
export async function isStepCompleted(sessionId, stepName) {
  const rows = await sql`
    SELECT result FROM completed_steps
    WHERE session_id = ${sessionId}
    AND   step_name  = ${stepName}
  `;
  return rows[0]?.result || null;
}

// ── Mark step as completed ──
export async function markStepCompleted(sessionId, stepName, result) {
  await sql`
    INSERT INTO completed_steps (session_id, step_name, result)
    VALUES (${sessionId}, ${stepName}, ${JSON.stringify(result)})
    ON CONFLICT (session_id, step_name) DO NOTHING
  `;
}

// ── Get all sessions (for dashboard) ──
export async function getAllSessions() {
  return await sql`
    SELECT
      session_id, employee_name, employee_email,
      employee_role, employee_dept, manager_email,
      state, created_at, updated_at, completed_at
    FROM onboarding_sessions
    ORDER BY created_at DESC
    LIMIT 50
  `;
}
