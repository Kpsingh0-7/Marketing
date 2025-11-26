import { sendWhatsappMessage } from "./sendWhatsappMessage.js";
import { runFlow } from "../flow/flow.controller.js";

export async function handleReply(message) {
  try {
    console.log("Incoming Reply:", message);

    const phone = message.from;
    const customer_id = message.customer_id;
    const contact_id = message.contact_id;
    const button_id = message.buttonId;
    const userMessage = message.buttonId || message.message;

    console.log("User Input:", userMessage);

    // Run the flow
    const flowResponse = await runFlow({
      phone,
      customer_id,
      contact_id,
      button_id,
      message: userMessage,
    });

    console.log("flowResponse:", flowResponse);

if (!flowResponse || !flowResponse.reply) {
  console.log("⚠ No flow reply returned.");
  return;
}

const reply = flowResponse.reply;

// ---- Build WhatsApp Message Structure ----
const sendBody = {
  phoneNumber: phone,
  customer_id,
  contact_id,
  type: reply.type,

  ...(reply.type === "interactive" && { interactive: reply.interactive }),
  ...(reply.type === "text" && { text: reply.text }),
  ...(reply.type === "image" && { image: reply.image }),
  ...(reply.type === "video" && { video: reply.video }),
  ...(reply.type === "document" && { document: reply.document }),
};

console.log("Sending in standardized format:", sendBody);

// ---- CALL LIKE YOUR TEMPLATE FUNCTION STYLE ----
const fakeRequest = { body: sendBody };

const fakeResponse = {
  status: (code) => ({
    json: (data) =>
      console.log(`Response (${code}):`, JSON.stringify(data, null, 2)),
  }),
};

await sendWhatsappMessage(fakeRequest, fakeResponse);

  } catch (err) {
    console.error("❌ handleReply error:", err);
  }
}
