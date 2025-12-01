

//dependencies
import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import morgan from "morgan";
import mongoose from "mongoose";
import path from "path"


dotenv.config();

//database
import { connectDB } from "./config/database.js";

//routes
import accountRoutes from "./routes/accountRoutes.js"
import municipalityRoutes from "./routes/municipalityRoutes.js"
import adminStaffProfileRoutes from "../src/routes/adminRoutes/adminStaffProfileRoutes.js"
import touristProfileRoutes from "./routes/touristRoutes/touristProfileRoutes.js"
import itineraries from "./routes/touristRoutes/itineraryRoutes.js"
import touristFeedbackRoutes from "./routes/touristRoutes/feedbackRoutes.js";
import publicFeedbackRoutes from "./routes/publicRoutes/publicFeedbackRoutes.js"
import favoriteRoutes from "./routes/touristRoutes/favoriteRoutes.js";
import tagRoutes from "./routes/adminRoutes/tagRoutes.js";
import publicEstablishmentRoutes from "./routes/publicRoutes/publicEstablishmentRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes/travelRecommendationRoutes.js"
import telemetryRoutes from "./routes/telemetry/recommendationEventsRoute.js";
import feedbackThreadRoutes from './routes/feedbackThreadRoutes.js';
import analyticsRoutes from './routes/adminRoutes/analyticsRoutes.js';
import sharedItineraryRoutes from './routes/touristRoutes/sharedItineraryRoutes.js';
import lguAnalyticsRoutes from './routes/lguRoutes/analyticsRoutes.js';
import ownerAnalyticsRoutes from './routes/ownerRoutes/analyticsRoutes.js';


const app = express()
const PORT = process.env.PORT || 5001
const __dirname = path.resolve()

//middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://tourify-bohol-final.onrender.com",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}
app.use(express.json());

//qr
app.use('/uploads', express.static(path.resolve('uploads')));

//routes
app.use("/api/accounts", accountRoutes);
app.use("/api/municipalities", municipalityRoutes)
app.use("/api/admin", adminStaffProfileRoutes);
app.use("/api/tourist", touristProfileRoutes)
app.use("/api/tourist/itineraries", itineraries)
app.use("/api/tourist/feedback", touristFeedbackRoutes);
app.use("/api/public", publicFeedbackRoutes);
app.use("/api/tourist", favoriteRoutes);
app.use("/api/tourist/recommendations", recommendationRoutes);
app.use('/api/tourist/shared-itineraries', sharedItineraryRoutes);
app.use("/api/admin/tag", tagRoutes);
app.use("/api/public", publicEstablishmentRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use('/api/feedback', feedbackThreadRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use('/api/lgu/analytics', lguAnalyticsRoutes);
app.use('/api/owner/analytics', ownerAnalyticsRoutes);

if(process.env.NODE_ENV === "production"){
  const distPath = path.join(__dirname, '..', 'frontend', 'tourify-admin', 'dist');

  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

//db health
app.get("/api/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    server: true,
    dbState: states[mongoose.connection.readyState],
    ok: mongoose.connection.readyState === 1
  });
});


// simple error handler
app.use((err, req, res, next) => {
  const status = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(status).json({ message: err.message });
});

connectDB().then(() => app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`)));
