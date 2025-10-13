import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import { pool } from "../../config/db.js";

/** Helper: fetch Gupshup credentials */
async function getGupshupCredentials(customer_id) {
  const [rows] = await pool.query(
    "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
    [customer_id]
  );
  if (!rows || rows.length === 0) throw new Error("Gupshup configuration not found");
  return rows[0];
}

/** Helper: Upsert wabainfo row (preserve existing fields if not provided) */
async function upsertWabaInfo(customer_id, fields) {
  // fields: { address, profileEmail, desc, vertical, website1, website2, about, profile }
  const [existingRows] = await pool.query("SELECT * FROM wabainfo WHERE customer_id = ? LIMIT 1", [customer_id]);

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const updated = {
      address: fields.address ?? existing.address,
      profileEmail: fields.profileEmail ?? existing.profileEmail,
      desc: fields.desc ?? existing.desc,
      vertical: fields.vertical ?? existing.vertical,
      website1: fields.website1 ?? existing.website1,
      website2: fields.website2 ?? existing.website2,
      about: fields.about ?? existing.about,
      profile: fields.profile ?? existing.profile,
    };

    await pool.query(
      `UPDATE wabainfo
       SET address = ?, profileEmail = ?, \`desc\` = ?, vertical = ?, website1 = ?, website2 = ?, about = ?, profile = ?, updated_at = NOW()
       WHERE customer_id = ?`,
      [
        updated.address,
        updated.profileEmail,
        updated.desc,
        updated.vertical,
        updated.website1,
        updated.website2,
        updated.about,
        updated.profile,
        customer_id,
      ]
    );
    return updated;
  } else {
    // Insert new
    await pool.query(
      `INSERT INTO wabainfo (customer_id, address, profileEmail, \`desc\`, vertical, website1, website2, about, profile)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id,
        fields.address ?? null,
        fields.profileEmail ?? null,
        fields.desc ?? null,
        fields.vertical ?? null,
        fields.website1 ?? null,
        fields.website2 ?? null,
        fields.about ?? null,
        fields.profile ?? null,
      ]
    );
    return fields;
  }
}

/** -------------------------
 *  GET helpers & sync (existing)
 *  ------------------------*/
export const getProfileDetails = async (req, res) => {
  const { customer_id } = req.params;
  try {
    const { gupshup_id, token } = await getGupshupCredentials(customer_id);
    const response = await fetch(`https://partner.gupshup.io/partner/app/${gupshup_id}/business/profile/`, {
      method: "GET",
      headers: { Authorization: token },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("getProfileDetails error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProfileAbout = async (req, res) => {
  const { customer_id } = req.params;
  try {
    const { gupshup_id, token } = await getGupshupCredentials(customer_id);
    const response = await fetch(`https://partner.gupshup.io/partner/app/${gupshup_id}/business/profile/about`, {
      method: "GET",
      headers: { Authorization: token },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("getProfileAbout error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProfilePicture = async (req, res) => {
  const { customer_id } = req.params;
  try {
    const { gupshup_id, token } = await getGupshupCredentials(customer_id);
    const response = await fetch(`https://partner.gupshup.io/partner/app/${gupshup_id}/business/profile/photo`, {
      method: "GET",
      headers: { Authorization: token },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("getProfilePicture error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Sync GET -> store in wabainfo (same as earlier) */
export const syncWabaInfo = async (req, res) => {
  const { customer_id } = req.params;
  try {
    const { gupshup_id, token } = await getGupshupCredentials(customer_id);
    const headers = { Authorization: token };
    const baseUrl = `https://partner.gupshup.io/partner/app/${gupshup_id}/business/profile`;

    const [profileRes, aboutRes, photoRes] = await Promise.all([
      fetch(`${baseUrl}/`, { method: "GET", headers }),
      fetch(`${baseUrl}/about`, { method: "GET", headers }),
      fetch(`${baseUrl}/photo`, { method: "GET", headers }),
    ]);

    const [profileData, aboutData, photoData] = await Promise.all([
      profileRes.json(),
      aboutRes.json(),
      photoRes.json(),
    ]);

    if (profileData.status !== "success" || aboutData.status !== "success" || photoData.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch all business profile data",
        details: { profileData, aboutData, photoData },
      });
    }

    const profile = profileData.profile || {};
    const about = aboutData.about?.message ?? null;
    const profilePhoto = photoData.message ?? null;

    const address = profile.address ?? null;
    const profileEmail = profile.profileEmail ?? null;
    const desc = profile.desc ?? null;
    const vertical = profile.vertical ?? null;
    const website1 = profile.website1 ?? null;
    const website2 = profile.website2 ?? null;

    await upsertWabaInfo(customer_id, {
      address,
      profileEmail,
      desc,
      vertical,
      website1,
      website2,
      about,
      profile: profilePhoto,
    });

    res.json({
      success: true,
      message: "WABA info synced successfully",
      data: { address, profileEmail, desc, vertical, website1, website2, about, profile: profilePhoto },
    });
  } catch (error) {
    console.error("Error syncing WABA info:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/** -------------------------
 *  PUT methods: update Gupshup then update DB
 *  ------------------------*/

/** Update Profile Details (PUT) */
export const updateProfileDetails = async (req, res) => {
  const { customer_id } = req.params;
  // expect fields in body: addLine1, addLine2, city, state, pinCode, country, vertical, website1, website2, desc, profileEmail
  const {
    addLine1,
    addLine2,
    city,
    state,
    pinCode,
    country,
    vertical,
    website1,
    website2,
    desc,
    profileEmail,
  } = req.body;

  try {
    const { gupshup_id, token } = await getGupshupCredentials(customer_id);
    const form = new URLSearchParams();

    // only append if provided (so we don't pass undefined)
    if (addLine1 !== undefined) form.append("addLine1", addLine1);
    if (addLine2 !== undefined) form.append("addLine2", addLine2);
    if (city !== undefined) form.append("city", city);
    if (state !== undefined) form.append("state", state);
    if (pinCode !== undefined) form.append("pinCode", pinCode);
    if (country !== undefined) form.append("country", country);
    if (vertical !== undefined) form.append("vertical", vertical);
    if (website1 !== undefined) form.append("website1", website1);
    if (website2 !== undefined) form.append("website2", website2);
    if (desc !== undefined) form.append("desc", desc);
    if (profileEmail !== undefined) form.append("profileEmail", profileEmail);

    const response = await fetch(`https://partner.gupshup.io/partner/app/${gupshup_id}/business/profile`, {
      method: "PUT",
      headers: { Authorization: token, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = await response.json();

    if (data.status !== "success") {
      console.error("Gupshup update profile details error:", data);
      return res.status(400).json({ success: false, message: "Failed to update profile details", details: data });
    }

    // Determine composed address string if lines/city/state provided
    const addressParts = [];
    if (addLine1) addressParts.push(addLine1);
    if (addLine2) addressParts.push(addLine2);
    if (city) addressParts.push(city);
    if (state) addressParts.push(state);
    if (pinCode) addressParts.push(pinCode);
    if (country) addressParts.push(country);
    const address = addressParts.length ? addressParts.join(", ") : undefined;

    // Upsert into wabainfo using returned profile if present, otherwise use provided fields
    const newProfile = data.profile ?? {};
    await upsertWabaInfo(customer_id, {
      address: newProfile.address ?? address,
      profileEmail: newProfile.profileEmail ?? profileEmail,
      desc: newProfile.desc ?? desc,
      vertical: newProfile.vertical ?? vertical,
      website1: newProfile.website1 ?? website1,
      website2: newProfile.website2 ?? website2,
      // about and profile unchanged here
    });

    res.json({ success: true, message: "Profile details updated and saved to DB", data });
  } catch (err) {
    console.error("updateProfileDetails error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Update Profile About (PUT) */
export const updateProfileAbout = async (req, res) => {
  const { customer_id } = req.params;
  const { about } = req.body; // string

  if (about === undefined) {
    return res.status(400).json({ success: false, message: "about is required in body" });
  }

  try {
    const { gupshup_id, token } = await getGupshupCredentials(customer_id);
    const form = new URLSearchParams({ about });

    const response = await fetch(`https://partner.gupshup.io/partner/app/${gupshup_id}/business/profile/about`, {
      method: "PUT",
      headers: { Authorization: token, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = await response.json();
    if (data.status !== "success") {
      console.error("Gupshup update about error:", data);
      return res.status(400).json({ success: false, message: "Failed to update about", details: data });
    }

    // Update wabainfo.about
    await upsertWabaInfo(customer_id, { about: data.about?.message ?? about });

    res.json({ success: true, message: "About updated and saved to DB", data });
  } catch (err) {
    console.error("updateProfileAbout error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Update Profile Picture (PUT)
 *  Accepts:
 *   - file upload via multer: req.file (field name 'image')
 *   - OR image_path in body (server file path)
 */
export const updateProfilePicture = async (req, res) => {
  const { customer_id } = req.params;
  const image_path = req.body?.image_path; // optional fallback if file not uploaded

  try {
    const { gupshup_id, token } = await getGupshupCredentials(customer_id);

    const form = new FormData();

    if (req.file && req.file.buffer) {
      // multer memoryStorage -> use buffer
      form.append("image", req.file.buffer, {
        filename: req.file.originalname || "upload.jpg",
        contentType: req.file.mimetype || "image/jpeg",
      });
    } else if (image_path) {
      if (!fs.existsSync(image_path)) {
        return res.status(400).json({ success: false, message: "image_path not found on server" });
      }
      form.append("image", fs.createReadStream(image_path));
    } else {
      return res.status(400).json({ success: false, message: "No image provided. Use multipart form file 'image' or image_path in body" });
    }

    const response = await fetch(`https://partner.gupshup.io/partner/app/${gupshup_id}/business/profile/photo`, {
      method: "PUT",
      headers: { Authorization: token, ...form.getHeaders() },
      body: form,
    });

    const data = await response.json();
    if (data.status !== "success") {
      console.error("Gupshup update profile photo error:", data);
      return res.status(400).json({ success: false, message: "Failed to update profile photo", details: data });
    }

    // Gupshup's PUT photo response may not return the link. Fetch the photo link via GET endpoint to obtain URL.
    const photoGet = await fetch(`https://partner.gupshup.io/partner/app/${gupshup_id}/business/profile/photo`, {
      method: "GET",
      headers: { Authorization: token },
    });
    const photoData = await photoGet.json();
    const profileLink = photoData.message ?? null;

    // Update DB
    await upsertWabaInfo(customer_id, { profile: profileLink });

    res.json({ success: true, message: "Profile picture updated and saved to DB", data: { putResponse: data, profileLink } });
  } catch (err) {
    console.error("updateProfilePicture error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
