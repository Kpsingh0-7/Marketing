// import { pool } from "../../config/db.js";
// import { sendBroadcast } from "./sendBroadcast.js";

// export const getContactCustomers = async (req, res) => {
//   const {
//     customer_id,
//     broadcastName,
//     messageType,
//     schedule,
//     scheduleDate,
//     status,
//     type,
//     contacts = [],
//     template_id,
//     template_name,
//   } = req.body;

//   try {
//     if (!broadcastName || !contacts.length || !template_name) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: broadcastName, contacts, or template_name.",
//       });
//     }

//     // ✅ Build phone numbers from the request
//     const phoneNumbers = contacts
//       .map(c =>
//         c.CountryCode && c.Phone
//           ? `${String(c.CountryCode).replace("+", "")}${String(c.Phone)}`
//           : null
//       )
//       .filter(Boolean);

//     if (!phoneNumbers.length) {
//       return res.status(400).json({
//         success: false,
//         message: "No valid phone numbers found in contacts.",
//       });
//     }

//     // ✅ Save broadcast details
//     const [insertResult] = await pool.execute(
//       `INSERT INTO broadcasts
//        (customer_id, broadcast_name, message_type, schedule, schedule_date,
//         status, type, selected_template, template_id)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         customer_id,
//         broadcastName,
//         messageType,
//         schedule,
//         schedule === "Yes" ? new Date(scheduleDate) : null,
//         status,
//         type,
//         template_name,
//         template_id,
//       ]
//     );

//     const broadcast_id = insertResult.insertId;

//     // If scheduled, return now
//     if (schedule === "Yes") {
//       return res.status(200).json({
//         success: true,
//         message: "Broadcast scheduled successfully",
//         broadcast_id,
//       });
//     }

//     // 🚀 Immediate broadcast
//     const fakeRequest = {
//       body: {
//         phoneNumbers,
//         element_name: template_name,
//         customer_id,
//       },
//     };

//     await sendBroadcast(fakeRequest, {
//       status: (code) => ({
//         json: async (data) => {
//           try {
//             const successResults = data.results.filter((r) => r.success);
//             const successCount = successResults.length;

//             const messageValues = successResults
//               .filter((r) => r.response?.messages?.[0]?.id)
//               .map((r) => [
//                 broadcast_id,
//                 r.response.messages[0].id,
//                 r.response.contacts?.[0]?.wa_id || r.phoneNumber,
//                 "sent",
//                 Math.floor(Date.now() / 1000),
//                 null,
//               ]);

//             if (messageValues.length) {
//               const placeholders = messageValues.map(() => "(?,?,?,?,?,?)").join(",");
//               const flatValues = messageValues.flat();
//               await pool.query(
//                 `INSERT INTO broadcast_messages
//                  (broadcast_id, message_id, recipient_id, status, timestamp, error_message)
//                  VALUES ${placeholders}`,
//                 flatValues
//               );
//             }

//             await pool.execute(
//               `UPDATE broadcasts SET status = ?, sent = ? WHERE broadcast_id = ?`,
//               ["Sent", successCount, broadcast_id]
//             );
//           } catch (err) {
//             console.error("❌ Error in fakeResponse.json():", err);
//           }
//         },
//       }),
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Broadcast sent successfully",
//       broadcast_name: broadcastName,
//       element_name: template_name,
//       mobile_numbers: phoneNumbers,
//     });
//   } catch (error) {
//     console.error("❌ Error in getBroadcastCustomers:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

import { pool } from "../../config/db.js";
import { sendBroadcast } from "./sendBroadcast.js";

export const getContactCustomers = async (req, res) => {
  const {
    customer_id,
    broadcastName,
    contacts = [],
    messageType,
    schedule,
    scheduleDate,
    template_name,
    status,
    type,
    template_id,
    parameters = [], // per-recipient body parameters
    languageCode = "en",
    headerType,
    headerValue,
    headerIsId = false,
    buttons = [],
  } = req.body;
  console.log(contacts);
  try {
    if (!broadcastName || !contacts.length || !template_name) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: broadcastName, contacts, or template_name.",
      });
    }

    // ✅ Build phone numbers from the request
    const phoneNumbers = contacts
      .map((c) =>
        c.CountryCode && c.Phone
          ? `${String(c.CountryCode).replace("+", "")}${String(c.Phone)}`
          : null
      )
      .filter(Boolean);

    if (!phoneNumbers.length) {
      return res.status(400).json({
        success: false,
        message: "No valid phone numbers found in contacts.",
      });
    }

    // Prepare contacts JSON if scheduled
    const contactsJson = JSON.stringify(
      contacts.map((c) => ({
        name: c.Name || c.contact_name || "", // fallback if property differs
        phone: c.Phone
          ? c.CountryCode
            ? `+${String(c.CountryCode).replace("+", "")}${c.Phone}`
            : `+${c.Phone}`
          : "",
      }))
    );
    // ✅ Save broadcast details
    const [insertResult] = await pool.execute(
      `INSERT INTO broadcasts
       (customer_id, broadcast_name, message_type, schedule, schedule_date,
        status, type, selected_template, template_id, contacts_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id,
        broadcastName,
        messageType,
        schedule,
        schedule === "Yes" ? new Date(scheduleDate) : null,
        status,
        type,
        template_name,
        template_id,
        contactsJson,
      ]
    );

    const broadcast_id = insertResult.insertId;

    // If scheduled, return now
    if (schedule === "Yes") {
      return res.status(200).json({
        success: true,
        message: "Broadcast scheduled successfully",
        broadcast_id,
      });
    }

    // 🚀 Immediate broadcast
    const fakeRequest = {
      body: {
        phoneNumbers,
        element_name: template_name,
        customer_id,
        parameters,
        languageCode,
        headerType,
        headerValue,
        headerIsId,
        buttons,
      },
    };

    await sendBroadcast(fakeRequest, {
      status: (code) => ({
        json: async (data) => {
          try {
            const successResults = data.results.filter((r) => r.success);
            const successCount = successResults.length;

            const messageValues = successResults
              .filter((r) => r.response?.messages?.[0]?.id)
              .map((r) => [
                broadcast_id,
                r.response.messages[0].id,
                r.response.contacts?.[0]?.wa_id || r.phoneNumber,
                "sent",
                Math.floor(Date.now() / 1000),
                null,
              ]);

            if (messageValues.length) {
              const placeholders = messageValues
                .map(() => "(?,?,?,?,?,?)")
                .join(",");
              const flatValues = messageValues.flat();
              await pool.query(
                `INSERT INTO broadcast_messages
                 (broadcast_id, message_id, recipient_id, status, timestamp, error_message)
                 VALUES ${placeholders}`,
                flatValues
              );
            }

            await pool.execute(
              `UPDATE broadcasts SET status = ?, sent = ? WHERE broadcast_id = ?`,
              ["Sent", successCount, broadcast_id]
            );
          } catch (err) {
            console.error("❌ Error in fakeResponse.json():", err);
          }
        },
      }),
    });

    return res.status(200).json({
      success: true,
      message: "Broadcast sent successfully",
      broadcast_name: broadcastName,
      element_name: template_name,
      mobile_numbers: phoneNumbers,
    });
  } catch (error) {
    console.error("❌ Error in getBroadcastCustomers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
