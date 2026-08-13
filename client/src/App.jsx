import { useState, useEffect, useRef } from "react";

const SERVER = "http://localhost:3005";

const STATE_CONFIG = {
  started:           { color: "#3b82f6", icon: "🚀", label: "Started" },
  creating_accounts: { color: "#8b5cf6", icon: "⚙️", label: "Creating Accounts" },
  assigning_equipment:{ color: "#f59e0b", icon: "💻", label: "Assigning Equipment" },
  waiting_approval:  { color: "#f97316", icon: "⏸️", label: "Waiting Approval" },
  approved:          { color: "#10b981", icon: "✅", label: "Approved" },
  rejected:          { color: "#ef4444", icon: "❌", label: "Rejected" },
  completed:         { color: "#10b981", icon: "🎉", label: "Completed" },
  failed:            { color: "#ef4444", icon: "💥", label: "Failed" },
};

const TOOL_ICONS = {
  get_employee_details:    "👤",
  create_github_account:   "🐙",
  create_slack_account:    "💬",
  create_jira_account:     "📋",
  assign_equipment:        "💻",
  schedule_orientation:    "📅",
  request_manager_approval:"📧",
  send_welcome_email:      "🎉",
  notify_team:             "📣",
  complete_onboarding:     "✅",
};

// ── Step Card ──
function StepCard({ step, sessionState }) {
  const [expanded, setExpanded] = useState(false);

  if (step.type === "final") {
    return (
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0",
        borderRadius: "10px", padding: "16px", marginBottom: "8px" }}>
        <div style={{ fontWeight: 700, color: "#166534", marginBottom: "8px" }}>
          ✅ Final Response
        </div>
        <div style={{ fontSize: "13px", color: "#166534", lineHeight: 1.7 }}>
          {step.content}
        </div>
      </div>
    );
  }

  if (step.type === "approval_pending") {
    const isApproved = sessionState === "approved" || sessionState === "completed";
    const isRejected = sessionState === "rejected";

    if (isApproved) {
      return (
        <div style={{ background: "#f0fdf4", border: "2px solid #10b981",
          borderRadius: "10px", padding: "16px", marginBottom: "8px" }}>
          <div style={{ fontWeight: 700, color: "#166534", fontSize: "15px" }}>
            ✅ Manager Approved — Agent Resumed
          </div>
        </div>
      );
    }

    if (isRejected) {
      return (
        <div style={{ background: "#fef2f2", border: "2px solid #ef4444",
          borderRadius: "10px", padding: "16px", marginBottom: "8px" }}>
          <div style={{ fontWeight: 700, color: "#dc2626", fontSize: "15px" }}>
            ❌ Manager Rejected Onboarding
          </div>
        </div>
      );
    }

    return (
      <div style={{ background: "#fff7ed", border: "2px solid #f97316",
        borderRadius: "10px", padding: "16px", marginBottom: "8px" }}>
        <div style={{ fontWeight: 700, color: "#c2410c", marginBottom: "12px", fontSize: "15px" }}>
          ⏸️ Agent Paused — Waiting for Manager Approval
        </div>
        <div style={{ fontSize: "13px", color: "#9a3412", marginBottom: "12px" }}>
          Approval email sent to manager. Click links below to simulate:
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <a href={step.approveUrl} target="_blank" rel="noreferrer"
            style={{ padding: "8px 16px", background: "#10b981", color: "white",
              borderRadius: "6px", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>
            ✅ Approve Onboarding
          </a>
          <a href={step.rejectUrl} target="_blank" rel="noreferrer"
            style={{ padding: "8px 16px", background: "#ef4444", color: "white",
              borderRadius: "6px", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>
            ❌ Reject Onboarding
          </a>
        </div>
      </div>
    );
  }

  if (step.type === "tool_call") {
    const icon = TOOL_ICONS[step.name] || "🔧";
    return (
      <div style={{ border: "1px solid #bfdbfe", borderRadius: "8px",
        marginBottom: "6px", background: "#eff6ff", overflow: "hidden" }}>
        <div onClick={() => setExpanded(!expanded)}
          style={{ display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 14px", cursor: "pointer" }}>
          <span style={{ fontSize: "18px" }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "12px", color: "#1e40af",
              textTransform: "uppercase", letterSpacing: "0.05em" }}>Tool Call</div>
            <div style={{ fontSize: "13px", color: "#374151" }}>{step.name}</div>
          </div>
          <span style={{ color: "#9ca3af", fontSize: "11px" }}>{expanded ? "▲" : "▼"}</span>
        </div>
        {expanded && (
          <div style={{ padding: "0 14px 12px" }}>
            <pre style={{ margin: 0, fontSize: "11px", color: "#1e40af",
              background: "#dbeafe", padding: "8px", borderRadius: "6px", overflowX: "auto" }}>
              {JSON.stringify(step.args, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (step.type === "tool_result") {
    const icon = TOOL_ICONS[step.name] || "📋";
    const isSuccess = step.result?.success;

    return (
      <div style={{ border: "1px solid #bbf7d0", borderRadius: "8px",
        marginBottom: "6px", background: "#f0fdf4", overflow: "hidden" }}>
        <div onClick={() => setExpanded(!expanded)}
          style={{ display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 14px", cursor: "pointer" }}>
          <span style={{ fontSize: "18px" }}>{isSuccess ? "✅" : "❌"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "12px", color: "#166534",
              textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tool Result {step.result?.cached ? "(cached)" : ""}
            </div>
            <div style={{ fontSize: "13px", color: "#374151" }}>{step.name}</div>
          </div>
          <span style={{ color: "#9ca3af", fontSize: "11px" }}>{expanded ? "▲" : "▼"}</span>
        </div>
        {expanded && (
          <div style={{ padding: "0 14px 12px" }}>
            <pre style={{ margin: 0, fontSize: "11px", color: "#166534",
              background: "#dcfce7", padding: "8px", borderRadius: "6px", overflowX: "auto" }}>
              {JSON.stringify(step.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Session Card ──
function SessionCard({ session, onSelect }) {
  const config = STATE_CONFIG[session.state] || STATE_CONFIG.started;

  return (
    <div onClick={() => onSelect(session.session_id)}
      style={{ background: "white", border: "1px solid #e2e8f0",
        borderRadius: "10px", padding: "14px 16px", marginBottom: "8px",
        cursor: "pointer", transition: "border-color 0.2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
            {session.employee_name}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            {session.employee_role} · {session.employee_dept}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px",
          padding: "3px 10px", borderRadius: "20px",
          background: `${config.color}20`, color: config.color,
          fontSize: "11px", fontWeight: 700 }}>
          {config.icon} {config.label}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [view,        setView]        = useState("form"); // form | session | sessions | approving
  const [form,        setForm]        = useState({
    employeeName:  "Priya Sharma",
    employeeEmail: "priya.sharma@company.com",
    employeeRole:  "Senior Frontend Engineer",
    employeeDept:  "Engineering",
    managerEmail:  "manager@company.com",
    startDate:     "2026-08-15",
  });
  const [sessionId,   setSessionId]   = useState(null);
  const [session,     setSession]     = useState(null);
  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const pollRef = useRef(null);

  // ── Check for approval redirect ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid    = params.get("session");
    const action = params.get("action");
    const token  = params.get("token");

    // Case 1: redirected back from server after approval
    if (sid && action) {
      setSessionId(sid);
      setView("session");
      window.history.replaceState({}, "", "/");
      return;
    }

    // Case 2: manager clicked approve/reject link directly
    // URL: http://localhost:5177/approve?token=xxx&action=approve
    if (token && action) {
      setView("approving");
      // Call server webhook directly from browser
      fetch(`${SERVER}/webhook/approval`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, action }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.sessionId) {
            setSessionId(data.sessionId);
            setView("session");
          } else {
            setError(data.error || "Approval failed");
            setView("form");
          }
          window.history.replaceState({}, "", "/");
        })
        .catch(err => {
          setError(err.message);
          setView("form");
        });
    }
  }, []);

  // ── Poll session status ──
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const res  = await fetch(`${SERVER}/session/${sessionId}`);
        const data = await res.json();
        setSession(data);

        // Stop polling when done
        if (["completed", "rejected", "failed"].includes(data.state)) {
          clearInterval(pollRef.current);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [sessionId]);

  const handleSubmit = async () => {
    if (!form.employeeName || !form.employeeEmail || !form.managerEmail) {
      setError("Please fill all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res  = await fetch(`${SERVER}/onboard`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setSessionId(data.sessionId);
      setView("session");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    const res  = await fetch(`${SERVER}/sessions`);
    const data = await res.json();
    setSessions(data.sessions || []);
    setView("sessions");
  };

  const stateConfig = session ? (STATE_CONFIG[session.state] || STATE_CONFIG.started) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "32px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "44px", marginBottom: "6px" }}>👥</div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
            HR Onboarding Agent
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            Human-in-the-loop · Persistent State · Webhook Resume · Idempotent Tools
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "12px" }}>
            <button onClick={() => setView("form")}
              style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #e2e8f0",
                background: view === "form" ? "#3b82f6" : "white",
                color: view === "form" ? "white" : "#64748b",
                cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
              New Onboarding
            </button>
            <button onClick={loadSessions}
              style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #e2e8f0",
                background: view === "sessions" ? "#3b82f6" : "white",
                color: view === "sessions" ? "white" : "#64748b",
                cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
              All Sessions
            </button>
          </div>
        </div>

        {/* Form View */}
        {view === "form" && (
          <div style={{ background: "white", borderRadius: "12px", padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              New Employee Details
            </h2>

            {[
              { key: "employeeName",  label: "Employee Name *",  placeholder: "Priya Sharma" },
              { key: "employeeEmail", label: "Employee Email *",  placeholder: "priya@company.com" },
              { key: "employeeRole",  label: "Role *",            placeholder: "Senior Frontend Engineer" },
              { key: "employeeDept",  label: "Department",        placeholder: "Engineering" },
              { key: "managerEmail",  label: "Manager Email *",   placeholder: "manager@company.com" },
              { key: "startDate",     label: "Start Date",        placeholder: "2026-08-15" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600,
                  color: "#374151", marginBottom: "5px" }}>
                  {field.label}
                </label>
                <input
                  type="text"
                  value={form[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "7px",
                    border: "1px solid #e2e8f0", fontSize: "14px", outline: "none",
                    boxSizing: "border-box" }}
                />
              </div>
            ))}

            {error && (
              <div style={{ padding: "10px", background: "#fef2f2",
                border: "1px solid #fecaca", borderRadius: "6px",
                color: "#dc2626", marginBottom: "14px", fontSize: "13px" }}>
                ❌ {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading}
              style={{ width: "100%", padding: "12px",
                background: loading ? "#94a3b8" : "#3b82f6",
                color: "white", border: "none", borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "15px", fontWeight: 700 }}>
              {loading ? "Starting..." : "🚀 Start Onboarding"}
            </button>
          </div>
        )}

        {/* Session View */}
        {view === "session" && session && (
          <div>
            {/* Status header */}
            <div style={{ background: "white", borderRadius: "12px", padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>
                    {session.employeeName}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "3px" }}>
                    {session.employeeRole}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px",
                    fontFamily: "monospace" }}>
                    Session: {session.sessionId}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px", borderRadius: "20px",
                  background: `${stateConfig.color}20`,
                  color: stateConfig.color, fontWeight: 700, fontSize: "13px" }}>
                  {stateConfig.icon} {stateConfig.label}
                </div>
              </div>

              {/* Progress */}
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px",
                  fontFamily: "monospace" }}>
                  ONBOARDING PROGRESS
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {[
                    "get_employee_details",
                    "create_github_account",
                    "create_slack_account",
                    "create_jira_account",
                    "assign_equipment",
                    "schedule_orientation",
                    "request_manager_approval",
                    "send_welcome_email",
                    "notify_team",
                    "complete_onboarding",
                  ].map(step => {
                    const done = session.steps?.some(
                      s => s.type === "tool_result" && s.name === step && s.result?.success
                    );
                    const pending = step === "request_manager_approval" &&
                      session.state === "waiting_approval";

                    return (
                      <div key={step} title={step}
                        style={{ flex: 1, height: "6px", borderRadius: "3px",
                          background: done    ? "#10b981"
                                    : pending ? "#f97316"
                                    : "#e2e8f0" }} />
                    );
                  })}
                </div>
              </div>

              {/* Polling indicator */}
              {!["completed", "rejected", "failed"].includes(session.state) && (
                <div style={{ marginTop: "10px", fontSize: "11px", color: "#94a3b8" }}>
                  🔄 Polling every 3 seconds...
                </div>
              )}
            </div>

            {/* Steps */}
            {session.steps?.length > 0 && (
              <div style={{ background: "white", borderRadius: "12px", padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#374151" }}>
                  Agent Steps ({session.steps.length}) — click to expand
                </h3>
                {session.steps.map((step, i) => (
                  <StepCard key={i} step={step} sessionState={session.state} />
                ))}
              </div>
            )}

            {/* Not loaded yet */}
            {!session.steps?.length && (
              <div style={{ background: "white", borderRadius: "12px", padding: "40px",
                textAlign: "center", color: "#94a3b8", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                ⏳ Agent is starting up...
              </div>
            )}
          </div>
        )}

        {/* Loading session */}
        {view === "session" && !session && (
          <div style={{ background: "white", borderRadius: "12px", padding: "40px",
            textAlign: "center", color: "#94a3b8", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            ⏳ Loading session...
          </div>
        )}

        {/* Approving view */}
        {view === "approving" && (
          <div style={{ background: "white", borderRadius: "12px", padding: "48px",
            textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
              Processing approval...
            </h2>
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Please wait while we resume the onboarding agent.
            </p>
          </div>
        )}

        {/* Sessions list */}
        {view === "sessions" && (
          <div style={{ background: "white", borderRadius: "12px", padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>
              All Onboarding Sessions ({sessions.length})
            </h2>
            {sessions.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: "30px" }}>
                No sessions yet — start a new onboarding!
              </div>
            )}
            {sessions.map(s => (
              <SessionCard
                key={s.session_id}
                session={s}
                onSelect={id => { setSessionId(id); setView("session"); }}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
