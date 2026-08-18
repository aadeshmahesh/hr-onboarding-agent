// __tests__/unit/db.test.js
// Tests DB helper functions — mocks Neon SQL to avoid real DB calls

import { jest } from "@jest/globals";

// ── Mock Neon DB ──
jest.unstable_mockModule("@neondatabase/serverless", () => ({
  neon: jest.fn(() => jest.fn()),
}));

// ── Mock dotenv ──
jest.unstable_mockModule("dotenv/config", () => ({}));

process.env.DATABASE_URL = "postgresql://mock:mock@mock/mock";

const { SESSION_STATES } = await import("../../db.js");

// ══════════════════════════════════════════
// SESSION_STATES
// ══════════════════════════════════════════
describe("SESSION_STATES", () => {

  test("has all required states", () => {
    expect(SESSION_STATES.STARTED).toBeDefined();
    expect(SESSION_STATES.WAITING_APPROVAL).toBeDefined();
    expect(SESSION_STATES.APPROVED).toBeDefined();
    expect(SESSION_STATES.REJECTED).toBeDefined();
    expect(SESSION_STATES.COMPLETED).toBeDefined();
    expect(SESSION_STATES.FAILED).toBeDefined();
  });

  test("STARTED state is correct value", () => {
    expect(SESSION_STATES.STARTED).toBe("started");
  });

  test("WAITING_APPROVAL state is correct value", () => {
    expect(SESSION_STATES.WAITING_APPROVAL).toBe("waiting_approval");
  });

  test("COMPLETED state is correct value", () => {
    expect(SESSION_STATES.COMPLETED).toBe("completed");
  });

  test("REJECTED state is correct value", () => {
    expect(SESSION_STATES.REJECTED).toBe("rejected");
  });

  test("state values are all strings", () => {
    Object.values(SESSION_STATES).forEach(state => {
      expect(typeof state).toBe("string");
    });
  });

  test("state machine flow — valid transitions exist", () => {
    const states = Object.values(SESSION_STATES);

    // All required states for the flow exist
    expect(states).toContain("started");
    expect(states).toContain("creating_accounts");
    expect(states).toContain("waiting_approval");
    expect(states).toContain("approved");
    expect(states).toContain("completed");
    expect(states).toContain("rejected");
    expect(states).toContain("failed");
  });

});
