import { pool } from "../../config/db.js";
import cron from "node-cron";
import { sendTemplateService } from "../../services/sendTemplateService.js";

export const sendTemplates = async (req, res) => {
  try {
    const result = await sendTemplateService(req.body);
    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      response: result.response,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
      details: error.details || null,
    });
  }
};


export async function runDripEngine() {
  console.log("🚀 Drip Engine Triggered at:", new Date().toISOString());

  try {
    const [users] = await pool.execute(`
    SELECT du.*, d.drip_json
FROM drip_users du
JOIN drip d ON d.id = du.drip_id
WHERE du.status='running'
AND du.customer_id = d.customer_id
AND (du.next_run_at IS NULL OR du.next_run_at <= NOW())
LIMIT 50;

    `);

    console.log(`📌 Found ${users.length} user(s) to process`);

    for (const user of users) {
      console.log(
        `➡ Processing User ID: ${user.id}, Phone: ${user.phone}, Current Step: ${user.next_step}`
      );

      // Parse flow JSON once
      let drip;

      try {
        drip =
          typeof user.drip_json === "string"
            ? JSON.parse(user.drip_json)
            : user.drip_json; // already parsed object
      } catch (err) {
        console.error("❌ Invalid JSON:", err.message, user.drip_json);
        await handleError(user, err);
        continue;
      }

      // Matching step
      const step = drip.steps.find((s) => s.step === user.next_step);

      if (!step) {
        console.log(
          `🏁 No matching step found. Marking user ${user.id} as completed.`
        );
        await completeUser(user.id);
        continue;
      }

      console.log(
        `📨 Sending Step ${step.step} (${step.step_name}) using Template: ${step.template_name}`
      );

      await processStep(user, step);
    }

    console.log("✨ Drip Engine Execution Completed");
  } catch (error) {
    console.error("❌ Drip Engine Execution Error:", error);
  }
}

async function processStep(user, step) {
  try {
   await sendTemplateService({
  phoneNumber: user.phone,
  name: user.name || "Customer",
  shop_id: user.customer_id,
  element_name: step.template_name,
  languageCode: step.languageCode,
  parameters: step.parameters,
});

    console.log(`✔ Message sent successfully to ${user.phone}`);

    // Schedule next run
    const nextRun = new Date(Date.now() + (step.delay_minutes || 1) * 60000);

    console.log(
      `⏭ Next step scheduled (Step: ${
        user.next_step + 1
      }) for: ${nextRun.toISOString()}`
    );

    await pool.execute(
      `
      UPDATE drip_users
      SET 
        current_step=?, 
        next_step=?, 
        last_sent_at=NOW(), 
        next_run_at=?,
        attempts=0
      WHERE id=?
    `,
      [user.next_step, user.next_step + 1, nextRun, user.id]
    );

    console.log(`🔄 User ${user.id} moved to next step: ${user.next_step + 1}`);
  } catch (error) {
    console.error(`⚠️ Error sending message to ${user.phone}:`, error.message);
    await handleError(user, error);
  }
}

async function completeUser(id) {
  console.log(`🎉 Marking user ${id} as completed`);

  await pool.execute(
    `
    UPDATE drip_users 
    SET status='completed'
    WHERE id=?
  `,
    [id]
  );
}

async function handleError(user, error) {
  console.log(
    `❗ Error logged for user ${user.id} | Retry Attempt #${user.attempts + 1}`
  );

  await pool.execute(
    `
    UPDATE drip_users
    SET attempts = attempts + 1,
        last_error = ?,
        status = IF(attempts + 1 >= 3, 'error', 'running'),
        next_run_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)  -- retry delay
    WHERE id=?
  `,
    [error.message, user.id]
  );

  console.log(
    user.attempts + 1 >= 3
      ? `🚫 User ${user.id} moved to ❌ ERROR state after max retries`
      : `🔁 Retry scheduled in 5 minutes`
  );
}

// 🕒 Runs every 1 minute
cron.schedule("0 * * * *", async () => {
  console.log("\n⏱ Running Drip Scheduler...");
  await runDripEngine();
});
