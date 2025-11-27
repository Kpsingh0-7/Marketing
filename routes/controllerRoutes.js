import { Router } from "express";
import multer from "multer";

import { authenticateToken } from "../middleware/authenticateToken.js";
import { createWebhookHandler } from "../webhooks/webhook.js";

// Controllers that don't need io
import { getTemplate } from "../controllers/template/getTemplate.js";
import { sendTemplate } from "../controllers/chat/sendTemplate.js";
import { sendTemplates } from "../controllers/chat/sendTemplates.js";
import { sendWhatsappMessage } from "../controllers/chat/sendWhatsappMessage.js";
import { sendOTPTemplate } from "../controllers/chat/sendOTPTemplate.js";
import { createTemplate } from "../controllers/template/createTemplate.js";
import { deleteTemplate } from "../controllers/template/deleteTemplate.js";
import { updateTemplate } from "../controllers/template/editTemplate.js";
import { setupSubscription } from "../controllers/template/setSubscription.js";
import { addGroup } from "../controllers/group/addGroup.js";
import { sendBroadcast } from "../controllers/broadcast/sendBroadcast.js";
import { getBroadcastCustomers } from "../controllers/broadcast/getBroadcastCustomers.js";
import { getContactCustomers } from "../controllers/broadcast/getContactCustomers.js";
import { getBroadcasts } from "../controllers/broadcast/getBroadcasts.js";
import { getTemplateAnalytics } from "../controllers/template/getTemplateAnalytics.js";
import { loginUser, getMe, logoutUser } from "../controllers/login.js";
import { register } from "../controllers/user/register.js";

// Controllers that require io passed (factories)
import { returnTemplates } from "../controllers/chat/returnTemplates.js";
import { returnMessages } from "../controllers/chat/returnMessages.js";
import { returnGroups } from "../controllers/group/returnGroups.js";
import { returnContacts } from "../controllers/contact/returnContacts.js";
import { returnConversations } from "../controllers/chat/returnConversations.js";
import { markMessagesAsRead } from "../controllers/chat/markMessagesAsRead.js";
import { returnCustomerCreditUsage } from "../controllers/credit/returnCustomerCreditUsage.js";

// Controllers you renamed with _ prefix (if needed)
import { addSingleContact } from "../controllers/contact/addSingleContact.js";
import { addBulkContact } from "../controllers/contact/addBulkContact.js";
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
import { createGupshupApp } from "../controllers/createGupshupApp.js";
import { sendtesttemplate } from "../controllers/template/sendTemplate.js";
import { createMediaTemplate } from "../controllers/template/createMediaTemplate.js";
import { uploadMedia } from "../controllers/template/uploadMedia.js";
import { sendMedia } from "../controllers/chat/sendMedia.js";
import { getWabaInfo } from "../controllers/user/getWabaInfo.js";
import { updateBlockedUsers } from "../controllers/user/updateBlockedUsers.js";
import { blockUsers } from "../controllers/user/blockUsers.js";
import { unblockUsers } from "../controllers/user/unblockUsers.js";
import {
  getProfileDetails,
  getProfileAbout,
  getProfilePicture,
  syncWabaInfo,
  updateProfileDetails,
  updateProfileAbout,
  updateProfilePicture,
} from "../controllers/user/wabaProfile.js";

import { updateAppDailyUsageBilling } from "../controllers/credit/updateAppDailyUsageBilling.js";
import { syncContacts } from "../controllers/contact/syncContacts.js";
import { addFlow } from "../controllers/flow/addFlow.js";
import { returnFlow } from "../controllers/flow/returnFlow.js";
import { updateFlow } from "../controllers/flow/updateFlow.js";
import { deleteFlow } from "../controllers/flow/deleteFlow.js";
import { addDrip } from "../controllers/drip/addDrip.js";


const router = Router();
const upload = multer({ dest: "uploads/" });

export default function createRouter(io) {
  // Public Routes

  router.post("/webhook", createWebhookHandler(io));

  // Protected Routes (Requires JWT)
  router.post("/register", register);
  router.post("/login", loginUser);
  router.post("/create-payment", createRazorpayOrder);
  router.post("/verify-payment", verifyRazorpayPayment);
  router.post("/sendmessage", sendTemplate);
  router.post("/sendTemplates", sendTemplates);
  router.post("/sendOTPTemplate", sendOTPTemplate);
  router.post("/subscription", setupSubscription);
  router.post("/createtemplate", createTemplate);
  router.post("/addcustomer", addSingleContact);
  router.post("/addBulkContact", upload.single("file"), addBulkContact);
  router.post("/addcustomers", addGroup);
  router.post("/sendBroadcast", sendBroadcast);
  router.post("/getBroadcastCustomers", getBroadcastCustomers);
  router.post("/getContactCustomers", getContactCustomers);
  router.post("/markMessagesAsRead", markMessagesAsRead);
  router.post("/createSubUser", createSubUser);
  router.post("/sendFlowTemplates", sendFlowTemplates);
  router.post("/createGupshupApp", createGupshupApp);
  router.post("/send-template", sendtesttemplate);
  router.post("/createMediaTemplate", createMediaTemplate);
  router.post("/uploadMedia", upload.single("file"), uploadMedia);
  router.post("/sendMedia", upload.single("file"), sendMedia);
  router.post("/blockUsers/:customer_id", blockUsers);
  router.post("/unblockUsers/:customer_id", unblockUsers);
  router.post("/:customer_id/update-daily-billing", updateAppDailyUsageBilling);
  router.post("/sendWhatsappMessage", sendWhatsappMessage);
  router.post("/addFlow", addFlow);
  router.post("/drip/add", addDrip);

  router.post("/logout", logoutUser);

  router.put("/edit", authenticateToken, updateTemplate);
  router.put("/updatecontact", authenticateToken, updateContact);
  router.put("/updatesubuser", updateSubUser);
  router.put("/updateGroup", upload.single("file"), authenticateToken, updateGroup);
  router.put("/:customer_id/details", updateProfileDetails); // JSON body
  router.put("/:customer_id/about", updateProfileAbout); // JSON body
  router.put(
    "/:customer_id/photo",
    upload.single("image"),
    updateProfilePicture
  ); // multipart/form-data
  router.put("/updateFlow/:flow_id", updateFlow);


  router.delete("/deletetemplate", authenticateToken, deleteTemplate);
  router.delete("/deletecontact", authenticateToken, deleteContact);
  router.delete("/deleteconversations", authenticateToken, deleteConversations);
  router.delete("/deletesubuser", authenticateToken, deleteSubUser);
  router.delete("/deleteGroup", authenticateToken, deleteGroup);
  router.delete("/deleteFlow/:flow_id", deleteFlow);


  router.get("/me", authenticateToken, getMe);
  router.get("/gettemplates", authenticateToken, getTemplate);
  router.get("/contacts", authenticateToken, returnContacts);
  router.get("/templates", authenticateToken, returnTemplates);
  router.get("/conversations", authenticateToken, returnConversations);
  router.get("/messages", authenticateToken, returnMessages);
  router.get("/returnGroups", authenticateToken, returnGroups);
  router.get("/getBroadcasts", authenticateToken, getBroadcasts);
  router.get("/getTemplateAnalytics", authenticateToken, getTemplateAnalytics);
  router.get("/creditUsage", authenticateToken, returnCustomerCreditUsage);
  router.get("/getsubusers", authenticateToken, getSubUser);
  router.get("/getWabaInfo/:customer_id", authenticateToken, getWabaInfo);
  router.get(
    "/updateBlockedUsers/:customer_id",
    authenticateToken,
    updateBlockedUsers
  );
  router.get("/:customer_id/details", authenticateToken, getProfileDetails);
  router.get("/:customer_id/about", authenticateToken, getProfileAbout);
  router.get("/:customer_id/photo", authenticateToken, getProfilePicture);
  router.get("/:customer_id/waba-info/sync", authenticateToken, syncWabaInfo);
  router.get("/sync-contacts", authenticateToken, syncContacts);

  router.get("/returnAllMessage", returnAllMessage);
  router.get("/returnAllCustomer", returnAllCustomer);
  router.get("/returnFlow", returnFlow);


  return router;
}
 