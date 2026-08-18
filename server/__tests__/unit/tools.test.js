// __tests__/unit/tools.test.js
// Tests tool execution logic — mocks DB to avoid real calls

import { jest } from "@jest/globals";

// ── Mock DB module ──
jest.unstable_mockModule("../../db.js", () => ({
  isStepCompleted:  jest.fn(),
  markStepCompleted: jest.fn(),
}));

const { isStepCompleted, markStepCompleted } = await import("../../db.js");
const { executeTool } = await import("../../tools.js");

// ── Reset mocks before each test ──
beforeEach(() => {
  jest.clearAllMocks();
  // Default: step NOT completed
  isStepCompleted.mockResolvedValue(null);
  markStepCompleted.mockResolvedValue(undefined);
});

// ══════════════════════════════════════════
// get_employee_details
// ══════════════════════════════════════════
describe("get_employee_details", () => {

  test("returns employee data for valid ID", async () => {
    const result = await executeTool(
      "session-001",
      "get_employee_details",
      { employee_id: "EMP-001" }
    );

    expect(result.name).toBeDefined();
    expect(result.email).toBeDefined();
    expect(result.role).toBeDefined();
    expect(result.department).toBeDefined();
  });

  test("saves step to completed_steps after execution", async () => {
    await executeTool("session-001", "get_employee_details", { employee_id: "EMP-001" });
    expect(markStepCompleted).toHaveBeenCalledWith(
      "session-001",
      "get_employee_details",
      expect.any(Object)
    );
  });

  test("returns cached result if step already completed", async () => {
    const cached = { name: "Priya Sharma", cached: true };
    isStepCompleted.mockResolvedValue(cached);

    const result = await executeTool("session-001", "get_employee_details", { employee_id: "EMP-001" });

    expect(result.cached).toBe(true);
    expect(markStepCompleted).not.toHaveBeenCalled(); // skipped ✅
  });

});

// ══════════════════════════════════════════
// create_github_account
// ══════════════════════════════════════════
describe("create_github_account", () => {

  test("returns success with username", async () => {
    const result = await executeTool(
      "session-001",
      "create_github_account",
      {
        employee_name:  "Priya Sharma",
        employee_email: "priya@company.com",
        department:     "Engineering",
      }
    );

    expect(result.success).toBe(true);
    expect(result.username).toBeDefined();
    expect(result.profile).toContain("github.com");
  });

  test("username derived from employee name", async () => {
    const result = await executeTool(
      "session-001",
      "create_github_account",
      {
        employee_name:  "John Doe",
        employee_email: "john@company.com",
        department:     "Engineering",
      }
    );

    expect(result.username).toBe("john.doe");
  });

  test("skips if already completed (idempotency)", async () => {
    const cached = { success: true, username: "priya.sharma", cached: true };
    isStepCompleted.mockResolvedValue(cached);

    const result = await executeTool(
      "session-001",
      "create_github_account",
      { employee_name: "Priya Sharma", employee_email: "priya@company.com", department: "Engineering" }
    );

    expect(result.cached).toBe(true);
    expect(markStepCompleted).not.toHaveBeenCalled();
  });

  test("saves result after execution", async () => {
    await executeTool(
      "session-001",
      "create_github_account",
      { employee_name: "Priya Sharma", employee_email: "priya@company.com", department: "Engineering" }
    );

    expect(markStepCompleted).toHaveBeenCalledWith(
      "session-001",
      "create_github_account",
      expect.objectContaining({ success: true })
    );
  });

});

// ══════════════════════════════════════════
// create_slack_account
// ══════════════════════════════════════════
describe("create_slack_account", () => {

  test("returns success with handle and channels", async () => {
    const result = await executeTool(
      "session-001",
      "create_slack_account",
      {
        employee_name:  "Priya Sharma",
        employee_email: "priya@company.com",
        department:     "Engineering",
      }
    );

    expect(result.success).toBe(true);
    expect(result.handle).toContain("@");
    expect(result.channels).toContain("#general");
    expect(result.channels).toContain("#engineering");
  });

  test("includes department channel", async () => {
    const result = await executeTool(
      "session-001",
      "create_slack_account",
      { employee_name: "Jane", employee_email: "jane@co.com", department: "Marketing" }
    );

    expect(result.channels).toContain("#marketing");
  });

});

// ══════════════════════════════════════════
// assign_equipment
// ══════════════════════════════════════════
describe("assign_equipment", () => {

  test("assigns MacBook Pro for senior engineer", async () => {
    const result = await executeTool(
      "session-001",
      "assign_equipment",
      { employee_name: "Priya Sharma", role: "Senior Engineer" }
    );

    expect(result.success).toBe(true);
    expect(result.items).toContain("MacBook Pro 16-inch M3");
  });

  test("assigns MacBook Air for non-senior role", async () => {
    const result = await executeTool(
      "session-001",
      "assign_equipment",
      { employee_name: "Bob Smith", role: "Designer" }
    );

    expect(result.success).toBe(true);
    expect(result.items).toContain("MacBook Air M2");
  });

  test("always includes monitor and peripherals", async () => {
    const result = await executeTool(
      "session-001",
      "assign_equipment",
      { employee_name: "Alice", role: "Engineer" }
    );

    expect(result.items).toContain("27-inch Monitor");
    expect(result.items).toContain("Mechanical Keyboard");
  });

});

// ══════════════════════════════════════════
// request_manager_approval
// ══════════════════════════════════════════
describe("request_manager_approval", () => {

  test("returns approval_requested flag", async () => {
    const result = await executeTool(
      "session-001",
      "request_manager_approval",
      {
        employee_name: "Priya Sharma",
        employee_role: "Senior Engineer",
        manager_email: "manager@company.com",
        summary:       "GitHub ✅ Slack ✅ Jira ✅",
      }
    );

    expect(result.success).toBe(true);
    expect(result.approval_requested).toBe(true);
  });

  test("does NOT save to completed_steps (approval is special)", async () => {
    await executeTool(
      "session-001",
      "request_manager_approval",
      {
        employee_name: "Priya",
        employee_role: "Engineer",
        manager_email: "mgr@company.com",
        summary:       "All done",
      }
    );

    // request_manager_approval is NOT saved to idempotency table
    expect(markStepCompleted).not.toHaveBeenCalled();
  });

});

// ══════════════════════════════════════════
// complete_onboarding
// ══════════════════════════════════════════
describe("complete_onboarding", () => {

  test("returns FULLY ONBOARDED status", async () => {
    const result = await executeTool(
      "session-001",
      "complete_onboarding",
      {
        employee_name:    "Priya Sharma",
        completed_steps:  ["github", "slack", "jira", "equipment"],
      }
    );

    expect(result.success).toBe(true);
    expect(result.status).toContain("FULLY ONBOARDED");
    expect(result.completed_at).toBeDefined();
  });

  test("returns correct step count", async () => {
    const steps = ["github", "slack", "jira", "equipment", "orientation"];
    const result = await executeTool(
      "session-001",
      "complete_onboarding",
      { employee_name: "Priya", completed_steps: steps }
    );

    expect(result.total_steps).toBe(5);
  });

});

// ══════════════════════════════════════════
// Unknown tool
// ══════════════════════════════════════════
describe("unknown tool", () => {

  test("returns error for unknown tool name", async () => {
    const result = await executeTool(
      "session-001",
      "nonexistent_tool",
      {}
    );

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Unknown tool");
  });

});

// ══════════════════════════════════════════
// Idempotency — cross-tool check
// ══════════════════════════════════════════
describe("Idempotency pattern", () => {

  test("checks DB before every tool execution", async () => {
    await executeTool(
      "session-001",
      "create_github_account",
      { employee_name: "Priya", employee_email: "priya@co.com", department: "Eng" }
    );

    expect(isStepCompleted).toHaveBeenCalledWith("session-001", "create_github_account");
  });

  test("never calls markStepCompleted when cached result exists", async () => {
    isStepCompleted.mockResolvedValue({ success: true, cached: true });

    await executeTool(
      "session-001",
      "create_slack_account",
      { employee_name: "Priya", employee_email: "priya@co.com", department: "Eng" }
    );

    expect(markStepCompleted).not.toHaveBeenCalled();
  });

  test("always calls markStepCompleted on fresh execution", async () => {
    isStepCompleted.mockResolvedValue(null); // not cached

    await executeTool(
      "session-001",
      "create_jira_account",
      { employee_name: "Priya", employee_email: "priya@co.com", role: "Engineer" }
    );

    expect(markStepCompleted).toHaveBeenCalledTimes(1);
  });

});
