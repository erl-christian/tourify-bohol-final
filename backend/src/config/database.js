import mongoose from "mongoose";
import { getMongoUri } from "./dbUri.js";

export const connectDB = async () => {
  try {
    const uri = getMongoUri();
    if (!uri) throw new Error("Missing Mongo URI");
    const options = process.env.MONGO_DB ? { dbName: process.env.MONGO_DB } : undefined;
    await mongoose.connect(uri, options);
    console.log("MongoDB connected");
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};


// import mongoose from "mongoose"

// export const connectDB = async () => {
//     try {
//         await mongoose.connect(process.env.MONGO_URI)
//         console.log("`✅ MongoDB connected`");
//     } catch (error) {
//         console.error(`❌ MongoDB connection error: ${error.message}`);
//         process.exit(1);
//     }
// }