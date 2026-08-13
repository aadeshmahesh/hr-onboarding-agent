import fs   from "fs";
import path from "path";

const LOG_DIR  = "./logs";
const SESSION  = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_FILE = path.join(LOG_DIR, `session-${SESSION}.txt`);

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function write(lines) {
  const text = lines.join("\n") + "\n";
  fs.appendFileSync(LOG_FILE, text, "utf8");
  process.stdout.write(text);
}

const div = (c = "─", w = 60) => c.repeat(w);
const ts  = () => new Date().toISOString();

export function logSessionStart(sessionId, employee) {
  write([
    "",
    "╔" + "═".repeat(58) + "╗",
    "║     HR ONBOARDING AGENT — SESSION LOG" + " ".repeat(19) + "║",
    "╚" + "═".repeat(58) + "╝",
    `Started    : ${ts()}`,
    `Session ID : ${sessionId}`,
    `Employee   : ${employee.name} (${employee.role})`,
    `Department : ${employee.department}`,
    `Manager    : ${employee.managerEmail}`,
    `Provider   : Anthropic Claude (claude-sonnet-4-6)`,
    "",
  ]);
}

export function logSystemPrompt(prompt) {
  write([div(), "📋 SYSTEM PROMPT", div(), prompt, ""]);
}

export function logStateChange(from, to) {
  write([`🔄 STATE: ${from} → ${to}  [${ts()}]`, ""]);
}

export function logLLMRequest(turn, messages) {
  write([
    div(),
    `🤖 LLM REQUEST — Turn ${turn}  [${ts()}]`,
    div(),
    `Messages in context : ${messages.length}`,
    `Last role           : ${messages[messages.length - 1]?.role}`,
    "",
    "Full messages:",
    JSON.stringify(messages, null, 2),
    "",
  ]);
}

export function logLLMResponse(turn, stopReason, inputTokens, outputTokens) {
  write([
    `🧠 LLM RESPONSE — Turn ${turn}`,
    div("·"),
    `stop_reason   : ${stopReason}`,
    `Input tokens  : ${inputTokens}`,
    `Output tokens : ${outputTokens}`,
    "",
  ]);
}

export function logLLMDecision(turn, toolCalls, finalText) {
  if (toolCalls?.length > 0) {
    write([
      `🎯 LLM DECISION — Turn ${turn}`,
      div("·"),
      `Decision : CALL ${toolCalls.length} TOOL(S)`,
      ...toolCalls.map((tc, i) =>
        `  Tool ${i+1}: ${tc.name}\n  Input  : ${JSON.stringify(tc.input, null, 2)}`
      ),
      "",
    ]);
  } else {
    write([
      `🎯 LLM DECISION — Turn ${turn}`,
      div("·"),
      `Decision : FINAL RESPONSE`,
      `Text     : ${finalText?.substring(0, 300)}`,
      "",
    ]);
  }
}

export function logToolCall(name, input, cached = false) {
  write([
    `🔧 TOOL ${cached ? "(CACHED)" : "CALL"} : ${name}  [${ts()}]`,
    div("·"),
    "Input:",
    JSON.stringify(input, null, 2),
    "",
  ]);
}

export function logToolResult(name, result) {
  write([
    `📋 TOOL RESULT : ${name}`,
    div("·"),
    JSON.stringify(result, null, 2),
    "",
  ]);
}

export function logPause(sessionId, approvalToken) {
  write([
    div("═"),
    "⏸  AGENT PAUSED — WAITING FOR HUMAN APPROVAL",
    div("─"),
    `Session ID     : ${sessionId}`,
    `Approval token : ${approvalToken}`,
    `State saved to : Neon DB`,
    div("═"),
    "",
  ]);
}

export function logResume(sessionId, action) {
  write([
    div("═"),
    `▶️  AGENT RESUMING — Manager ${action.toUpperCase()}`,
    div("─"),
    `Session ID : ${sessionId}`,
    `Action     : ${action}`,
    `Time       : ${ts()}`,
    div("═"),
    "",
  ]);
}

export function logFinalResponse(text) {
  write([div(), "✅ FINAL RESPONSE", div(), text, ""]);
}

export function logSessionEnd(turns, inputTokens, outputTokens) {
  const cost = ((inputTokens * 3) + (outputTokens * 15)) / 1_000_000;
  write([
    div("═"),
    "SESSION COMPLETE",
    div("─"),
    `Turns         : ${turns}`,
    `Input tokens  : ${inputTokens}`,
    `Output tokens : ${outputTokens}`,
    `Approx cost   : $${cost.toFixed(6)}`,
    `Ended at      : ${ts()}`,
    div("═"),
    "",
  ]);
}

export function logError(context, err) {
  write([
    `❌ ERROR in ${context}  [${ts()}]`,
    div("·"),
    `Message : ${err.message}`,
    `Stack   : ${err.stack || "N/A"}`,
    "",
  ]);
}
