import { sendWhatsappMessage } from "./sendWhatsappMessage.js";
import { runFlow } from "../flow/flow.controller.js";

export async function handleReply(message) {
  try {
    console.log("Incoming Reply:", message);

    const phone = message.from;
    const customer_id = message.customer_id;
    const contact_id = message.contact_id;

    const userMessage = message.buttonId || message.message;
    console.log("User Input:", userMessage);

    // Run the flow
    const flowResponse = await runFlow({
      phone,
      customer_id,
      contact_id,
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
    };

    // TEXT Response
    if (reply.type === "text") {
      sendBody.text = reply.text || "";
    }

    // INTERACTIVE Response (Buttons / List)
    if (reply.type === "interactive" || reply.type === "text-button") {
      sendBody.type = "interactive";

      sendBody.bodyText = reply.interactiveButtonsBody || "";
      sendBody.footerText = reply.interactiveButtonsFooter || "";
      sendBody.headerText = reply.interactiveButtonsHeader?.text || "";
     // sendBody.headerTypeInteractive = reply.interactiveButtonsHeader?.type ;
      sendBody.buttons = (reply.interactiveButtonsItems || []).map((btn) => ({
        id: btn.id,
        title: btn.buttonText?.trim() || "",
      }));

      if (reply.interactiveButtonsHeader?.media?.id) {
        sendBody.headerMediaId = reply.interactiveButtonsHeader.media.id;
      }
    }

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
