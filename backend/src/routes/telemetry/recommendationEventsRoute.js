import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import { logEvent } from "../../controllers/recommendationControllers/recommendationEventController.js";
const router = express.Router();

router.post("/recommendations/event", auth, requireRoles("tourist"), logEvent);
export default router;
