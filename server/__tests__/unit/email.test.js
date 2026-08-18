// __tests__/unit/email.test.js
// Tests email functions — mocked (no real emails sent)

import { jest } from "@jest/globals";
import { sendApprovalEmail, sendWelcomeEmail, sendRejectionEmail } from "../../email.js";

// Set required env vars
process.env.FRONTEND_URL = "http://localhost:5177";

// ══════════════════════════════════════════
// sendApprovalEmail
// ══════════════════════════════════════════
describe("sendApprovalEmail", () => {

  test("returns mocked:true (no real email sent)", async () => {
    const result = await sendApprovalEmail({
      managerEmail:  "manager@company.com",
      employeeName:  "Priya Sharma",
      employeeRole:  "Senior Engineer",
      employeeDept:  "Engineering",
      sessionId:     "session-001",
      approvalToken: "token-xyz",
    });

    expect(result.mocked).toBe(true);
  });

  test("returns correct approve URL with token", async () => {
    const result = await sendApprovalEmail({
      managerEmail:  "manager@company.com",
      employeeName:  "Priya Sharma",
      employeeRole:  "Engineer",
      employeeDept:  "Engineering",
      sessionId:     "session-001",
      approvalToken: "token-xyz",
    });

    expect(result.approveUrl).toContain("token-xyz");
    expect(result.approveUrl).toContain("action=approve");
  });

  test("returns correct reject URL with token", async () => {
    const result = await sendApprovalEmail({
      managerEmail:  "manager@company.com",
      employeeName:  "Priya Sharma",
      employeeRole:  "Engineer",
      employeeDept:  "Engineering",
      sessionId:     "session-001",
      approvalToken: "token-xyz",
    });

    expect(result.rejectUrl).toContain("token-xyz");
    expect(result.rejectUrl).toContain("action=reject");
  });

  test("includes FRONTEND_URL in approve URL", async () => {
    const result = await sendApprovalEmail({
      managerEmail:  "manager@company.com",
      employeeName:  "Test",
      employeeRole:  "Engineer",
      employeeDept:  "Eng",
      sessionId:     "s1",
      approvalToken: "tok1",
    });

    expect(result.approveUrl).toContain("http://localhost:5177");
  });

  test("returns manager email in result", async () => {
    const result = await sendApprovalEmail({
      managerEmail:  "boss@company.com",
      employeeName:  "Test",
      employeeRole:  "Engineer",
      employeeDept:  "Eng",
      sessionId:     "s1",
      approvalToken: "tok1",
    });

    expect(result.managerEmail).toBe("boss@company.com");
  });

});

// ══════════════════════════════════════════
// sendWelcomeEmail
// ══════════════════════════════════════════
describe("sendWelcomeEmail", () => {

  test("returns mocked:true", async () => {
    const result = await sendWelcomeEmail({
      employeeEmail: "priya@company.com",
      employeeName:  "Priya Sharma",
      employeeRole:  "Engineer",
      employeeDept:  "Engineering",
    });

    expect(result.mocked).toBe(true);
  });

  test("returns employee email in result", async () => {
    const result = await sendWelcomeEmail({
      employeeEmail: "priya@company.com",
      employeeName:  "Priya Sharma",
      employeeRole:  "Engineer",
      employeeDept:  "Engineering",
    });

    expect(result.employeeEmail).toBe("priya@company.com");
  });

});

// ══════════════════════════════════════════
// sendRejectionEmail
// ══════════════════════════════════════════
describe("sendRejectionEmail", () => {

  test("returns mocked:true", async () => {
    const result = await sendRejectionEmail({
      employeeEmail: "priya@company.com",
      employeeName:  "Priya Sharma",
      reason:        "Budget freeze",
    });

    expect(result.mocked).toBe(true);
  });

  test("returns employee email in result", async () => {
    const result = await sendRejectionEmail({
      employeeEmail: "priya@company.com",
      employeeName:  "Priya",
      reason:        "On hold",
    });

    expect(result.employeeEmail).toBe("priya@company.com");
  });

});
