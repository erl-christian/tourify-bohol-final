import express from "express";
import { optionalAuth } from "../../middleware/auth.js";
import { scanTouristArrival } from "../../controllers/tourist/arrivalController.js";

const router = express.Router();

router.post("/arrivals/scan", optionalAuth, scanTouristArrival);

export default router;
