require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const cors = require("cors");

// Initialize app FIRST
const app = express();
app.options("*", cors());
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://stisv.vercel.app",
    "https://stisv.onrender.com",
    "https://materials.iisc.ac.in",
     "https://materials.iisc.ac.in/stis2025",
    "https://stisv-1.onrender.com"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
 
app.post("/razorpay-webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  try {
    const expectedSignature = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    if (signature !== expectedSignature) {
      return res.status(400).json({ status: "unauthorized" });
    }

    const parsedBody = JSON.parse(req.body);
    const payment = parsedBody.payload.payment?.entity;
    if (!payment || !payment.notes?.email || !payment.notes?.categoriesSelected) {
      return res.status(400).json({ status: "invalid payload" });
    }

    const { id: paymentId, order_id: orderId, currency, amount, status, notes } = payment;
    const { email, categoriesSelected: catString } = notes;

    const categoriesSelected = JSON.parse(catString);
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ status: "user not found" });

    const alreadyExists = user.payments.some(p => p.paymentId === paymentId);
    if (alreadyExists) return res.status(200).json({ status: "already recorded" });

    const today = new Date();
    let period = "late";
    if (today <= new Date("2025-07-15")) period = "early";
    else if (today <= new Date("2025-11-20")) period = "regular";
const nationalFees = {
  "Speaker / Participant": { early: { base: 13000, gst: 2340, platform: 360 }, regular: { base: 16000, gst: 2880, platform: 420 }, late: { base: 19000, gst: 3420, platform: 500 } },
  "Accompanying Person": { early: { base: 7000, gst: 1260, platform: 200 }, regular: { base: 9000, gst: 1620, platform: 300 }, late: { base: 9000, gst: 1620, platform: 300 } },
  "Student / Speaker": { early: { base: 1000, gst: 180, platform: 30 }, regular: { base: 1000, gst: 180, platform: 30 }, late: { base: 1000, gst: 180, platform: 30 } },
  "Student / Participant": { early: { base: 4000, gst: 720, platform: 120 }, regular: { base: 4000, gst: 720, platform: 120 }, late: { base: 4000, gst: 720, platform: 120 } },
};

const internationalFees = {
  "Speaker / Participant": { early: { base: 350, platform: 13 }, regular: { base: 400, platform: 14 }, late: { base: 500, platform: 18 } },
  "Accompanying Person": { early: { base: 200, platform: 7 }, regular: { base: 250, platform: 9 }, late: { base: 250, platform: 9 } },
  "Student / Speaker": { early: { base: 100, platform: 4 }, regular: { base: 100, platform: 4 }, late: { base: 100, platform: 4 } },
  "Student / Participant": { early: { base: 150, platform: 5 }, regular: { base: 150, platform: 5 }, late: { base: 150, platform: 5 } },
};

    const feeDetails = categoriesSelected.map(item => {
      const { key, currency: cur } = item;
      let base = 0, gst = 0, platform = 0;
      if (cur === "INR" && nationalFees[key]) {
        const fee = nationalFees[key][period];
        base = fee.base;
        gst = fee.gst;
        platform = fee.platform;
      } else if (cur === "USD" && internationalFees[key]) {
        const fee = internationalFees[key][period];
        base = fee.base;
        gst = 0;
        platform = fee.platform;
      }
      return {
        category: key,
        currency: cur,
        baseFee: base,
        gst,
        platform,
        totalAmount: base + gst + platform
      };
    });

    await User.findOneAndUpdate(
      { email },
      {
        $push: {
          payments: {
            paymentId,
            orderId,
            signature,
            category: "Multi",
            currency,
            amount: amount / 100,
            status,
            timestamp: new Date(),
          }
        },
        $set: {
          selectedCategory: "Multi",
          selectedCategoryDetails: { categories: feeDetails }
        }
      },
      { new: true }
    );

    process.nextTick(async () => {
      try {
        await appendPaymentToSheet({
          name: user.fullName,
          email,
          phone: user.phone,
          category: "Multi",
          currency,
          amount: amount / 100,
          paymentId,
          orderId,
          status,
        });

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "STIS-V 2025 – Payment Confirmation",
          text: `Dear ${user.fullName},

We have received your payment for STIS-V 2025.

Payment ID: ${paymentId}
Amount: ${currency === "INR" ? "₹" : "$"}${amount / 100}

Selected Categories:
${feeDetails.map(f => `- ${f.category} (${currency === "INR" ? "₹" : "$"}${f.totalAmount})`).join('\n')}

Warm regards,  
STIS-V 2025 Organizing Team`,
        });
      } catch (e) {
        console.error("❌ Webhook post-tasks failed:", e.message);
      }
    });

    res.status(200).json({ status: "payment saved" });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(200).json({ status: "error handled" });
  }
});







const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const Razorpay = require("razorpay");


const { updateGoogleSheet, appendPaymentToSheet } = require("./controllers/googleSheets");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const transporter = nodemailer.createTransport({
  service: "Outlook365",
  host: "smtp.office365.com",
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});



const PORT = process.env.PORT || 5000;

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.memoryStorage();
const uploads = multer({ storage: storage });
// File filter function
const fileFilter = (req, file, cb) => {
  // Accept only PDF and Word documents
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware
app.use(express.json());


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

const verifyAdminToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Not an Admin" });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  givenName: { type: String, required: true },
  familyName: { type: String },
  fullName: { type: String, required: true },
  country: { type: String, required: true },
  affiliation: { type: String, required: true },

  // 🆕 Additional fields for Registration
  title: { type: String, default: "" },
  address: { type: String, default: "" },
  zipcode: { type: String, default: "" },
  dietaryPreferenceAuthor: { type: String, default: "" },
  accompanyingPersons: [{
    name: String,
    relation: String,
    dietaryPreference: String,
  }],
  selectedCategory: { type: String, default: "" },
 selectedCategoryDetails: {
  baseFee: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  categories: [{
    category: String,
    currency: String,
    baseFee: Number,
    gst: Number,
    platform: Number,
    totalAmount: Number,
  }]
},

  abstractSubmissions: [{
    title: String,
    scope: String,
    abstractCode: String,
    presentingType: String,
    firstAuthorName: String,
    firstAuthorAffiliation: String,
    secondAuthorName: String,
    secondAuthorAffiliation: String,
    otherAuthors: String,
    presentingAuthorName: String,
    presentingAuthorAffiliation: String,
    abstractFile: String,
    mainBody: String,
    status: { type: String, default: "Pending" },
    isFinalized: { type: Boolean, default: false },
    remarks: String,
    timestamp: String,
  }],

  payments: [{
    paymentId: String,
    orderId: String,
    signature: String,
    category: String,
    currency: String,
    amount: Number,
    status: { type: String, default: "paid" },
    timestamp: { type: Date, default: Date.now }
  }]
});

const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true },
  receiptUrl: { type: String, required: true }, // ✅ Add this
  submittedAt: { type: Date, default: Date.now },
});

const Transaction = mongoose.model("Transaction", TransactionSchema);

// API Route to Save Transaction ID
app.post("/save-transaction-id", async (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: "Transaction ID is required" });
  }

  try {
    const newTransaction = new Transaction({ transactionId });
    await newTransaction.save();

    res.status(200).json({ message: "Transaction ID saved successfully" });
  } catch (err) {
    console.error("Error saving transaction:", err);
    res.status(500).json({ error: "Server error, please try again later." });
  }
});

const User = mongoose.model("User", userSchema);
app.post("/register", async (req, res) => {
  try {
    const { email, password, phone, givenName, familyName, fullName, country, affiliation } = req.body;

    if (!email || !password || !phone || !givenName || !fullName || !country || !affiliation) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      uid: uuidv4(),
      email,
      password: hashedPassword,
      phone,
      givenName,
      familyName,
      fullName,
      country,
      affiliation,
    });

    await newUser.save(); // ✅ Save user first

    // ✅ Send response before long operations like Google Sheets update
    res.status(201).json({ message: "User registered successfully" });

    // ✅ Call `updateGoogleSheet()` only once (after response is sent)
    console.log("🔄 Attempting to update Google Sheets...");
    await updateGoogleSheet(newUser);
    console.log("✅ Google Sheets update was successful!");

    // ✅ Send emails after response is sent
    sendRegistrationEmails(email, givenName, fullName, familyName, phone, country, affiliation);

  } catch (error) {
    console.error("❌ Error registering user:", error);

    if (!res.headersSent) { // ✅ Prevent multiple responses
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
});

// ✅ Function to send emails asynchronously (prevents API slowdowns)
async function sendRegistrationEmails(email, givenName, fullName, familyName, phone, country, affiliation) {
  try {
    // ✅ Send email to user
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to STIS-V 2025 Conference!",
      text: `Dear ${givenName},\n\nThank you for registering for STIS-V 2025.\nYour account has been successfully created.\nWe look forward to your participation.\n\nBest regards,\nSTIS-V 2025 Organizing Team`,
    };
    await transporter.sendMail(mailOptions);
    console.log("✅ Acknowledgement email sent to user:", email);

    // ✅ Send registration details to admin
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: "stis.mte@iisc.ac.in",
      subject: "New User Registration - STIS-V 2025",
      text: `A new user has registered:\n\nFull Name: ${fullName}\nGiven Name: ${givenName}\nFamily Name: ${familyName || "N/A"}\nEmail: ${email}\nPhone: ${phone}\nCountry: ${country}\nAffiliation: ${affiliation}\n\nRegards,\nSTIS-V Registration System`,
    };
    await transporter.sendMail(adminMailOptions);
    console.log("✅ Registration details sent to admin");

  } catch (error) {
    console.error("❌ Error sending emails:", error);
  }
}

// ✅ Clean user info fetch (GET)
app.get("/user-info/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user); // Send the full user object (frontend can pick needed fields)
  } catch (error) {
    console.error("❌ Error fetching user info:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// ✅ Clean user update (PUT)
app.put("/user-info/update/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const updateData = req.body; // whatever fields frontend sends
    if (updateData.dietaryPreferenceAuthor === "Other" && updateData.otherDietaryPreference) {
      updateData.dietaryPreferenceAuthor = updateData.otherDietaryPreference;
      delete updateData.otherDietaryPreference;
    }
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Smart update: merge only provided fields
    for (let key in updateData) {
      if (typeof updateData[key] === 'object' && updateData[key] !== null && !Array.isArray(updateData[key])) {
        user[key] = {
          ...user[key],
          ...updateData[key]
        };
      } else {
        user[key] = updateData[key];
      }
    }

    await user.save();
    console.log(`✅ User updated successfully: ${uid}`);

    res.status(200).json({ message: "User info updated successfully", user });

  } catch (error) {
    console.error("❌ Error updating user info:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

const studentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const cloudinaryStudent = require("cloudinary").v2;
// and you’ve done:
cloudinaryStudent.config({
  cloud_name: process.env.CLOUDINARY_RECEIPT_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_RECEIPT_API_KEY,
  api_secret: process.env.CLOUDINARY_RECEIPT_API_SECRET,
});

// POST /api/upload-student-docs
// POST /api/upload-student-docs
app.post(
  "/api/upload-student-docs",
  studentUpload.array("docs"),
  async (req, res) => {
    try {
      const categories = JSON.parse(req.body.categories || "[]");
      if (categories.length !== req.files.length) {
        return res.status(400).json({ message: "Must send one category per file." });
      }

      const uploads = await Promise.all(
        req.files.map((file, idx) => {
          // Keep the full original filename (with extension)
          const originalName = file.originalname; // e.g. "myID.pdf"
          // Build a safe folder name per category
          const folder = `student_docs/${
            categories[idx]
              .replace(/\s+/g, "_")
              .replace(/\//g, "_")
          }`; // e.g. "student_docs/Student_Speaker"

          // Wrap Cloudinary upload in a Promise
          return new Promise((resolve, reject) => {
            const stream = cloudinaryStudent.uploader.upload_stream(
              {
                resource_type: "raw",      // handle PDFs, DOCXs, JPGs, PNGs, etc.
                folder,                    // dynamic folder per category
                use_filename: true,        // keep the file name
                unique_filename: false,    // no random suffix
                public_id: originalName,   // full originalName including extension
                overwrite: true            // allow re‐upload under same public_id
              },
              (err, result) => {
                if (err) return reject(err);
                // attach a download_url for forced‐download or preview
                result.download_url = result.secure_url;
                resolve({
                  category: categories[idx],
                  url:      result.download_url,
                  publicId: result.public_id
                });
              }
            );
            // Kick off the upload
            stream.end(file.buffer);
          });
        })
      );

      return res.json({ uploaded: uploads });
    } catch (err) {
      console.error("❌ /api/upload-student-docs error:", err);
      return res.status(500).json({ message: "Upload failed" });
    }
  }
);



// Login User
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, uid: user.uid }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ 
      message: "Login successful", 
      token, 
      uid: user.uid, 
      givenName: user.givenName, // Include first name
      fullName: user.fullName ,
      email: user.email,        // ✅ Add this
      country: user.country,    // ✅ Add this
      phone: user.phone         // Include full name if needed
    });

  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const options = {
      amount: amount * 100,
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (err) {
    console.error("❌ Order creation failed:", err);
    res.status(500).json({ message: "Order creation failed" });
  }
});

app.post("/save-payment", async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      email,
      name,
      phone,
      categoriesSelected,
      currency,
      amount,
      paymentMode,
    } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !email || !amount || !categoriesSelected) {
      return res.status(400).json({ message: "Missing required payment fields." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const alreadyExists = user.payments.find(p => p.paymentId === razorpay_payment_id);
    if (alreadyExists) return res.status(409).json({ message: "Payment already recorded." });

    // Fee Period
    const today = new Date();
    let period = "late";
    if (today <= new Date("2025-07-15")) period = "early";
    else if (today <= new Date("2025-11-20")) period = "regular";

    // Fee Structures
    const nationalFees = {
      "Speaker / Participant": { early: { base: 13000, gst: 2340, platform: 360 }, regular: { base: 16000, gst: 2880, platform: 420 }, late: { base: 19000, gst: 3420, platform: 500 } },
      "Accompanying Person": { early: { base: 7000, gst: 1260, platform: 200 }, regular: { base: 9000, gst: 1620, platform: 300 }, late: { base: 9000, gst: 1620, platform: 300 } },
      "Student / Speaker": { early: { base: 1000, gst: 180, platform: 30 }, regular: { base: 1000, gst: 180, platform: 30 }, late: { base: 1000, gst: 180, platform: 30 } },
      "Student / Participant": { early: { base: 4000, gst: 720, platform: 120 }, regular: { base: 4000, gst: 720, platform: 120 }, late: { base: 4000, gst: 720, platform: 120 } },
    };

    const internationalFees = {
      "Speaker / Participant": { early: { base: 350, platform: 13 }, regular: { base: 400, platform: 14 }, late: { base: 500, platform: 18 } },
      "Accompanying Person": { early: { base: 200, platform: 7 }, regular: { base: 250, platform: 9 }, late: { base: 250, platform: 9 } },
      "Student / Speaker": { early: { base: 100, platform: 4 }, regular: { base: 100, platform: 4 }, late: { base: 100, platform: 4 } },
      "Student / Participant": { early: { base: 150, platform: 5 }, regular: { base: 150, platform: 5 }, late: { base: 150, platform: 5 } },
    };

    // Recompute fee details backend-side (ignore frontend values)
    const feeDetails = categoriesSelected.map(item => {
      const key = item.category || item.key;
      const cur = item.currency;
      let base = 0, gst = 0, platform = 0;

      if (cur === "INR" && nationalFees[key]) {
        const fee = nationalFees[key][period];
        base = fee.base;
        gst = fee.gst;
        platform = paymentMode === "online" ? fee.platform : 0;
      } else if (cur === "USD" && internationalFees[key]) {
        const fee = internationalFees[key][period];
        base = fee.base;
        gst = 0;
        platform = paymentMode === "online" ? fee.platform : 0;
      }

      return {
        category: key,
        currency: cur,
        baseFee: base,
        gst,
        platform,
        totalAmount: base + gst + platform
      };
    });

    // Push to user.payments
    user.payments.push({
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      signature: razorpay_signature,
      category: "Multi",
      currency,
      amount,
      status: "paid",
      timestamp: new Date(),
    });

    user.selectedCategory = "Multi";
    user.selectedCategoryDetails = { categories: feeDetails };

    await user.save();

    await appendPaymentToSheet({
      name,
      email,
      phone,
      category: "Multi",
      currency,
      amount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      status: "paid",
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "STIS-V 2025 – Payment Confirmation",
      text: `Dear ${name},

We have received your payment successfully for STIS-V 2025.

Payment ID: ${razorpay_payment_id}
Amount: ${currency === "INR" ? "₹" : "$"}${amount}

Selected Categories:
${feeDetails.map(f => `- ${f.category} (${f.currency === "INR" ? "₹" : "$"}${f.totalAmount})`).join('\n')}

Thank you for registering and supporting the event.

Warm regards,  
STIS-V 2025 Organizing Team`,
    });

    res.status(200).json({ message: "Payment recorded and confirmation email sent." });

  } catch (err) {
    console.error("❌ Error in /save-payment:", err);
    res.status(500).json({ message: "Saving payment failed", error: err.message });
  }
});



app.get("/get-payments/:uid", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ payments: user.payments || [] });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ message: "Server error" });
  }
});






app.post("/payment-failed", async (req, res) => {
  const { email, orderId, reason } = req.body;
  if (!email || !orderId) {
    return res.status(400).json({ message: "Missing details" });
  }

  console.warn(`⚠️ Payment failed for ${email}. OrderID: ${orderId}. Reason: ${reason}`);

  // Optional: send email
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "STIS-V 2025 – Payment Failure Notice",
    text: `Dear user,

Your payment with Order ID: ${orderId} failed due to the following reason:
${reason || "Unknown"}.

If any amount was deducted, it will be refunded by Razorpay within 5–7 working days.

You can try the payment again from the portal.

Warm regards,  
STIS-V 2025 Team`
  });

  return res.status(200).json({ message: "Failure noted" });
});



// Reset Password Route
app.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }

    // Check if the user exists in the database
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password reset successful. You can now log in with your new password." });

  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/submit-abstract", verifyToken, upload.single("abstractFile"), async (req, res) => {
  console.log("🔥 /submit-abstract endpoint hit");

  try {
    const {
      uid,
      title,
      theme,
      presentingType,
      firstAuthorName,
      firstAuthorAffiliation,
      otherAuthors,
      presentingAuthorName,
      presentingAuthorAffiliation,
      mainBody
    } = req.body;

    if (!uid) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Abstract file is required" });
    }

    console.log("🧾 Request Body:", req.body);
    console.log("📎 File received:", req.file.originalname);

    const generateAbstractCode = () => {
      return `STIS_${Math.floor(1000 + Math.random() * 9000)}`;
    };

    const abstractCode = generateAbstractCode();

   const uploadToCloudinary = () => {
    return new Promise((resolve, reject) => {
    const originalName = req.file.originalname; // e.g. MyAbstract.docx

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",              // ✅ Required for .docx, .pdf, etc.
        folder: "abstracts",               // ✅ Optional folder
        use_filename: true,                // ✅ Use original file name
        unique_filename: false,            // ✅ Prevent random string
        public_id: originalName,           // ✅ Keep full name including extension
        overwrite: true                    // ✅ Avoid conflict on same name
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          // ✅ Generate forced-download URL with correct file name
          

          result.download_url = result.secure_url;


          resolve(result);
        }
      }
    );

    stream.end(req.file.buffer);
  });
};


    const cloudinaryResult = await uploadToCloudinary();

    // Update user's abstractSubmission in DB
    const user = await User.findOne({ uid });

if (!user) {
  return res.status(404).json({ message: "User not found" });
}

// Create new abstract object
const newAbstract = {
  title,
  scope: theme,
  presentingType,
  firstAuthorName,
  firstAuthorAffiliation,
  otherAuthors,
  presentingAuthorName,
  presentingAuthorAffiliation,
  abstractFile: cloudinaryResult.download_url,
  mainBody,
  abstractCode,
  isFinalized: false,
  status: "Pending",
  timestamp: new Date().toLocaleString()
};

// Push into abstractSubmissions array
user.abstractSubmissions.push(newAbstract);
await user.save();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

     // ✅ Update Google Sheets with Abstract details
     console.log("🔄 Attempting to update Google Sheets for Abstract Submission...");
     const latestAbstract = user.abstractSubmissions[user.abstractSubmissions.length - 1];
     
// ✅ Add this log here:
console.log("🧾 Sending to Sheets:", latestAbstract);
await updateGoogleSheet(user, latestAbstract);
     console.log("✅ Google Sheets updated with Abstract details!");
 

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: ' Abstract Submission Received Confirmation - STIS-V 2025 Conference',
      text: `Dear ${user.givenName || user.fullName || "Author"},

We are pleased to confirm that we have received your submission successfully.This is the abstract code for your submission: **${abstractCode}**.
This code will be used for all future corresponence regarding your submission.Please note that all submissions will be carefully reviewed, 
and you can expect to hear from us by 31st May 2025.We truly appreciate your contribution and look forward to your active participation in 
the Conference.

Thanking you and with best regards,

STIS-V 2025 Organizing Team

`,
    };

    console.log("📨 Sending confirmation email to:", user.email);

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Abstract confirmation email sent:", info.response);

      // Send abstract details to admin
const adminAbstractMail = {
  from: process.env.EMAIL_USER,
  to: "stis.mte@iisc.ac.in",
  subject: `New Abstract Submission from ${user.fullName}`,
  text: `A new abstract has been submitted.
Abstract Code: ${abstractCode}
Full Name: ${user.fullName}
Email: ${user.email}
Phone: ${user.phone}
Affiliation: ${user.affiliation}
Title: ${title}
Scope/Theme: ${theme}
Presenting Type: ${presentingType}
First Author: ${firstAuthorName} (${firstAuthorAffiliation})
Other Authors: ${otherAuthors}
Presenting Author: ${presentingAuthorName} (${presentingAuthorAffiliation})
Abstract Link: ${cloudinaryResult.download_url}

Main Body:
${mainBody}

Regards,  
STIS-V 2025 Submission System`
};

try {
  await transporter.sendMail(adminAbstractMail);
  console.log("✅ Abstract details sent to stis.mte@iisc.ac.in");
} catch (error) {
  console.error("❌ Error sending abstract info to admin:", error);
}


    } catch (error) {
      console.error("❌ Error sending abstract confirmation email:", error);
    }

    res.status(200).json({
      message: "Abstract submitted successfully!",
      abstract: latestAbstract

    });

  } catch (error) {
    console.error("Error submitting abstract:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Image-specific file filter for receipt uploads (JPG/PNG only)
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image file type. Only JPG and PNG are allowed.'), false);
  }
};

// Separate multer instance for image receipts
const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});


const cloudinaryReceipts = require("cloudinary").v2;

cloudinaryReceipts.config({
  cloud_name: process.env.CLOUDINARY_RECEIPT_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_RECEIPT_API_KEY,
  api_secret: process.env.CLOUDINARY_RECEIPT_API_SECRET,
});
    
app.post("/upload-receipt", imageUpload.single("receiptFile"), async (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId || !req.file) {
    return res.status(400).json({ message: "Transaction ID and file are required." });
  }

  const uploadToCloudinary = () => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
    folder: "receipts",
    use_filename: true,
    unique_filename: false,
    public_id: req.file.originalname,
    overwrite: true
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });
  };

  try {
    const result = await uploadToCloudinary();

    const newTransaction = new Transaction({
      transactionId,
      receiptUrl: result.secure_url
    });

    await newTransaction.save();
    res.status(200).json({ message: "Receipt uploaded successfully", url: result.secure_url });
  } catch (error) {
    console.error("❌ Cloudinary upload failed:", error);
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

app.post("/submit-query", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    // ✅ Send email to Conference Secretariat
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: "stis.mte@iisc.ac.in", // Admin Email
      subject: `New Query from ${name}`,
      text: `A new query has been submitted:\n\nName: ${name}\nEmail: ${email}\nMessage: ${message}\n\nPlease respond to the user soon.`,
    };

    await transporter.sendMail(adminMailOptions);
    console.log("✅ Query email sent to admin");

    // ✅ Send confirmation email to user
    const userMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Query Received - STIS-V 2025",
      text: `Dear ${name},\n\nThank you for reaching out to us!\n\nWe have received your query and will get back to you shortly.\n\nBest regards,\nSTIS-V 2025 Team`,
    };

    await transporter.sendMail(userMailOptions);
    console.log("✅ Confirmation email sent to user:", email);

    res.status(200).json({ message: "Query submitted successfully!" });

  } catch (error) {
    console.error("❌ Error submitting query:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/get-all-abstracts", async (req, res) => {
  try {
    const abstracts = await User.find({}, "uid fullName email abstractSubmissions"); // ← FIXED HERE
    res.json({ abstracts });
  } catch (error) {
    console.error("Error fetching abstracts:", error);
    res.status(500).json({ message: "Server error" });
  }
});




app.put("/update-abstract", verifyToken, upload.single("abstractFile"), async (req, res) => {
  try {
    const { uid, abstractCode } = req.body;

    if (!uid) return res.status(400).json({ message: "User ID is required" });

    console.log(`🔹 Updating abstract for UID: ${uid}`);

    let updateData = {};
    let googleSheetUpdateRequired = false; // ✅ Prevent unnecessary Google Sheets updates

    // ✅ Update Only Provided Fields
    ["title", "scope", "presentingType", "firstAuthorName", "firstAuthorAffiliation",
     "otherAuthors", "presentingAuthorName", "presentingAuthorAffiliation", "mainBody"]
    .forEach(field => {
      if (req.body[field]) {
        updateData[`abstractSubmission.${field}`] = req.body[field];
        googleSheetUpdateRequired = true;
      }
    });

    // ✅ Handle File Upload
  if (req.file) {
  console.log("📎 Uploading new abstract file...");

  const uploadToCloudinary = () => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "abstracts",
          use_filename: true,
          unique_filename: false,
          public_id: req.file.originalname,
          overwrite: true
        },
        (error, result) => {
          if (error) return reject(error);

          // ✅ Set download_url from secure_url
          result.download_url = result.secure_url;
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });
  };

  const cloudinaryResult = await uploadToCloudinary();
  updateData["abstractSubmission.abstractFile"] = cloudinaryResult.download_url;
  console.log(`✅ New File Uploaded: ${cloudinaryResult.download_url}`);
  googleSheetUpdateRequired = true;
}


    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update." });
    }

    // ✅ Update MongoDB


if (!abstractCode) {
  return res.status(400).json({ message: "Abstract code is required for update." });
}

const user = await User.findOne({ uid });
if (!user) return res.status(404).json({ message: "User not found" });

const abstractIndex = user.abstractSubmissions.findIndex(abs => abs.abstractCode === abstractCode);
if (abstractIndex === -1) {
  return res.status(404).json({ message: "Abstract not found for given code." });
}

// Update fields
Object.entries(updateData).forEach(([key, value]) => {
  const field = key.replace("abstractSubmission.", "");
  user.abstractSubmissions[abstractIndex][field] = value;
});

// Save updated abstract
await user.save();

console.log("✅ Abstract updated successfully in MongoDB!");

// ✅ Update Google Sheets Only If Data Changed
if (googleSheetUpdateRequired) {
  console.log("🔄 Updating Google Sheets...");
  const updatedAbstract = user.abstractSubmissions[abstractIndex];
await updateGoogleSheet(user, updatedAbstract);
  console.log("✅ Google Sheets updated successfully!");
}

res.json({ message: "Abstract updated successfully", abstract: user.abstractSubmissions[abstractIndex] });

// ✅ Send update confirmation email to user
const updateMailOptions = {
  from: process.env.EMAIL_USER,
  to: user.email,
  subject: 'Abstract Update Confirmation - STIS-V 2025',
  text: `Dear ${user.givenName || user.fullName || "Participant"},

Your abstract has been successfully updated in the STIS-V 2025 system.

You can download your updated abstract from the following link:
${user.abstractSubmissions[abstractIndex].abstractFile}

If you did not request this update or have any concerns, please contact the organizing team at stis.mte@iisc.ac.in.

Best regards,  
STIS-V 2025 Organizing Committee`,
};


try {
  await transporter.sendMail(updateMailOptions);
  console.log("✅ Abstract update confirmation sent to user:", user.email);
} catch (emailErr) {
  console.error("❌ Failed to send user abstract update email:", emailErr.message);
}

// ✅ Also notify admin
const adminUpdateMail = {
  from: process.env.EMAIL_USER,
  to: "stis.mte@iisc.ac.in",
  subject: `Abstract Updated by ${user.fullName}`,
  text: `The following participant has updated their abstract:

Name: ${user.fullName}
Email: ${user.email}
Abstract Code: ${user.abstractSubmissions[abstractIndex].abstractCode}
Abstract Title: ${user.abstractSubmissions[abstractIndex].title}

Updated Abstract Link:
${user.abstractSubmissions[abstractIndex].abstractFile}



Please verify and review the submission in the admin panel.

Regards,  
STIS-V Submission System`,
};

try {
  await transporter.sendMail(adminUpdateMail);
  console.log("✅ Abstract update notification sent to admin.");
} catch (adminErr) {
  console.error("❌ Failed to send admin update email:", adminErr.message);
}


  } catch (error) {
    console.error("❌ Error updating abstract:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin Schema
const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const Admin = mongoose.model("Admin", adminSchema);

// Admin Login Endpoint
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "8h" });

    res.json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put("/admin/update-abstract-status", verifyAdminToken, async (req, res) => {
  try {
    const { uid, abstractCode, status, remarks } = req.body;

    if (!uid || !abstractCode || !status) {
      return res.status(400).json({ message: "UID, Abstract Code, and Status are required." });
    }

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const abstractIndex = user.abstractSubmissions.findIndex(abs => abs.abstractCode === abstractCode);
    if (abstractIndex === -1) {
      return res.status(404).json({ message: "Abstract not found for given code." });
    }

    user.abstractSubmissions[abstractIndex].status = status;
    user.abstractSubmissions[abstractIndex].remarks = remarks || "";
    await user.save();

    // ✅ Compose email message
    let emailText = `Dear ${user.fullName},\n\nYour abstract submission (${abstractCode}) has been **${status}**.\n`;

    if (status === "Rejected" && remarks) {
      emailText += `\nRemarks from reviewers:\n"${remarks}"\n`;
    }

    emailText += `\nThank you for your participation!\n\nBest Regards,\nSTIS-V 2025 Team`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Abstract Submission Status - STIS-V 2025`,
      text: emailText,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${user.email} for abstract code ${abstractCode} status update: ${status}`);

    res.json({ message: `Abstract ${status} successfully`, user });

  } catch (error) {
    console.error("❌ Error updating abstract status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});





app.post("/finalize-abstract", verifyToken, async (req, res) => {
  try {
    const { uid, abstractCode } = req.body;

    if (!uid || !abstractCode) {
      return res.status(400).json({ message: "User ID and Abstract Code are required." });
    }

    console.log(`✅ Finalizing abstract for UID: ${uid}, Code: ${abstractCode}`);

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    const abstractIndex = user.abstractSubmissions.findIndex(abs => abs.abstractCode === abstractCode);
    if (abstractIndex === -1) {
      return res.status(404).json({ message: "Abstract not found for given code." });
    }

    user.abstractSubmissions[abstractIndex].isFinalized = true;
    await user.save();

    // ✅ Update Google Sheets
    console.log("🔄 Updating Google Sheets...");
    const updatedAbstract = user.abstractSubmissions[abstractIndex];
await updateGoogleSheet(user, updatedAbstract);
    console.log("✅ Google Sheets updated successfully!");

    res.status(200).json({
      message: "Abstract finalized successfully",
      abstract: user.abstractSubmissions[abstractIndex],
    });

  } catch (error) {
    console.error("❌ Error finalizing abstract:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



app.delete("/delete-abstract-file", verifyToken, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await User.findOne({ uid });
    if (!user || !user.abstractSubmission.abstractFile) {
      return res.status(404).json({ message: "Abstract file not found" });
    }

    const publicId = user.abstractSubmission.abstractFile.split("/").pop().split(".")[0];
    cloudinary.uploader.destroy(publicId, async (error, result) => {
      if (error) {
        console.error("Error deleting file from Cloudinary:", error);
        return res.status(500).json({ message: "Error deleting file" });
      }
      user.abstractSubmission.abstractFile = null;
      await user.save();
      res.json({ message: "File deleted successfully" });
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get User Abstract
app.get("/get-abstract/:uid", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ abstracts: user.abstractSubmissions });  // ✅ return abstracts (plural)
  } catch (error) {
    console.error("Error fetching abstract:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



// Delete Abstract File
app.delete("/delete-abstract-file/:uid", verifyToken, async (req, res) => {
  try {
    const { abstractCode } = req.body;
    const abstract = user.abstractSubmissions.find(abs => abs.abstractCode === abstractCode);
      if (!abstract || !abstract.abstractFile) {
        return res.status(404).json({ message: "Abstract file not found" });
      }


    // Delete file from filesystem
    fs.unlink(user.abstractSubmission.abstractFile, async (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res.status(500).json({ message: "Error deleting file" });
      }

      // Update database to remove file reference
      user.abstractSubmission.abstractFile = null;
      await user.save();
      res.json({ message: "File deleted successfully" });
    });
  } catch (error) {
    console.error("Error deleting abstract file:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size is too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ message: error.message });
  }
  next(error);
});

// ✅ FIX: Get all abstracts submitted by a user
app.get("/get-abstracts-by-user/:uid", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ abstracts: user.abstractSubmissions || [] });
  } catch (error) {
    console.error("❌ Error fetching user abstracts:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ Get abstract by UID + Abstract Code
app.get("/get-abstract-by-code/:uid/:code", verifyToken, async (req, res) => {
  const { uid, code } = req.params;
  try {
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    const abstract = user.abstractSubmissions.find(abs => abs.abstractCode === code);
    if (!abstract) return res.status(404).json({ message: "Abstract not found" });

    res.status(200).json({ abstract });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});




// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
