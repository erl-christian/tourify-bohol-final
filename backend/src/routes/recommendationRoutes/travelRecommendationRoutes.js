import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import {
  generateRecommendations,
  listRecommendations,
} from "../../controllers/recommendationControllers/travelRecommendationController.js";

const router = express.Router();

// tourists must be logged in; guard to "tourist" role
router.post("/generate", auth, requireRoles("tourist"), generateRecommendations);
router.get("/", auth, requireRoles("tourist"), listRecommendations);

export default router;
