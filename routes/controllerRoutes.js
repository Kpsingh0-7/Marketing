import { Router } from "express";
import multer from "multer";
import axios from "axios";
import qs from "qs";

import { authenticateToken } from "../middleware/authenticateToken.js";
import { createWebhookHandler } from "../webhooks/webhook.js";

// Controllers that don't need io
import { getTemplate } from "../controllers/template/getTemplate.js";
import { sendTemplate } from "../controllers/chat/sendTemplate.js";
import { sendTemplates } from "../controllers/chat/sendTemplates.js";
import { sendOTPTemplate } from "../controllers/chat/sendOTPTemplate.js";
import { createTemplate } from "../controllers/template/createTemplate.js";
import { deleteTemplate } from "../controllers/template/deleteTemplate.js";
import { updateTemplate } from "../controllers/template/editTemplate.js";
import { setupSubscription } from "../controllers/template/setSubscription.js";
import { addGroup } from "../controllers/group/addGroup.js";
import { sendBroadcast } from "../controllers/broadcast/sendBroadcast.js";
import { getBroadcastCustomers } from "../controllers/broadcast/getBroadcastCustomers.js";
import { getBroadcasts } from "../controllers/broadcast/getBroadcasts.js";
import { getTemplateAnalytics } from "../controllers/template/getTemplateAnalytics.js";
import { loginUser, getMe, logoutUser } from "../controllers/login.js";

// Controllers that require io passed (factories)
import { returnTemplates } from "../controllers/chat/returnTemplates.js";
import { returnMessages } from "../controllers/chat/returnMessages.js";
import { returnGroups } from "../controllers/group/returnGroups.js";
import { returnContacts } from "../controllers/contact/returnContacts.js";
import { returnConversationId } from "../controllers/chat/returnConversationId.js";
import { returnConversations } from "../controllers/chat/returnConversations.js";
import { markMessagesAsRead } from "../controllers/chat/markMessagesAsRead.js";
import { returnCustomerCreditUsage } from "../controllers/credit/returnCustomerCreditUsage.js";

// Controllers you renamed with _ prefix (if needed)
import { addSingleContact } from "../controllers/contact/addSingleContact.js";
import { processConversationMessage } from "../controllers/chat/processConversationMessage.js";
import { updateContact } from "../controllers/contact/updateContact.js";
import { deleteContact } from "../controllers/contact/deleteContact.js";
import { deleteConversations } from "../controllers/chat/deleteConversations.js";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/payment/payment.js";
import { returnAllMessage } from "../controllers/admin/returnAllMessage.js";
import {
  createSubUser,
  getSubUser,
  updateSubUser,
  deleteSubUser,
} from "../controllers/user/subUser.js";
import { deleteGroup } from "../controllers/group/deleteGroup.js";
import { updateGroup } from "../controllers/group/updateGroup.js";
import { returnAllCustomer } from "../controllers/admin/returnAllCustomer.js";
import { sendFlowTemplates } from "../controllers/chat/sendFlowTemplate.js";
import { webhook1 } from "../webhooks/webhook1.js";
import { createGupshupApp } from "../controllers/createGupshupApp.js";
const router = Router();
const upload = multer({ dest: "uploads/" });

export default function createRouter(io) {
  // Public Routes
  router.post("/webhook1", webhook1);
  router.post("/webhook", createWebhookHandler(io));

  // Protected Routes (Requires JWT)
  router.post("/login", loginUser);
  router.post("/create-payment", createRazorpayOrder);
  router.post("/verify-payment", verifyRazorpayPayment);
  router.post("/send", sendTemplate);
  router.post("/sendTemplates", sendTemplates);
  router.post("/sendOTPTemplate", sendOTPTemplate);
  router.post("/subscription", setupSubscription);
  router.post("/createtemplate", createTemplate);
  router.post("/sendmessage", processConversationMessage);
  router.post("/addcustomer", addSingleContact);
  router.post("/addcustomers", upload.single("file"), addGroup);
  router.post("/sendBroadcast", sendBroadcast);
  router.post("/getBroadcastCustomers", getBroadcastCustomers);
  router.post("/markMessagesAsRead", markMessagesAsRead);
  router.post("/createSubUser", createSubUser);
  router.post("/sendFlowTemplates", sendFlowTemplates);
  router.post("/createGupshupApp", createGupshupApp);

  router.post("/logout", logoutUser);

  router.put("/edit", authenticateToken, updateTemplate);
  router.put("/updatecontact", authenticateToken, updateContact);
  router.put("/updatesubuser", updateSubUser);
  router.put("/updateGroup", upload.single("file"), updateGroup);

  router.delete("/deletetemplate", authenticateToken, deleteTemplate);
  router.delete("/deletecontact", authenticateToken, deleteContact);
  router.delete("/deleteconversations", deleteConversations);
  router.delete("/deletesubuser", deleteSubUser);
  router.delete("/deleteGroup", deleteGroup);

  router.get("/me", authenticateToken, getMe);
  router.get("/gettemplates", authenticateToken, getTemplate);
  router.get("/contacts", authenticateToken, returnContacts);
  router.get("/templates", authenticateToken, returnTemplates);
  router.get("/conversations", authenticateToken, returnConversations);
  router.get("/messages", returnMessages);
  router.get("/conversationid", authenticateToken, returnConversationId);
  router.get("/returnGroups", authenticateToken, returnGroups);
  router.get("/getBroadcasts", authenticateToken, getBroadcasts);
  router.get("/getTemplateAnalytics", getTemplateAnalytics);
  router.get("/creditUsage", authenticateToken, returnCustomerCreditUsage);
  router.get("/getsubusers", getSubUser);

  router.get("/returnAllMessage", returnAllMessage);
  router.get("/returnAllCustomer", returnAllCustomer);

  // POST /create-media-template
  // router.post("/create-media-template", async (req, res) => {
  //   const {
  //     appId,
  //     elementName,
  //     languageCode = "en_US",
  //     content,
  //     footer,
  //     category = "MARKETING",
  //     templateType = "TEXT", // must be TEXT when using image in header
  //     vertical = "Food",
  //     example,
  //     exampleHeader, // this is your media handle (image)
  //     enableSample = true,
  //     allowTemplateCategoryChange = false,
  //   } = req.body;

  //   const token = "sk_4830e6e27ce44be5af5892c5913396b8"; // Ideally from .env

  //   const url = `https://partner.gupshup.io/partner/app/${appId}/templates`;

  //   const data = {
  //     appId,
  //     elementName,
  //     languageCode,
  //     content,
  //     footer,
  //     category,
  //     templateType,
  //     vertical,
  //     example,
  //     header: "IMAGE", // <-- image in header
  //     exampleHeader, // <-- media handle for image
  //     enableSample,
  //     allowTemplateCategoryChange,
  //   };

  //   try {
  //     const response = await axios.post(url, qs.stringify(data), {
  //       headers: {
  //         Authorization: token,
  //         "Content-Type": "application/x-www-form-urlencoded",
  //       },
  //     });

  //     res.status(200).json(response.data);
  //   } catch (error) {
  //     const errRes = error.response?.data || error.message;
  //     res.status(error.response?.status || 500).json({ error: errRes });
  //   }
  // });

  router.post("/create-template", async (req, res) => {
    const {
      element_name,
      template_type,
      category,
      language = "en",
      body_text,
      footer,
      media_url,
      media_id,
      sample_text,
      location,
      product,
    } = req.body;

    try {
      const containerMeta = {
        appId: "e6fc2b8d-6e8d-4713-8d91-da5323e400da",
      };

      // TEXT Template
      if (template_type === "TEXT") {
        containerMeta.data = body_text;
        if (footer) containerMeta.footer = footer;

        // IMAGE Template with advanced fields
      } else if (template_type === "IMAGE") {
        containerMeta.data = body_text;
        containerMeta.footer = footer || "";
        containerMeta.mediaUrl = media_url;
        containerMeta.mediaId = media_id;

        containerMeta.enableSample = true;
        containerMeta.sampleText = sample_text || body_text;

        containerMeta.editTemplate = false;
        containerMeta.allowTemplateCategoryChange = false;
        containerMeta.addSecurityRecommendation = false;
        containerMeta.isCPR = false;
        containerMeta.cpr = false;

        // VIDEO Template
      } else if (template_type === "VIDEO") {
        containerMeta.data = body_text;
        containerMeta.footer = footer || "";
        containerMeta.url = media_url;

        // LOCATION Template
      } else if (template_type === "LOCATION") {
        if (!location || !location.longitude || !location.latitude) {
          return res
            .status(400)
            .json({ error: "Location coordinates are required" });
        }
        containerMeta.location = location;

        // PRODUCT Template
      } else if (template_type === "PRODUCT") {
        if (!product || !product.catalogId || !product.productRetailerId) {
          return res.status(400).json({ error: "Product info is required" });
        }
        containerMeta.product = product;
      } else {
        return res.status(400).json({ error: "Invalid template_type" });
      }

      const payload = {
        elementName: element_name,
        templateType: template_type,
        category,
        language,
        containerMeta: JSON.stringify(containerMeta),
      };

      const response = await axios.post(
        "https://partner.gupshup.io/partner/app/template",
        payload,
        {
          headers: {
            accept: "application/json",
            Authorization: "sk_4830e6e27ce44be5af5892c5913396b8", // Use 'Bearer' if needed
            "Content-Type": "application/json",
          },
        }
      );

      res.status(200).json({ success: true, data: response.data });
    } catch (err) {
      console.error("Error creating template:", err.message);
      res
        .status(500)
        .json({ error: "Failed to create template", details: err.message });
    }
  });

  return router;
}
