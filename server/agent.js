import "dotenv/config";
import Anthropic        from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import Bottleneck       from "bottleneck";
import {
  saveSession, loadSession, loadSessionByToken, updateState,
  SESSION_STATES,
} from "./db.js";
import { tools, executeTool }           from "./tools.js";
import { sendApprovalEmail, sendWelcomeEmail, sendRejectionEmail } from "./email.js";
import {
  logSessionStart, logSystemPrompt, logStateChange,
  logLLMRequest, logLLMResponse, logLLMDecision,
  logToolCall, logToolResult,
  logPause, logResume, logFinalResponse,
  logSessionEnd, logError,
} from "./logger.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Rate limiter ──
const limiter = new Bottleneck({
  maxConcurrent: 3,
  minTime:       200,
});

// ── System Prompt ──
const SYSTEM_PROMPT = `You are an HR Onboarding Agent. Your job is to fully onboard new employees step by step.

ONBOARDING STEPS (in order):
1. get_employee_details — fetch employee info first
2. create_github_account + create_slack_account + create_jira_account — run in PARALLEL
3. assign_equipment + schedule_orientation — run in PARALLEL
4. request_manager_approval — ALWAYS call this before sending welcome email
   → Agent pauses here until manager approves
5. (After approval) send_welcome_email + notify_team — run in PARALLEL
6. complete_onboarding — final step

IMPORTANT RULES:
- Run independent tools in PARALLEL (same turn)
- ALWAYS call request_manager_approval before welcome email
- Be thorough — complete ALL steps
- After each tool succeeds, confirm and move to next step
- If a tool fails, report it clearly and continue with others`;

// ── Extract tool calls ──
function extractToolCalls(content) {
  return content
    .filter(b => b.type === "tool_use")
    .map(b => ({ id: b.id, name: b.name, input: b.input }));
}

// ── START new onboarding session ──
export async function startOnboarding(employeeData) {
  const sessionId     = uuidv4();
  const approvalToken = uuidv4();

  logSessionStart(sessionId, {
    name:         employeeData.employeeName,
    role:         employeeData.employeeRole,
    department:   employeeData.employeeDept,
    managerEmail: employeeData.managerEmail,
  });

  // Initial session state
  const sessionData = {
    ...employeeData,
    userId:        employeeData.userId || "hr_system",
    state:         SESSION_STATES.STARTED,
    messages:      [],
    steps:         [],
    approvalToken,
  };

  await saveSession(sessionId, sessionData);
  logStateChange("none", SESSION_STATES.STARTED);

  // Start agent loop in background
  runOnboardingAgent(sessionId, employeeData, approvalToken)
    .catch(err => logError("startOnboarding", err));

  return { sessionId, approvalToken };
}

// ── RESUME after manager approval/rejection ──
export async function resumeOnboarding(token, action, approvedBy, rejectionReason) {
  const session = await loadSessionByToken(token);

  if (!session) throw new Error("Session not found");
  if (session.state !== SESSION_STATES.WAITING_APPROVAL) {
    throw new Error(`Cannot resume — session state is: ${session.state}`);
  }

  logResume(session.session_id, action);

  if (action === "approve") {
    await updateState(session.session_id, SESSION_STATES.APPROVED, { approvedBy });

    // Resume agent with approval
    continueAfterApproval(session, approvedBy)
      .catch(err => logError("resumeOnboarding", err));

  } else {
    await updateState(session.session_id, SESSION_STATES.REJECTED, { rejectionReason });

    // Send rejection notification
    await sendRejectionEmail({
      employeeEmail: session.employee_email,
      employeeName:  session.employee_name,
      reason:        rejectionReason,
    });
  }

  return { success: true, action, sessionId: session.session_id };
}

// ── Main agent loop ──
async function runOnboardingAgent(sessionId, employeeData, approvalToken) {
  const session  = await loadSession(sessionId);
  let messages   = session.messages || [];
  let steps      = session.steps    || [];

  // Initial user message
  const userMessage = `Please onboard this new employee:
Name: ${employeeData.employeeName}
Email: ${employeeData.employeeEmail}
Role: ${employeeData.employeeRole}
Department: ${employeeData.employeeDept}
Manager Email: ${employeeData.managerEmail}
Start Date: ${employeeData.startDate}
Employee ID: ${employeeData.employeeId || "EMP-" + Date.now()}`;

  messages.push({ role: "user", content: userMessage });

  logSystemPrompt(SYSTEM_PROMPT);

  await runAgentLoop(
    sessionId, messages, steps, approvalToken,
    employeeData, false
  );
}

// ── Continue after manager approves ──
async function continueAfterApproval(session, approvedBy) {
  const sessionId = session.session_id;
  let messages    = session.messages;
  let steps       = session.steps || [];

  // Add approval message to history
  messages.push({
    role:    "user",
    content: `✅ Manager ${approvedBy || session.manager_email} has APPROVED the onboarding.
Please continue with:
1. send_welcome_email to the employee
2. notify_team about the new hire
3. complete_onboarding`,
  });

  await saveSession(sessionId, {
    userId:        session.user_id,
    employeeName:  session.employee_name,
    employeeEmail: session.employee_email,
    employeeRole:  session.employee_role,
    employeeDept:  session.employee_dept,
    managerEmail:  session.manager_email,
    state:         SESSION_STATES.APPROVED,
    messages,
    steps,
    approvalToken: session.approval_token,
  });

  await runAgentLoop(
    sessionId, messages, steps, session.approval_token,
    {
      employeeName:  session.employee_name,
      employeeEmail: session.employee_email,
      employeeRole:  session.employee_role,
      employeeDept:  session.employee_dept,
      managerEmail:  session.manager_email,
    },
    true  // isResuming
  );
}

// ── Core agentic loop ──
async function runAgentLoop(
  sessionId, messages, steps, approvalToken,
  employeeData, isResuming
) {
  const maxTurns         = 15;
  let turn               = isResuming ? 10 : 0;
  let totalInputTokens   = 0;
  let totalOutputTokens  = 0;
  let approvalRequested  = false;

  while (turn < maxTurns) {
    turn++;

    try {
      logLLMRequest(turn, messages);

      // ── Rate-limited LLM call ──
      const response = await limiter.schedule(() =>
        client.messages.create({
          model:      "claude-sonnet-4-6",
          max_tokens: 2048,
          system:     SYSTEM_PROMPT,
          tools,
          messages,
        })
      );

      totalInputTokens  += response.usage?.input_tokens  || 0;
      totalOutputTokens += response.usage?.output_tokens || 0;

      logLLMResponse(turn, response.stop_reason,
        response.usage?.input_tokens, response.usage?.output_tokens);

      const toolCalls = extractToolCalls(response.content);
      const textBlock = response.content.find(b => b.type === "text");

      logLLMDecision(turn, toolCalls, textBlock?.text);

      // ── Final response ──
      if (response.stop_reason === "end_turn") {
        const finalText = response.content
          .filter(b => b.type === "text")
          .map(b => b.text)
          .join("");

        logFinalResponse(finalText);
        steps.push({ type: "final", content: finalText });

        await saveSession(sessionId, {
          userId:        employeeData.userId || "hr_system",
          employeeName:  employeeData.employeeName,
          employeeEmail: employeeData.employeeEmail,
          employeeRole:  employeeData.employeeRole,
          employeeDept:  employeeData.employeeDept,
          managerEmail:  employeeData.managerEmail,
          state:         SESSION_STATES.COMPLETED,
          messages,
          steps,
          approvalToken,
        });

        logStateChange(
          isResuming ? SESSION_STATES.APPROVED : SESSION_STATES.STARTED,
          SESSION_STATES.COMPLETED
        );

        logSessionEnd(turn, totalInputTokens, totalOutputTokens);
        break;
      }

      // ── Execute tool calls ──
      if (toolCalls.length > 0) {
        messages.push({ role: "assistant", content: response.content });

        const toolResults = [];

        for (const toolCall of toolCalls) {
          logToolCall(toolCall.name, toolCall.input);

          // ── PAUSE on approval request ──
          if (toolCall.name === "request_manager_approval") {
            approvalRequested = true;

            // Send approval email
            const emailResult = await sendApprovalEmail({
              managerEmail:  toolCall.input.manager_email || employeeData.managerEmail,
              employeeName:  toolCall.input.employee_name || employeeData.employeeName,
              employeeRole:  toolCall.input.employee_role || employeeData.employeeRole,
              employeeDept:  employeeData.employeeDept,
              sessionId,
              approvalToken,
            });

            const toolResult = {
              type:        "tool_result",
              tool_use_id: toolCall.id,
              content:     JSON.stringify({
                success:          true,
                approval_pending: true,
                email_sent_to:    employeeData.managerEmail,
                approve_url:      emailResult.approveUrl,
                reject_url:       emailResult.rejectUrl,
              }),
            };

            toolResults.push(toolResult);
            logToolResult(toolCall.name, emailResult);

            steps.push({
              type:   "tool_call",
              name:   toolCall.name,
              args:   toolCall.input,
            });
            steps.push({
              type:   "approval_pending",
              approveUrl: emailResult.approveUrl,
              rejectUrl:  emailResult.rejectUrl,
            });

            // Add tool results then SAVE and PAUSE
            messages.push({ role: "user", content: toolResults });

            await saveSession(sessionId, {
              userId:        employeeData.userId || "hr_system",
              employeeName:  employeeData.employeeName,
              employeeEmail: employeeData.employeeEmail,
              employeeRole:  employeeData.employeeRole,
              employeeDept:  employeeData.employeeDept,
              managerEmail:  employeeData.managerEmail,
              state:         SESSION_STATES.WAITING_APPROVAL,
              messages,
              steps,
              approvalToken,
            });

            logStateChange(SESSION_STATES.CREATING_ACCOUNTS, SESSION_STATES.WAITING_APPROVAL);
            logPause(sessionId, approvalToken);
            return; // ⏸ PAUSE — agent stops here
          }

          // ── Regular tool execution ──
          const result = await executeTool(sessionId, toolCall.name, toolCall.input);
          logToolResult(toolCall.name, result);

          steps.push({ type: "tool_call",   name: toolCall.name, args: toolCall.input });
          steps.push({ type: "tool_result", name: toolCall.name, result });

          toolResults.push({
            type:        "tool_result",
            tool_use_id: toolCall.id,
            content:     JSON.stringify(result),
          });
        }

        messages.push({ role: "user", content: toolResults });

        // Save after every turn
        await saveSession(sessionId, {
          userId:        employeeData.userId || "hr_system",
          employeeName:  employeeData.employeeName,
          employeeEmail: employeeData.employeeEmail,
          employeeRole:  employeeData.employeeRole,
          employeeDept:  employeeData.employeeDept,
          managerEmail:  employeeData.managerEmail,
          state:         SESSION_STATES.CREATING_ACCOUNTS,
          messages,
          steps,
          approvalToken,
        });

        continue;
      }

      break;

    } catch (err) {
      logError(`Turn ${turn}`, err);
      await updateState(sessionId, SESSION_STATES.FAILED);
      throw err;
    }
  }
}
