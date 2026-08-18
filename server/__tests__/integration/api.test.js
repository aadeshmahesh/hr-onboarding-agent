// __tests__/integration/api.test.js
// Tests Express endpoints — mocks DB + agent to avoid real calls

import { jest }    from "@jest/globals";
import request     from "supertest";

// ── Mock all external dependencies ──
jest.unstable_mockModule("../../db.js", () => ({
  initDB:            jest.fn().mockResolvedValue(undefined),
  loadSession:       jest.fn(),
  loadSessionByToken: jest.fn(),
  getAllSessions:     jest.fn().mockResolvedValue([]),
  updateState:       jest.fn().mockResolvedValue(undefined),
  SESSION_STATES: {
    STARTED:           "started",
    CREATING_ACCOUNTS: "creating_accounts",
    WAITING_APPROVAL:  "waiting_approval",
    APPROVED:          "approved",
    REJECTED:          "rejected",
    COMPLETED:         "completed",
    FAILED:            "failed",
  },
}));

jest.unstable_mockModule("../../agent.js", () => ({
  startOnboarding:  jest.fn().mockResolvedValue({
    sessionId:     "mock-session-123",
    approvalToken: "mock-token-xyz",
  }),
  resumeOnboarding: jest.fn().mockResolvedValue({
    success:   true,
    action:    "approve",
    sessionId: "mock-session-123",
  }),
}));

jest.unstable_mockModule("dotenv/config", () => ({}));

process.env.ANTHROPIC_API_KEY = "mock-key";
process.env.DATABASE_URL      = "postgresql://mock:mock@mock/mock";
process.env.FRONTEND_URL      = "http://localhost:5177";
process.env.PORT              = "3005";

const { default: app } = await import("../../index.js");
const { loadSession, loadSessionByToken, getAllSessions } = await import("../../db.js");
const { startOnboarding, resumeOnboarding } = await import("../../agent.js");

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════
// GET /health
// ══════════════════════════════════════════
describe("GET /health", () => {

  test("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("returns provider and model info", async () => {
    const res = await request(app).get("/health");
    expect(res.body.provider).toBe("anthropic");
    expect(res.body.model).toBeDefined();
  });

});

// ══════════════════════════════════════════
// POST /onboard
// ══════════════════════════════════════════
describe("POST /onboard", () => {

  const validPayload = {
    employeeName:  "Priya Sharma",
    employeeEmail: "priya@company.com",
    employeeRole:  "Senior Frontend Engineer",
    employeeDept:  "Engineering",
    managerEmail:  "manager@company.com",
    startDate:     "2026-08-15",
  };

  test("returns 200 with sessionId for valid payload", async () => {
    const res = await request(app)
      .post("/onboard")
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe("mock-session-123");
  });

  test("returns poll URL in response", async () => {
    const res = await request(app)
      .post("/onboard")
      .send(validPayload);

    expect(res.body.poll).toContain("mock-session-123");
  });

  test("calls startOnboarding with correct data", async () => {
    await request(app).post("/onboard").send(validPayload);

    expect(startOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeName:  "Priya Sharma",
        employeeEmail: "priya@company.com",
        managerEmail:  "manager@company.com",
      })
    );
  });

  test("returns 400 when employeeName missing", async () => {
    const res = await request(app)
      .post("/onboard")
      .send({ employeeEmail: "priya@company.com", managerEmail: "mgr@co.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("returns 400 when employeeEmail missing", async () => {
    const res = await request(app)
      .post("/onboard")
      .send({ employeeName: "Priya", managerEmail: "mgr@co.com" });

    expect(res.status).toBe(400);
  });

  test("returns 400 when managerEmail missing", async () => {
    const res = await request(app)
      .post("/onboard")
      .send({ employeeName: "Priya", employeeEmail: "priya@co.com" });

    expect(res.status).toBe(400);
  });

  test("returns 400 for empty body", async () => {
    const res = await request(app).post("/onboard").send({});
    expect(res.status).toBe(400);
  });

});

// ══════════════════════════════════════════
// GET /session/:id
// ══════════════════════════════════════════
describe("GET /session/:id", () => {

  test("returns 200 with session data for valid ID", async () => {
    loadSession.mockResolvedValue({
      session_id:     "mock-session-123",
      employee_name:  "Priya Sharma",
      employee_role:  "Senior Engineer",
      state:          "creating_accounts",
      steps:          [],
      created_at:     new Date(),
      updated_at:     new Date(),
      completed_at:   null,
      approval_token: null,
    });

    const res = await request(app).get("/session/mock-session-123");

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe("mock-session-123");
    expect(res.body.employeeName).toBe("Priya Sharma");
    expect(res.body.state).toBe("creating_accounts");
  });

  test("returns 404 for unknown session ID", async () => {
    loadSession.mockResolvedValue(null);

    const res = await request(app).get("/session/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test("returns approval token only when state is waiting_approval", async () => {
    loadSession.mockResolvedValue({
      session_id:     "session-001",
      employee_name:  "Priya",
      employee_role:  "Engineer",
      state:          "waiting_approval",
      steps:          [],
      created_at:     new Date(),
      updated_at:     new Date(),
      completed_at:   null,
      approval_token: "secret-token-xyz",
    });

    const res = await request(app).get("/session/session-001");

    expect(res.body.approvalToken).toBe("secret-token-xyz");
  });

  test("does NOT expose approval token when completed", async () => {
    loadSession.mockResolvedValue({
      session_id:     "session-001",
      employee_name:  "Priya",
      employee_role:  "Engineer",
      state:          "completed",
      steps:          [],
      created_at:     new Date(),
      updated_at:     new Date(),
      completed_at:   new Date(),
      approval_token: "secret-token-xyz",
    });

    const res = await request(app).get("/session/session-001");

    // Token should NOT be exposed for completed sessions
    expect(res.body.approvalToken).toBeUndefined();
  });

});

// ══════════════════════════════════════════
// POST /webhook/approval
// ══════════════════════════════════════════
describe("POST /webhook/approval", () => {

  test("returns 200 for valid approve action", async () => {
    const res = await request(app)
      .post("/webhook/approval")
      .send({ token: "mock-token-xyz", action: "approve" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("returns 200 for valid reject action", async () => {
    resumeOnboarding.mockResolvedValue({
      success: true, action: "reject", sessionId: "mock-session-123"
    });

    const res = await request(app)
      .post("/webhook/approval")
      .send({ token: "mock-token-xyz", action: "reject" });

    expect(res.status).toBe(200);
  });

  test("calls resumeOnboarding with correct token and action", async () => {
    await request(app)
      .post("/webhook/approval")
      .send({ token: "tok-123", action: "approve", approvedBy: "Manager Bob" });

    expect(resumeOnboarding).toHaveBeenCalledWith(
      "tok-123", "approve", "Manager Bob", undefined
    );
  });

  test("returns 400 when token missing", async () => {
    const res = await request(app)
      .post("/webhook/approval")
      .send({ action: "approve" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("returns 400 when action missing", async () => {
    const res = await request(app)
      .post("/webhook/approval")
      .send({ token: "tok-123" });

    expect(res.status).toBe(400);
  });

});

// ══════════════════════════════════════════
// GET /sessions
// ══════════════════════════════════════════
describe("GET /sessions", () => {

  test("returns 200 with sessions array", async () => {
    getAllSessions.mockResolvedValue([
      {
        session_id:    "s1",
        employee_name: "Priya",
        employee_role: "Engineer",
        employee_dept: "Eng",
        state:         "completed",
        created_at:    new Date(),
        updated_at:    new Date(),
      }
    ]);

    const res = await request(app).get("/sessions");

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].employee_name).toBe("Priya");
  });

  test("returns empty array when no sessions", async () => {
    getAllSessions.mockResolvedValue([]);

    const res = await request(app).get("/sessions");

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(0);
  });

});
