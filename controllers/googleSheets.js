const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const SHEET_ID = "13WezerzzuaGoWN3mDEpnmZmgj4I0aS9h3i91X7Msw0g"; // Your actual Sheet ID

// ✅ Safely formats authors array or fallback to raw string
function formatOtherAuthors(rawAuthors) {
  try {
    const parsed = typeof rawAuthors === "string" ? JSON.parse(rawAuthors) : rawAuthors;
    if (!Array.isArray(parsed)) return rawAuthors || "N/A";
    return parsed.map(a => `${a.name} (${a.affiliation})`).join("; ");
  } catch (err) {
    console.warn("⚠️ Could not parse otherAuthors:", rawAuthors);
    return rawAuthors || "N/A";
  }
}

async function appendPaymentToSheet(payment) {
  try {
    console.log("📤 Sending payment to Google Sheets for:", payment.email);

    const auth = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    await doc.loadInfo();

    const paymentsSheet = doc.sheetsByTitle["Payments"];

    if (!paymentsSheet) {
      console.error("❌ 'Payments' sheet not found in Google Sheet. Please create one.");
      return;
    }

    const timestamp = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });

    await paymentsSheet.addRow({
      Timestamp: timestamp,
      Name: payment.name || "N/A",
      Email: payment.email || "N/A",
      Phone: payment.phone || "N/A",
      Category: payment.category || "N/A",
      Currency: payment.currency || "N/A",
      Amount: payment.amount || 0,
      Payment_ID: payment.paymentId || "N/A",
      Order_ID: payment.orderId || "N/A",
      Status: payment.status || "paid",
    });

    console.log("✅ Payment row added to Google Sheets for:", payment.email);

  } catch (error) {
    console.error("❌ Google Sheets Payment export error:", error.message);
  }
}


async function updateGoogleSheet(user, abstract = null) {
  try {
    console.log("🟢 Google Sheets update triggered for:", user.email);

    const auth = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    await doc.loadInfo();

    const registrationSheet = doc.sheetsByTitle["Registration Details"];
    const abstractSheet = doc.sheetsByTitle["Abstract Submissions"];

    const timestamp = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });

    if (!registrationSheet || !abstractSheet) {
      console.error("❌ One or both sheets are missing. Check sheet titles.");
      return;
    }

    // ✅ Abstract Submission Update
    if (abstract && abstract.abstractCode) {
      const abstractRows = await abstractSheet.getRows();

      const existingRow = abstractRows.find(row =>
        row.Abstract_Code?.trim() === abstract.abstractCode
      );

      const formattedAuthors = formatOtherAuthors(abstract.otherAuthors);

      console.log("📊 Sheet payload preview:", {
        abstractCode: abstract.abstractCode,
        title: abstract.title,
        scope: abstract.scope,
        presentingType: abstract.presentingType,
        abstractFile: abstract.abstractFile,
        mainBody: abstract.mainBody,
        authors: formattedAuthors
      });

      if (existingRow) {
        console.log("🔄 Updating abstract:", abstract.abstractCode);
        existingRow.Full_Name = user.fullName;
        existingRow.Email = user.email;
        existingRow.Abstract_Title = abstract.title || "N/A";
        existingRow.Abstract = abstract.mainBody || "N/A";
        existingRow.Abstract_Scope = abstract.scope || "N/A";
        existingRow.Abstract_PresentingType = abstract.presentingType || "N/A";
        existingRow.Abstract_File = abstract.abstractFile || "N/A";
        existingRow.Abstract_Authors = formattedAuthors;
        existingRow.Timestamp = timestamp;
        await existingRow.save();
        console.log("✅ Updated Google Sheet for abstract:", abstract.abstractCode);
      } else {
        console.log("➕ Adding new abstract row:", abstract.abstractCode);
        await abstractSheet.addRow({
          Abstract_Code: abstract.abstractCode,
          Full_Name: user.fullName,
          Email: user.email,
          Abstract_Title: abstract.title || "N/A",
          Abstract: abstract.mainBody || "N/A",
          Abstract_Scope: abstract.scope || "N/A",
          Abstract_PresentingType: abstract.presentingType || "N/A",
          Abstract_File: abstract.abstractFile || "N/A",
          Abstract_Authors: formattedAuthors,
          Timestamp: timestamp,
        });
        console.log("✅ New abstract added:", abstract.abstractCode);
      }
    }

    // ✅ Registration Sheet Update (only once on user registration)
    else if (!abstract) {
      console.log("📌 Adding new user to Registration Details sheet...");
      await registrationSheet.addRow({
        Email: user.email,
        Phone: user.phone,
        Given_Name: user.givenName,
        Family_Name: user.familyName || "N/A",
        Full_Name: user.fullName,
        Country: user.country,
        Affiliation: user.affiliation,
        Registered_At: timestamp,
      });
      console.log("✅ Registration added for:", user.email);
    }

  } catch (error) {
    console.error("❌ Google Sheets update error:", error.message);
  }
}

module.exports = { updateGoogleSheet, appendPaymentToSheet };
