// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     await mongoose.connect("mongodb://localhost:27017/STISV", {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log("MongoDB Connected...");
//   } catch (err) {
//     console.error("MongoDB Connection Error:", err.message);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;



const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Atlas Connected...");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
