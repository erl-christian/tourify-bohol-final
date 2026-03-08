import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import { linkTouristArrivalSession } from "../../controllers/tourist/arrivalController.js";

const router = express.Router();

router.post("/arrivals/link", auth, requireRoles("tourist"), linkTouristArrivalSession);

export default router;
