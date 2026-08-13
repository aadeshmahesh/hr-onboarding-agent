// ── Mocked Email Service ──
// Replace with Resend.com in production:
//   import { Resend } from "resend";
//   const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendApprovalEmail({
  managerEmail,
  employeeName,
  employeeRole,
  employeeDept,
  sessionId,
  approvalToken,
}) {
  const approveUrl = `${process.env.FRONTEND_URL}/approve?token=${approvalToken}&action=approve`;
  const rejectUrl  = `${process.env.FRONTEND_URL}/approve?token=${approvalToken}&action=reject`;

  // ── MOCK — log to console instead of sending ──
  console.log("\n" + "═".repeat(60));
  console.log("📧 APPROVAL EMAIL (MOCKED)");
  console.log("═".repeat(60));
  console.log(`To:      ${managerEmail}`);
  console.log(`Subject: Action Required — Approve onboarding for ${employeeName}`);
  console.log("");
  console.log(`Hi Manager,`);
  console.log("");
  console.log(`New employee onboarding requires your approval:`);
  console.log(`  Name:       ${employeeName}`);
  console.log(`  Role:       ${employeeRole}`);
  console.log(`  Department: ${employeeDept}`);
  console.log("");
  console.log(`Accounts created and ready:`);
  console.log(`  ✅ GitHub account`);
  console.log(`  ✅ Slack account`);
  console.log(`  ✅ Jira account`);
  console.log(`  ✅ Equipment assigned`);
  console.log(`  ✅ Orientation scheduled`);
  console.log("");
  console.log(`APPROVE: ${approveUrl}`);
  console.log(`REJECT:  ${rejectUrl}`);
  console.log("═".repeat(60) + "\n");

  // Return mock result
  return {
    mocked:       true,
    approveUrl,
    rejectUrl,
    managerEmail,
    sessionId,
  };
}

export async function sendWelcomeEmail({
  employeeEmail,
  employeeName,
  employeeRole,
  employeeDept,
}) {
  console.log("\n" + "═".repeat(60));
  console.log("📧 WELCOME EMAIL (MOCKED)");
  console.log("═".repeat(60));
  console.log(`To:      ${employeeEmail}`);
  console.log(`Subject: Welcome to the team, ${employeeName}! 🎉`);
  console.log("");
  console.log(`Hi ${employeeName},`);
  console.log("");
  console.log(`Welcome aboard! Your onboarding is complete.`);
  console.log(`Role: ${employeeRole} — ${employeeDept}`);
  console.log("");
  console.log(`Your accounts are ready:`);
  console.log(`  GitHub: github.com/company`);
  console.log(`  Slack:  company.slack.com`);
  console.log(`  Jira:   company.atlassian.net`);
  console.log("═".repeat(60) + "\n");

  return { mocked: true, employeeEmail };
}

export async function sendRejectionEmail({
  employeeEmail,
  employeeName,
  reason,
}) {
  console.log("\n" + "═".repeat(60));
  console.log("📧 REJECTION EMAIL (MOCKED)");
  console.log("═".repeat(60));
  console.log(`To:      ${employeeEmail}`);
  console.log(`Subject: Onboarding update for ${employeeName}`);
  console.log(`Reason:  ${reason || "No reason provided"}`);
  console.log("═".repeat(60) + "\n");

  return { mocked: true, employeeEmail };
}
