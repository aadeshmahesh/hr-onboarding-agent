import "dotenv/config";
import express                    from "express";
import cors                       from "cors";
import { initDB, loadSession,
         loadSessionByToken,
         getAllSessions }          from "./db.js";
import { startOnboarding,
         resumeOnboarding }        from "./agent.js";

const app  = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// ── Health check ──
app.get("/health", (req, res) => {
  res.json({
    status:   "ok",
    provider: "anthropic",
    model:    "claude-sonnet-4-6",
  });
});

// ── Start onboarding ──
app.post("/onboard", async (req, res) => {
  const {
    employeeName, employeeEmail, employeeRole,
    employeeDept, managerEmail, startDate, employeeId,
  } = req.body;

  if (!employeeName || !employeeEmail || !employeeRole || !managerEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { sessionId, approvalToken } = await startOnboarding({
      employeeName, employeeEmail, employeeRole,
      employeeDept: employeeDept || "Engineering",
      managerEmail, startDate:   startDate || "2026-08-15",
      employeeId:   employeeId  || `EMP-${Date.now()}`,
    });

    res.json({
      sessionId,
      message: "Onboarding started! Agent is running in background.",
      poll:    `/session/${sessionId}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get session status ──
app.get("/session/:id", async (req, res) => {
  const session = await loadSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  res.json({
    sessionId:     session.session_id,
    employeeName:  session.employee_name,
    employeeRole:  session.employee_role,
    state:         session.state,
    steps:         session.steps,
    createdAt:     session.created_at,
    updatedAt:     session.updated_at,
    completedAt:   session.completed_at,
    approvalToken: session.state === "waiting_approval"
      ? session.approval_token : undefined,
  });
});

// ── Webhook — manager approves/rejects ──
app.get("/approve", async (req, res) => {
  const { token, action } = req.query;

  if (!token || !["approve", "reject"].includes(action)) {
    return res.status(400).send("Invalid request");
  }

  try {
    const result = await resumeOnboarding(
      token,
      action,
      req.query.approvedBy    || "Manager",
      req.query.rejectReason  || "Not specified",
    );

    // Redirect to frontend with result
    res.redirect(
      `${process.env.FRONTEND_URL}?session=${result.sessionId}&action=${action}`
    );
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ── Webhook — JSON version ──
app.post("/webhook/approval", async (req, res) => {
  const { token, action, approvedBy, rejectionReason } = req.body;

  if (!token || !action) {
    return res.status(400).json({ error: "token and action required" });
  }

  try {
    const result = await resumeOnboarding(
      token, action, approvedBy, rejectionReason
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Get all sessions (dashboard) ──
app.get("/sessions", async (req, res) => {
  const sessions = await getAllSessions();
  res.json({ sessions });
});

// Init DB then start (only when not in test mode)
if (process.env.NODE_ENV !== "test") {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`\n✅ HR Onboarding Agent running on http://localhost:${PORT}`);
      console.log(`   POST /onboard          Start onboarding`);
      console.log(`   GET  /session/:id      Check session status`);
      console.log(`   GET  /approve?token=.. Manager approval webhook`);
      console.log(`   POST /webhook/approval JSON webhook`);
      console.log(`   GET  /sessions         All sessions dashboard\n`);
    });
  });
}

export default app;
