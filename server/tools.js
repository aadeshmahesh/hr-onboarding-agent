import { z }                              from "zod";
import { isStepCompleted, markStepCompleted } from "./db.js";

// ── Tool schemas ──
export const tools = [
  {
    name:        "get_employee_details",
    description: "Get full details of the employee being onboarded. Call this first.",
    input_schema: {
      type: "object",
      properties: {
        employee_id: { type: "string", description: "Employee ID" },
      },
      required: ["employee_id"],
    },
  },
  {
    name:        "create_github_account",
    description: "Create GitHub account for the new employee.",
    input_schema: {
      type: "object",
      properties: {
        employee_name:  { type: "string" },
        employee_email: { type: "string" },
        department:     { type: "string" },
      },
      required: ["employee_name", "employee_email", "department"],
    },
  },
  {
    name:        "create_slack_account",
    description: "Create Slack account and add to team channels.",
    input_schema: {
      type: "object",
      properties: {
        employee_name:  { type: "string" },
        employee_email: { type: "string" },
        department:     { type: "string" },
      },
      required: ["employee_name", "employee_email", "department"],
    },
  },
  {
    name:        "create_jira_account",
    description: "Create Jira account with appropriate project access.",
    input_schema: {
      type: "object",
      properties: {
        employee_name:  { type: "string" },
        employee_email: { type: "string" },
        role:           { type: "string" },
      },
      required: ["employee_name", "employee_email", "role"],
    },
  },
  {
    name:        "assign_equipment",
    description: "Assign laptop, monitors, and equipment for new employee.",
    input_schema: {
      type: "object",
      properties: {
        employee_name: { type: "string" },
        role:          { type: "string" },
        department:    { type: "string" },
      },
      required: ["employee_name", "role"],
    },
  },
  {
    name:        "schedule_orientation",
    description: "Schedule orientation session for the new employee.",
    input_schema: {
      type: "object",
      properties: {
        employee_name:  { type: "string" },
        employee_email: { type: "string" },
        start_date:     { type: "string", description: "Start date YYYY-MM-DD" },
      },
      required: ["employee_name", "employee_email", "start_date"],
    },
  },
  {
    name:        "request_manager_approval",
    description: "Send approval request to manager. Agent pauses here and waits for human approval before continuing.",
    input_schema: {
      type: "object",
      properties: {
        employee_name:  { type: "string" },
        employee_role:  { type: "string" },
        manager_email:  { type: "string" },
        summary:        { type: "string", description: "Summary of what was set up" },
      },
      required: ["employee_name", "employee_role", "manager_email", "summary"],
    },
  },
  {
    name:        "send_welcome_email",
    description: "Send welcome email to new employee after manager approval.",
    input_schema: {
      type: "object",
      properties: {
        employee_name:  { type: "string" },
        employee_email: { type: "string" },
        employee_role:  { type: "string" },
        department:     { type: "string" },
      },
      required: ["employee_name", "employee_email", "employee_role", "department"],
    },
  },
  {
    name:        "notify_team",
    description: "Notify the team about the new employee joining.",
    input_schema: {
      type: "object",
      properties: {
        employee_name: { type: "string" },
        employee_role: { type: "string" },
        department:    { type: "string" },
        start_date:    { type: "string" },
      },
      required: ["employee_name", "employee_role", "department"],
    },
  },
  {
    name:        "complete_onboarding",
    description: "Mark onboarding as complete and generate final report.",
    input_schema: {
      type: "object",
      properties: {
        employee_name: { type: "string" },
        completed_steps: { type: "array", items: { type: "string" } },
      },
      required: ["employee_name", "completed_steps"],
    },
  },
];

// ── Tool executor with idempotency ──
export async function executeTool(sessionId, name, input) {

  // ── Check idempotency — skip if already done ──
  const cached = await isStepCompleted(sessionId, name);
  if (cached) {
    console.log(`[Tool] ${name} already completed — using cached result`);
    return { ...cached, cached: true };
  }

  let result;

  switch (name) {

    case "get_employee_details": {
      // Mock — in production fetch from HRIS
      result = {
        employee_id:    input.employee_id,
        name:           "Priya Sharma",
        email:          "priya.sharma@company.com",
        role:           "Senior Frontend Engineer",
        department:     "Engineering",
        manager_email:  "manager@company.com",
        start_date:     "2026-08-15",
        location:       "Scottsdale, AZ",
      };
      break;
    }

    case "create_github_account": {
      // Mock — in production call GitHub API
      const username = input.employee_name
        .toLowerCase()
        .replace(/\s+/g, ".");

      result = {
        success:    true,
        username:   username,
        profile:    `https://github.com/${username}`,
        teams:      [input.department.toLowerCase(), "all-employees"],
        repos_access: ["main-app", "docs", "infrastructure"],
      };
      break;
    }

    case "create_slack_account": {
      // Mock — in production call Slack API
      result = {
        success:  true,
        handle:   `@${input.employee_name.toLowerCase().replace(/\s+/g, ".")}`,
        channels: [
          "#general", "#engineering", "#random",
          `#${input.department.toLowerCase()}`
        ],
      };
      break;
    }

    case "create_jira_account": {
      // Mock — in production call Atlassian API
      result = {
        success:       true,
        account_id:    `jira-${Date.now()}`,
        projects:      ["ENG", "INFRA", "DOCS"],
        role_in_jira:  input.role.includes("Senior") ? "Developer" : "Junior Developer",
      };
      break;
    }

    case "assign_equipment": {
      // Mock — in production call IT asset system
      const isEngineer = input.role.toLowerCase().includes("engineer");
      result = {
        success:   true,
        items:     [
          isEngineer ? "MacBook Pro 16-inch M3" : "MacBook Air M2",
          "27-inch Monitor",
          "Mechanical Keyboard",
          "Magic Mouse",
          "Headphones",
        ],
        tracking:  `EQ-${Date.now()}`,
        delivery:  "Ready for pickup on day 1",
      };
      break;
    }

    case "schedule_orientation": {
      // Mock — in production call Google Calendar API
      result = {
        success:    true,
        date:       input.start_date,
        time:       "9:00 AM - 12:00 PM MST",
        location:   "Scottsdale Office — Room 101",
        agenda:     [
          "Company overview (9:00 AM)",
          "IT setup and tools (10:00 AM)",
          "Team introductions (11:00 AM)",
          "HR paperwork (11:30 AM)",
        ],
        calendar_invite: `cal-invite-${Date.now()}@company.com`,
      };
      break;
    }

    case "request_manager_approval": {
      // This tool triggers the PAUSE
      // Actual email sending handled in agent.js
      result = {
        success:       true,
        approval_requested: true,
        manager_email: input.manager_email,
        summary:       input.summary,
        note:          "Agent pausing — waiting for manager approval",
      };
      break;
    }

    case "send_welcome_email": {
      // Mock — in production use Resend
      result = {
        success: true,
        to:      input.employee_email,
        subject: `Welcome to the team, ${input.employee_name}! 🎉`,
        mocked:  true,
      };
      break;
    }

    case "notify_team": {
      // Mock — in production post to Slack #general
      result = {
        success:  true,
        channel:  "#general",
        message:  `🎉 Please welcome ${input.employee_name} joining as ${input.employee_role} in ${input.department}!`,
        mocked:   true,
      };
      break;
    }

    case "complete_onboarding": {
      result = {
        success:         true,
        employee:        input.employee_name,
        completed_steps: input.completed_steps,
        total_steps:     input.completed_steps.length,
        status:          "FULLY ONBOARDED ✅",
        completed_at:    new Date().toISOString(),
      };
      break;
    }

    default:
      result = { error: `Unknown tool: ${name}` };
  }

  // ── Save completed step for idempotency ──
  if (!result.error && name !== "request_manager_approval") {
    await markStepCompleted(sessionId, name, result);
  }

  return result;
}
