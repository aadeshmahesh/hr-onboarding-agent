# 👥 HR Onboarding Agent

AI-powered HR onboarding agent with human-in-the-loop approval pattern.
Anthropic Claude + persistent state + webhook resume + idempotent tools.

**New concepts vs Projects 1-4:**
- Human-in-the-loop — agent pauses and waits for manager approval
- Webhook pattern — external trigger resumes paused agent
- Persistent state — full session saved to Neon DB across restarts
- State machine — started / creating_accounts / waiting_approval / completed
- Idempotent tools — safe to retry, never duplicates work
- Conditional flow — different path for approve vs reject
- Token-based security — webhook URL contains secret approval token

---

## Quick Start

```bash
# Step 1: Install server dependencies
cd hr-onboarding-agent/server
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, DATABASE_URL, UPSTASH keys

# Step 2: Start server
npm run dev   # port 3005

# Step 3: Install and start React UI
cd ../client
npm install
npm run dev   # port 5177

# Step 4: Open browser
http://localhost:5177
```

---

## Environment Variables

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxx

# Neon Postgres (same project as previous agents)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Upstash Redis (console.upstash.com → REST API tab)
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

# Webhook secret (any random string you choose)
WEBHOOK_SECRET=my-secret-token-123

# Frontend URL (for approval email links)
FRONTEND_URL=http://localhost:5177

# Server port
PORT=3005
```

---

## How It Works — Full Detailed Flow

---

### Architecture

```
React UI (port 5177)
        │ POST /onboard
        ▼
Agent Server (port 3005)
        ├── Bottleneck      rate limits Anthropic API
        ├── Neon DB         saves full session state
        ├── Idempotency     never runs same step twice
        └── Anthropic Claude reasoning + decisions
        │
        │ ⏸ PAUSES here — saves to DB
        │
        ▼
Manager Email (mocked to console)
  Approve URL: http://localhost:5177/approve?token=xxx&action=approve
  Reject URL:  http://localhost:5177/approve?token=xxx&action=reject
        │
        ▼ Manager clicks link
Agent Server resumes from saved state
        │
        ▼
Onboarding complete ✅
```

---

### Session State Machine

```
none
  ↓ POST /onboard
started
  ↓ Agent begins running
creating_accounts
  ↓ GitHub + Slack + Jira created
  ↓ Equipment assigned + Orientation scheduled
waiting_approval      ← ⏸ AGENT PAUSES HERE
  ↓ Manager clicks Approve link
approved
  ↓ Agent resumes
  ↓ Welcome email + team notification
completed ✅

OR:

waiting_approval
  ↓ Manager clicks Reject link
rejected ❌
```

---

### System Prompt (sent every turn, never changes)

```
You are an HR Onboarding Agent. Your job is to fully onboard
new employees step by step.

ONBOARDING STEPS (in order):
1. get_employee_details — fetch employee info first
2. create_github_account + create_slack_account + create_jira_account
   — run in PARALLEL
3. assign_equipment + schedule_orientation — run in PARALLEL
4. request_manager_approval — ALWAYS call this before welcome email
   → Agent pauses here until manager approves
5. (After approval) send_welcome_email + notify_team — run in PARALLEL
6. complete_onboarding — final step

IMPORTANT RULES:
- Run independent tools in PARALLEL (same turn)
- ALWAYS call request_manager_approval before welcome email
- Be thorough — complete ALL steps
```

---

### Tool Definitions (sent every turn)

```json
[
  {
    "name": "get_employee_details",
    "description": "Get full details of the employee. Call this first.",
    "input_schema": {
      "properties": {
        "employee_id": { "type": "string" }
      }
    }
  },
  {
    "name": "create_github_account",
    "description": "Create GitHub account for the new employee.",
    "input_schema": {
      "properties": {
        "employee_name":  { "type": "string" },
        "employee_email": { "type": "string" },
        "department":     { "type": "string" }
      }
    }
  },
  {
    "name": "create_slack_account",
    "description": "Create Slack account and add to team channels.",
    "input_schema": {
      "properties": {
        "employee_name":  { "type": "string" },
        "employee_email": { "type": "string" },
        "department":     { "type": "string" }
      }
    }
  },
  {
    "name": "create_jira_account",
    "description": "Create Jira account with appropriate project access.",
    "input_schema": {
      "properties": {
        "employee_name":  { "type": "string" },
        "employee_email": { "type": "string" },
        "role":           { "type": "string" }
      }
    }
  },
  {
    "name": "assign_equipment",
    "description": "Assign laptop, monitors, and equipment.",
    "input_schema": {
      "properties": {
        "employee_name": { "type": "string" },
        "role":          { "type": "string" },
        "department":    { "type": "string" }
      }
    }
  },
  {
    "name": "schedule_orientation",
    "description": "Schedule orientation session.",
    "input_schema": {
      "properties": {
        "employee_name":  { "type": "string" },
        "employee_email": { "type": "string" },
        "start_date":     { "type": "string" }
      }
    }
  },
  {
    "name": "request_manager_approval",
    "description": "Send approval request to manager. Agent PAUSES here.",
    "input_schema": {
      "properties": {
        "employee_name":  { "type": "string" },
        "employee_role":  { "type": "string" },
        "manager_email":  { "type": "string" },
        "summary":        { "type": "string" }
      }
    }
  },
  {
    "name": "send_welcome_email",
    "description": "Send welcome email after manager approval.",
    "input_schema": {
      "properties": {
        "employee_name":  { "type": "string" },
        "employee_email": { "type": "string" },
        "employee_role":  { "type": "string" },
        "department":     { "type": "string" }
      }
    }
  },
  {
    "name": "notify_team",
    "description": "Notify the team about new employee joining.",
    "input_schema": {
      "properties": {
        "employee_name": { "type": "string" },
        "employee_role": { "type": "string" },
        "department":    { "type": "string" }
      }
    }
  },
  {
    "name": "complete_onboarding",
    "description": "Mark onboarding complete and generate final report.",
    "input_schema": {
      "properties": {
        "employee_name":    { "type": "string" },
        "completed_steps":  { "type": "array" }
      }
    }
  }
]
```

---

### LLM Request — Turn 1 (fresh start)

```json
{
  "model":      "claude-sonnet-4-6",
  "max_tokens": 2048,
  "system":     "...system prompt above...",
  "tools":      [...10 tool definitions...],
  "messages": [
    {
      "role": "user",
      "content": "Please onboard this new employee:\nName: Priya Sharma\nEmail: priya.sharma@company.com\nRole: Senior Frontend Engineer\nDepartment: Engineering\nManager Email: manager@company.com\nStart Date: 2026-08-15"
    }
  ]
}
```

---

### LLM Response — Turn 1

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "I'll start onboarding Priya. Let me get her details first."
    },
    {
      "type":  "tool_use",
      "id":    "tool_001",
      "name":  "get_employee_details",
      "input": { "employee_id": "EMP-001" }
    }
  ],
  "usage": { "input_tokens": 520, "output_tokens": 80 }
}
```

> stop_reason: "tool_use" → loop continues

---

### Tool Result — get_employee_details

```json
{
  "employee_id":   "EMP-001",
  "name":          "Priya Sharma",
  "email":         "priya.sharma@company.com",
  "role":          "Senior Frontend Engineer",
  "department":    "Engineering",
  "manager_email": "manager@company.com",
  "start_date":    "2026-08-15",
  "location":      "Scottsdale, AZ"
}
```

Session saved to Neon DB:
```sql
INSERT INTO onboarding_sessions
  (session_id, employee_name, state, messages)
VALUES
  ('abc-123', 'Priya Sharma', 'creating_accounts', '[...]')
```

---

### LLM Response — Turn 2 (parallel tool calls)

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "Creating all accounts simultaneously."
    },
    {
      "type": "tool_use", "id": "tool_002",
      "name": "create_github_account",
      "input": { "employee_name": "Priya Sharma", "employee_email": "priya.sharma@company.com", "department": "Engineering" }
    },
    {
      "type": "tool_use", "id": "tool_003",
      "name": "create_slack_account",
      "input": { "employee_name": "Priya Sharma", "employee_email": "priya.sharma@company.com", "department": "Engineering" }
    },
    {
      "type": "tool_use", "id": "tool_004",
      "name": "create_jira_account",
      "input": { "employee_name": "Priya Sharma", "employee_email": "priya.sharma@company.com", "role": "Senior Frontend Engineer" }
    }
  ],
  "usage": { "input_tokens": 890, "output_tokens": 240 }
}
```

> 3 tools called in ONE turn — parallel execution ✅

---

### Idempotency Check (each tool)

```js
// Before executing any tool:
const cached = await isStepCompleted(sessionId, "create_github_account");
if (cached) {
  console.log("Already done — using cached result");
  return { ...cached, cached: true };
}

// After executing:
await markStepCompleted(sessionId, "create_github_account", result);
```

Database:
```sql
INSERT INTO completed_steps (session_id, step_name, result)
VALUES ('abc-123', 'create_github_account', '{"success": true, ...}')
ON CONFLICT (session_id, step_name) DO NOTHING
```

If server crashes and retries → same result, no duplicate accounts ✅

---

### Tool Results — Turn 2 (all 3 accounts)

```json
[
  {
    "type": "tool_result", "tool_use_id": "tool_002",
    "content": "{\"success\": true, \"username\": \"priya.sharma\", \"profile\": \"https://github.com/priya.sharma\", \"teams\": [\"engineering\", \"all-employees\"]}"
  },
  {
    "type": "tool_result", "tool_use_id": "tool_003",
    "content": "{\"success\": true, \"handle\": \"@priya.sharma\", \"channels\": [\"#general\", \"#engineering\", \"#random\"]}"
  },
  {
    "type": "tool_result", "tool_use_id": "tool_004",
    "content": "{\"success\": true, \"account_id\": \"jira-001\", \"projects\": [\"ENG\", \"INFRA\", \"DOCS\"]}"
  }
]
```

---

### LLM Response — Turn 3 (parallel again)

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use", "id": "tool_005",
      "name": "assign_equipment",
      "input": { "employee_name": "Priya Sharma", "role": "Senior Frontend Engineer" }
    },
    {
      "type": "tool_use", "id": "tool_006",
      "name": "schedule_orientation",
      "input": { "employee_name": "Priya Sharma", "employee_email": "priya.sharma@company.com", "start_date": "2026-08-15" }
    }
  ],
  "usage": { "input_tokens": 1240, "output_tokens": 180 }
}
```

> Equipment + Orientation scheduled in parallel ✅

---

### LLM Response — Turn 4 (request approval → PAUSE)

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use", "id": "tool_007",
      "name": "request_manager_approval",
      "input": {
        "employee_name": "Priya Sharma",
        "employee_role": "Senior Frontend Engineer",
        "manager_email": "manager@company.com",
        "summary": "GitHub ✅ Slack ✅ Jira ✅ MacBook Pro ✅ Orientation Aug 15 ✅"
      }
    }
  ],
  "usage": { "input_tokens": 1680, "output_tokens": 140 }
}
```

---

### Agent PAUSES Here ⏸

```
Agent detects: tool name === "request_manager_approval"

1. Sends mocked approval email (logged to console)
2. Saves full state to Neon DB:
   {
     session_id:     "abc-123",
     state:          "waiting_approval",
     messages:       [...all 4 turns of messages...],
     approval_token: "xyz-token-456",
   }
3. Returns job info to frontend
4. agent.js function RETURNS — stops running

Server can restart — state is safe in DB ✅
Agent can wait hours or days here ✅
```

Console output (mocked email):
```
════════════════════════════════════════════════════════════
📧 APPROVAL EMAIL (MOCKED)
════════════════════════════════════════════════════════════
To:      manager@company.com
Subject: Action Required — Approve onboarding for Priya Sharma

Hi Manager,

New employee onboarding requires your approval:
  Name:       Priya Sharma
  Role:       Senior Frontend Engineer
  Department: Engineering

Accounts created and ready:
  ✅ GitHub account
  ✅ Slack account
  ✅ Jira account
  ✅ Equipment assigned
  ✅ Orientation scheduled

APPROVE: http://localhost:5177/approve?token=xyz-token-456&action=approve
REJECT:  http://localhost:5177/approve?token=xyz-token-456&action=reject
════════════════════════════════════════════════════════════
```

---

### Manager Clicks Approve → Webhook Fires

```
GET http://localhost:3005/approve?token=xyz-token-456&action=approve

Server:
  1. Loads session by token from Neon DB
  2. Verifies state === "waiting_approval"
  3. Updates state to "approved"
  4. Calls continueAfterApproval()
  5. Redirects browser to frontend
```

---

### Agent RESUMES ▶️

```js
// Load saved messages from DB
const session  = await loadSession(sessionId);
let messages   = session.messages; // full history from before pause

// Add approval message to history
messages.push({
  role:    "user",
  content: "✅ Manager approved. Please continue with:\n1. send_welcome_email\n2. notify_team\n3. complete_onboarding"
});

// Call Claude — it reads full history and continues
// Claude never knew it "paused" — just sees a conversation
```

---

### LLM Request — Turn 5 (after approval)

```json
{
  "messages": [
    { "role": "user",      "content": "Please onboard Priya Sharma..." },
    { "role": "assistant", "content": [...get_employee_details tool_use...] },
    { "role": "user",      "content": [...employee details result...] },
    { "role": "assistant", "content": [...3 account tool_uses...] },
    { "role": "user",      "content": [...3 account results...] },
    { "role": "assistant", "content": [...equipment + orientation tool_uses...] },
    { "role": "user",      "content": [...equipment + orientation results...] },
    { "role": "assistant", "content": [...approval request tool_use...] },
    { "role": "user",      "content": [...approval sent result...] },
    {
      "role": "user",
      "content": "✅ Manager approved. Continue with welcome email + notify team."
    }
  ]
}
```

> Claude reads full history → continues naturally
> No idea it "paused" for any amount of time ✅

---

### LLM Response — Turn 5 (parallel final steps)

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use", "id": "tool_008",
      "name": "send_welcome_email",
      "input": { "employee_name": "Priya Sharma", "employee_email": "priya.sharma@company.com", "employee_role": "Senior Frontend Engineer", "department": "Engineering" }
    },
    {
      "type": "tool_use", "id": "tool_009",
      "name": "notify_team",
      "input": { "employee_name": "Priya Sharma", "employee_role": "Senior Frontend Engineer", "department": "Engineering" }
    }
  ],
  "usage": { "input_tokens": 2100, "output_tokens": 200 }
}
```

---

### LLM Response — Turn 6 (complete)

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use", "id": "tool_010",
      "name": "complete_onboarding",
      "input": {
        "employee_name": "Priya Sharma",
        "completed_steps": [
          "get_employee_details",
          "create_github_account",
          "create_slack_account",
          "create_jira_account",
          "assign_equipment",
          "schedule_orientation",
          "request_manager_approval",
          "send_welcome_email",
          "notify_team"
        ]
      }
    }
  ]
}
```

---

### LLM Response — Turn 7 (Final)

```json
{
  "stop_reason": "end_turn",
  "content": [
    {
      "type": "text",
      "text": "🎉 Priya Sharma is fully onboarded!\n\nCompleted (9 steps):\n✅ Employee details retrieved\n✅ GitHub account: priya.sharma\n✅ Slack: @priya.sharma (#general, #engineering)\n✅ Jira: ENG, INFRA, DOCS projects\n✅ MacBook Pro 16-inch M3 assigned\n✅ Orientation: Aug 15 9:00-12:00 AM MST\n✅ Manager approved\n✅ Welcome email sent\n✅ Team notified on #general\n\nPriya is ready for day one! 🚀"
    }
  ],
  "usage": { "input_tokens": 2450, "output_tokens": 185 }
}
```

> stop_reason: "end_turn" → session state → "completed" ✅

---

### Session Saved to Neon DB

```sql
UPDATE onboarding_sessions SET
  state        = 'completed',
  completed_at = NOW()
WHERE session_id = 'abc-123'
```

```sql
-- All completed steps recorded for idempotency:
SELECT * FROM completed_steps WHERE session_id = 'abc-123';

id  step_name                result
──────────────────────────────────────────────────
1   get_employee_details     { name: "Priya"... }
2   create_github_account    { success: true... }
3   create_slack_account     { success: true... }
4   create_jira_account      { success: true... }
5   assign_equipment         { success: true... }
6   schedule_orientation     { success: true... }
7   send_welcome_email       { success: true... }
8   notify_team              { success: true... }
9   complete_onboarding      { status: "FULLY ONBOARDED" }
```

---

## What's in the Log Files

Every session creates `server/logs/session-*.txt`:

```
SESSION HEADER (session ID, employee, manager, provider)
SYSTEM PROMPT
STATE CHANGE: none → started
LLM REQUEST Turn 1 (full messages + tools JSON)
LLM RESPONSE Turn 1 (stop_reason + token counts)
LLM DECISION (which tools called)
TOOL CALL: get_employee_details (input)
TOOL RESULT: get_employee_details (full result)
STATE CHANGE: started → creating_accounts
LLM REQUEST Turn 2
LLM RESPONSE Turn 2 (3 parallel tool calls)
TOOL CALL: create_github_account
TOOL RESULT: create_github_account
TOOL CALL: create_slack_account
TOOL RESULT: create_slack_account
TOOL CALL: create_jira_account
TOOL RESULT: create_jira_account
LLM REQUEST Turn 3 (equipment + orientation)
...
⏸ AGENT PAUSED — WAITING FOR HUMAN APPROVAL
   Session ID, approval token, state saved to DB
...
▶️  AGENT RESUMING — Manager APPROVED
LLM REQUEST Turn 5 (full history including approval)
...
SESSION COMPLETE (turns + tokens + approx cost)
```

---

## API Endpoints

```
POST /onboard
  Body: { employeeName, employeeEmail, employeeRole,
          employeeDept, managerEmail, startDate }
  Returns: { sessionId, message, poll }

GET  /session/:id
  Returns: { sessionId, state, steps, employeeName, ... }
  Poll every 3 seconds from frontend

GET  /approve?token=xxx&action=approve|reject
  Manager clicks this link from email
  Resumes or rejects the agent
  Redirects to frontend

POST /webhook/approval
  Body: { token, action, approvedBy, rejectionReason }
  JSON version of the approval webhook

GET  /sessions
  Returns all sessions for dashboard view
```

---

## What's New vs Previous Projects

| | P1 Calendar | P2 IT Support | P3 Site Search | P4 Restaurant | P5 HR Onboarding |
|---|---|---|---|---|---|
| Agentic loop | ✅ | ✅ | ✅ | ✅ | ✅ |
| Parallel tools | ❌ | ✅ | ✅ | ✅ | ✅ |
| RAG | ❌ | ✅ | ✅ pgvector | ✅ JSON | ✅ Neon DB |
| Streaming | ❌ | ❌ | ❌ | ✅ SSE | ❌ |
| Redis cache | ❌ | ❌ | ❌ | ✅ | ❌ |
| MCP | ❌ | ❌ | ❌ | ✅ | ❌ |
| Persistent state | ❌ | ❌ | ❌ | ❌ | ✅ Neon DB |
| Human-in-loop | ❌ | ❌ | ❌ | ❌ | ✅ |
| Webhook resume | ❌ | ❌ | ❌ | ❌ | ✅ |
| Idempotency | ❌ | ❌ | ❌ | ❌ | ✅ |
| State machine | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Project Structure

```
hr-onboarding-agent/
  ├── server/
  │   ├── index.js    Express server — all endpoints
  │   ├── agent.js    Agentic loop + pause + resume logic
  │   ├── tools.js    10 tools with idempotency checks
  │   ├── db.js       Neon DB — sessions + completed_steps
  │   ├── email.js    Mocked email (logs to console)
  │   ├── logger.js   Full session logging
  │   └── .env.example
  └── client/
      └── src/
          └── App.jsx React UI — form, session view, dashboard
```

---

## Try It

```
Step 1: Fill in employee details on the form
Step 2: Click "Start Onboarding"
Step 3: Watch the agent create accounts in real time
Step 4: Check console for the mocked approval email
Step 5: Copy the APPROVE link from console → open in browser
Step 6: Agent resumes → sends welcome email → completes ✅
Step 7: Check /sessions dashboard to see all onboardings
```

---

## Upgrade to Real Email (Resend.com)

```bash
# 1. Sign up at resend.com (free — 3000 emails/month)
# 2. Get API key
# 3. Install SDK
npm install resend

# 4. In email.js replace the mock with:
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from:    "hr@maheshbuilds.dev",
  to:      managerEmail,
  subject: `Approve onboarding for ${employeeName}`,
  html:    `<a href="${approveUrl}">✅ Approve</a> | <a href="${rejectUrl}">❌ Reject</a>`
});
```

---

## Try These Scenarios

```
Scenario 1 — Happy path:
  Fill form → Start → Wait for console email
  Copy APPROVE link → Open in browser
  Watch agent complete onboarding ✅

Scenario 2 — Rejection:
  Fill form → Start → Wait for console email
  Copy REJECT link → Open in browser
  Agent sends rejection notification ❌

Scenario 3 — Server restart test:
  Start onboarding → Wait for approval email
  Stop server (Ctrl+C)
  Restart server (npm run dev)
  Click approve link
  Agent resumes from saved state ✅

Scenario 4 — Retry test:
  If any step fails → restart server
  Agent retries only incomplete steps
  Already-completed steps skipped (idempotency) ✅
```

---

# Unit Testing Guide

## How Tests Work

```
Unit test =
  Real function +
  Sample input +
  Fake dependencies =
  Predictable output to assert against ✅
```

---

## How Jest Finds and Runs Tests

```
npm test
  ↓
Jest reads package.json for config
  ↓
finds testMatch pattern:
  "**/__tests__/**/*.test.js"
  ↓
finds all test files automatically
  ↓
runs every describe() and test()
  ↓
reports pass/fail summary
```

You never call describe() or test() manually.
Jest finds and runs them automatically.

---

## Test File Structure

```javascript
// 1. Import jest
import { jest } from "@jest/globals";

// 2. MOCK external dependencies FIRST
//    (must be before imports)
jest.unstable_mockModule("../../db.js", () => ({
  isStepCompleted:   jest.fn(),
  markStepCompleted: jest.fn(),
}));

// 3. Import modules AFTER mocking
//    (so they get the fake versions)
const { isStepCompleted } = await import("../../db.js");
const { executeTool }     = await import("../../tools.js");

// 4. Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  isStepCompleted.mockResolvedValue(null);
});

// 5. Group tests with describe
describe("create_github_account", () => {

  // 6. One test per scenario
  test("returns success with username", async () => {
    const result = await executeTool(...);
    expect(result.success).toBe(true);
  });

});
```

---

## Why Import Order Matters

```
If you import BEFORE mocking:
  tools.js loads real db.js → real DB calls ❌

If you import AFTER mocking:
  tools.js loads fake db.js → controlled ✅

Jest intercepts the import and
swaps the real module with your fake one.
```

---

## describe and test

```javascript
describe("get_employee_details", () => {
//        ↑ GROUP NAME
//          usually = function name you're testing
//          Engineer defines this

  test("returns employee data for valid ID", async () => {
//      ↑ SCENARIO NAME
//        what should happen in this case
//        Engineer defines this

    // Arrange → Act → Assert
  });

});
```

```
Read together it makes a sentence:
"get_employee_details returns employee data for valid ID"

Terminal output:
  get_employee_details
    ✅ returns employee data for valid ID
    ✅ saves step to completed_steps
    ✅ returns cached result (idempotency)
```

---

## What Engineer Defines vs What Jest Does

```
Engineer defines:
  ✅ describe name   (what are you testing?)
  ✅ test name       (what scenario?)
  ✅ sample data     (what input?)
  ✅ assertions      (what do you expect?)

Jest does automatically:
  ✅ finds test files
  ✅ runs describe()
  ✅ runs beforeEach() before every test
  ✅ runs test()
  ✅ reports pass/fail
```

---

## What's Real vs Fake in Tests

```
REAL (actually runs):
  ✅ executeTool()     — your actual function
  ✅ all logic inside  — your actual if/else
  ✅ return values     — your actual output

FAKE (mocked):
  ❌ isStepCompleted() — fake DB lookup
  ❌ markStepCompleted()— fake DB save
  ❌ sample data       — not real employee
```

---

## How jest.fn() Works

```javascript
// Creates a fake function that:
//   → Does nothing by default
//   → Records every call made to it
//   → Can be told what to return

// Tell it to return null (step not done)
isStepCompleted.mockResolvedValue(null);

// Tell it to return cached data (step done)
isStepCompleted.mockResolvedValue({
  name: "Priya Sharma", cached: true
});
```

---

## How Pass / Fail is Determined

```
No error thrown = PASS ✅
Error thrown    = FAIL ❌

expect() throws an error when
condition is not met.
Jest catches it → marks test failed.
```

### What Failure Looks Like

```
FAIL __tests__/unit/tools.test.js

  ● get_employee_details
    › returns employee data for valid ID

    expect(received).toBeDefined()

    Expected: not undefined
    Received: undefined

      28 | const result = await executeTool(...);
    > 29 | expect(result.name).toBeDefined();
         |                     ^

  Tests: 1 failed, 55 passed
```

---

## Arrange → Act → Assert Pattern

```javascript
test("skips if already completed", async () => {

  // ARRANGE — set up the scenario
  isStepCompleted.mockResolvedValue({
    success: true, cached: true
  });

  // ACT — run the real function
  const result = await executeTool(
    "session-001",
    "create_github_account",
    { employee_name: "Priya", ... }
  );

  // ASSERT — check the output
  expect(result.cached).toBe(true);
  expect(markStepCompleted).not.toHaveBeenCalled();
});
```

---

## Jest Matchers — Built-in, No Imports Needed

### Equality
```javascript
expect(result.status).toBe(200);
expect(result.user).toEqual({ name: "Priya" });
```

### Existence
```javascript
expect(result.id).toBeDefined();
expect(result.error).toBeUndefined();
expect(result.data).toBeNull();
```

### Truthiness
```javascript
expect(result.success).toBeTruthy();
expect(result.error).toBeFalsy();
expect(result.success).toBe(true);
```

### Strings
```javascript
expect(result.url).toContain("github.com");
expect(result.name).toMatch(/priya/i);
```

### Numbers
```javascript
expect(result.score).toBeGreaterThan(0);
expect(result.count).toBeLessThan(100);
expect(result.total).toBeGreaterThanOrEqual(5);
```

### Arrays
```javascript
expect(result.channels).toContain("#general");
expect(result.items).toHaveLength(3);
```

### Objects
```javascript
expect(result).toMatchObject({
  success:  true,
  username: "priya.sharma",
});
```

### Mocks
```javascript
expect(markStepCompleted).toHaveBeenCalled();
expect(markStepCompleted).not.toHaveBeenCalled();
expect(markStepCompleted).toHaveBeenCalledWith(
  "session-001",
  "create_github_account",
  expect.any(Object)
);
expect(markStepCompleted).toHaveBeenCalledTimes(1);
```

### Errors
```javascript
expect(() => riskyFn()).toThrow();
expect(() => riskyFn()).toThrow("specific message");
```

### .not Modifier — Flip Any Matcher
```javascript
expect(result.error).not.toBeDefined();
expect(result.cached).not.toBe(true);
expect(fn).not.toHaveBeenCalled();
```

---

## beforeEach — Why It's Critical

```javascript
beforeEach(() => {
  jest.clearAllMocks();
  isStepCompleted.mockResolvedValue(null);
});

// Without this:
//   Test 1 sets mock to return cached data
//   Test 2 runs → still returns cached data ❌
//   Tests affect each other → unreliable ❌

// With this:
//   Every test starts completely fresh ✅
//   Tests are fully independent ✅
```

---

## Test File Checklist

```
Every test file should have:

  ✅ Mocks at the top (before imports)
  ✅ Imports after mocks
  ✅ beforeEach to reset mocks
  ✅ describe blocks to group tests
  ✅ test() for each scenario
  ✅ Arrange → Act → Assert pattern

Minimum tests per function:
  ✅ Happy path   (success case)
  ✅ Edge case    (empty, missing data)
  ✅ Error case   (failure handling)
  ✅ Idempotency  (if applicable)
```

---

## Test Suite Structure

```
server/
  __tests__/
    unit/
      tools.test.js    → 30 tests — all 10 tools
      email.test.js    → 12 tests — approval/welcome/reject emails
      db.test.js       →  7 tests — SESSION_STATES validation
    integration/
      api.test.js      → 17 tests — all Express endpoints

Total: 56 tests ✅
```

---

## Run Tests

```bash
# Run all tests
npm test

# Watch mode (re-runs on file change)
npm run test:watch

# With coverage report
npm run test:coverage
```

---

## Why Mock External Dependencies?

```
Real DB / API problems:        Mock benefits:
  DB might be down ❌            Always available ✅
  Data changes over time ❌      Never changes ✅
  Slow network ❌                Instant ✅
  Costs money ❌                 Free ✅
  Hard to control ❌             Predictable ✅
```

---

## Interview Answer

```
"How do you approach unit testing?"

"I test behavior in isolation.
Each test covers one scenario —
happy path, error case, edge case.

I mock all external dependencies
(DB, APIs, email) so tests run
offline in milliseconds.

I use beforeEach to reset mocks
between tests to prevent test leakage.

For integration tests I use
Supertest to hit real Express
endpoints with mocked dependencies."
```