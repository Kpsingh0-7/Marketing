import fetch from "node-fetch";
import { pool } from "../../config/db.js";

export const updateAppDailyUsageBilling = async (req, res) => {
  const { customer_id } = req.params;

  try {
    // 1️⃣ Get Gupshup config for the customer
    const [configRows] = await pool.query(
      "SELECT gupshup_id AS appId, token AS partnerToken FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
      [customer_id]
    );

    if (!configRows.length) {
      return res.status(404).json({ success: false, message: "Gupshup configuration not found" });
    }

    const { appId, partnerToken } = configRows[0];
    const headers = {
      Authorization: partnerToken,
      accept: "application/json",
    };

    // 2️⃣ Prepare date range
    const startDate = new Date("2025-07-01");
    const today = new Date();
    const startYear = startDate.getFullYear();
    const endYear = today.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const endMonth = today.getMonth() + 1;

    // Helper to fetch discount data by month
    const getDiscountData = async (year, month) => {
      const url = `https://partner.gupshup.io/partner/app/${appId}/discount?year=${year}&month=${month}`;
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      return data.dailyAppDiscountList || [];
    };

    // Helper to fetch usage data by date range (max 30 days per call)
    const getUsageData = async (from, to) => {
      const url = `https://partner.gupshup.io/partner/app/${appId}/usage?from=${from}&to=${to}`;
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      return data.partnerAppUsageList || [];
    };

    const allDiscounts = [];
    const allUsage = [];

    // 3️⃣ Loop through each month from July 2025 to now
    let curr = new Date(startDate);
    while (curr <= today) {
      const year = curr.getFullYear();
      const month = curr.getMonth() + 1;
      const discounts = await getDiscountData(year, month);
      allDiscounts.push(...discounts);
      curr.setMonth(curr.getMonth() + 1);
    }

    // 4️⃣ Split range into chunks of 30 days for usage API
    let chunkStart = new Date(startDate);
    while (chunkStart <= today) {
      const chunkEnd = new Date(chunkStart);
      chunkEnd.setDate(chunkStart.getDate() + 29);
      if (chunkEnd > today) chunkEnd.setTime(today.getTime());

      const fromStr = chunkStart.toISOString().split("T")[0];
      const toStr = chunkEnd.toISOString().split("T")[0];
      const usage = await getUsageData(fromStr, toStr);
      allUsage.push(...usage);

      chunkStart.setDate(chunkStart.getDate() + 30);
    }

    // 5️⃣ Combine data per day and insert/update DB
    for (const usage of allUsage) {
      const discount = allDiscounts.find(
        (d) => d.day === new Date(usage.date).getDate() &&
               d.month === new Date(usage.date).getMonth() + 1 &&
               d.year === new Date(usage.date).getFullYear()
      );

      const dateObj = new Date(usage.date);
      const values = {
        customer_id,
        appId: usage.appId,
        appName: usage.appName || null,
        partnerId: discount?.partnerId || null,
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
        date_ms: dateObj.getTime(),
        date: usage.date,
        currency: usage.currency || "USD",
        gsCap: usage.gsCap || discount?.gsCap || 0,
        gsFees: usage.gsFees || discount?.gsFees || 0,
        waFees: usage.waFees || 0,
        totalFees: usage.totalFees || 0,
        dailyBill: discount?.dailyBill || 0,
        cumulativeBill: usage.cumulativeBill || discount?.cumulativeBill || 0,
        discount: discount?.discount || 0,
        totalMsg: usage.totalMsg || 0,
        incomingMsg: usage.incomingMsg || 0,
        outgoingMsg: usage.outgoingMsg || 0,
        outgoingMediaMsg: usage.outgoingMediaMsg || 0,
        templateMsg: usage.templateMsg || 0,
        templateMediaMsg: usage.templateMediaMsg || 0,
        marketing: usage.marketing || 0,
        mmLiteMarketing: usage.mmLiteMarketing || 0,
        service: usage.service || 0,
        utility: usage.utility || 0,
        freeUtility: usage.freeUtility || 0,
        authentication: usage.authentication || 0,
        internationalAuthentication: usage.internationalAuthentication || 0,
        voiceInMetaFeeUsage: usage.voiceInMetaFeeUsage || 0,
        voiceOutMetaFeeUsage: usage.voiceOutMetaFeeUsage || 0,
        cxPricingEnabled: usage.cxPricingEnabled || 0,
        fep: usage.fep || 0,
        ftc: usage.ftc || 0,
      };

      const sql = `
        INSERT INTO app_daily_usage_billing
        SET ?
        ON DUPLICATE KEY UPDATE ?
      `;
      await pool.query(sql, [values, values]);
    }

    res.json({
      success: true,
      message: "App daily usage billing updated successfully",
      totalInserted: allUsage.length,
    });

  } catch (error) {
    console.error("Error updating billing data:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

 

export const updateDailyUsageBilling = async (customer_id) => {
  try {
    // 1️⃣ Get Gupshup config for the customer
    const [configRows] = await pool.query(
      "SELECT gupshup_id AS appId, token AS partnerToken FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
      [customer_id]
    );

    if (!configRows.length) {
      console.warn(`⚠️ No Gupshup config found for customer ${customer_id}`);
      return;
    }

    const { appId, partnerToken } = configRows[0];
    const headers = {
      Authorization: partnerToken,
      accept: "application/json",
    };

    // 2️⃣ Get yesterday's date
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const fromStr = yesterday.toISOString().split("T")[0];
    const toStr = fromStr; // same day

    console.log(
      `📅 Fetching Gupshup usage for customer_id=${customer_id} | Date: ${fromStr}`
    );

    // 3️⃣ Fetch usage
    const usageUrl = `https://partner.gupshup.io/partner/app/${appId}/usage?from=${fromStr}&to=${toStr}`;
    const usageResp = await fetch(usageUrl, { headers });
    const usageData = await usageResp.json();
    const usageList = usageData.partnerAppUsageList || [];

    // 4️⃣ Fetch discount
    const year = yesterday.getFullYear();
    const month = yesterday.getMonth() + 1;
    const discountUrl = `https://partner.gupshup.io/partner/app/${appId}/discount?year=${year}&month=${month}`;
    const discountResp = await fetch(discountUrl, { headers });
    const discountData = await discountResp.json();
    const discountList = discountData.dailyAppDiscountList || [];

    // 5️⃣ Store in DB
    for (const usage of usageList) {
      const discount = discountList.find(
        (d) =>
          d.day === new Date(usage.date).getDate() &&
          d.month === new Date(usage.date).getMonth() + 1 &&
          d.year === new Date(usage.date).getFullYear()
      );

      const dateObj = new Date(usage.date);
      const values = {
        customer_id,
        appId: usage.appId,
        appName: usage.appName || null,
        partnerId: discount?.partnerId || null,
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
        date_ms: dateObj.getTime(),
        date: usage.date,
        currency: usage.currency || "USD",
        gsCap: usage.gsCap || discount?.gsCap || 0,
        gsFees: usage.gsFees || discount?.gsFees || 0,
        waFees: usage.waFees || 0,
        totalFees: usage.totalFees || 0,
        dailyBill: discount?.dailyBill || 0,
        cumulativeBill: usage.cumulativeBill || discount?.cumulativeBill || 0,
        discount: discount?.discount || 0,
        totalMsg: usage.totalMsg || 0,
        incomingMsg: usage.incomingMsg || 0,
        outgoingMsg: usage.outgoingMsg || 0,
        outgoingMediaMsg: usage.outgoingMediaMsg || 0,
        templateMsg: usage.templateMsg || 0,
        templateMediaMsg: usage.templateMediaMsg || 0,
        marketing: usage.marketing || 0,
        service: usage.service || 0,
        utility: usage.utility || 0,
        authentication: usage.authentication || 0,
      };

      await pool.query(
        `INSERT INTO app_daily_usage_billing SET ? ON DUPLICATE KEY UPDATE ?`,
        [values, values]
      );
    }

    console.log(
      `✅ Completed Gupshup usage update for customer_id=${customer_id} | Records: ${usageList.length}`
    );
  } catch (err) {
    console.error(`❌ Error updating customer ${customer_id}:`, err.message);
  }
};

// Run task for all customers
const runDailyBillingTask = async () => {
  console.log("🚀 Running daily Gupshup usage billing update...");
  const [customers] = await pool.query(
    "SELECT DISTINCT customer_id FROM gupshup_configuration"
  );
  for (const { customer_id } of customers) {
    await updateDailyUsageBilling(customer_id);
  }
  console.log("✅ All customer updates complete.\n");
};

// ⏰ Schedule to run every day at 12:05 AM
const scheduleDaily = () => {
  const now = new Date();
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 5, 0, 0); // Run at 12:05 AM
  const delay = nextMidnight - now;

  setTimeout(() => {
    runDailyBillingTask();
    setInterval(runDailyBillingTask, 24 * 60 * 60 * 1000); // Every 24 hours
  }, delay);
};

// Run once on startup
//runDailyBillingTask();

// Then schedule daily run
scheduleDaily();
