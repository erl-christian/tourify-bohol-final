import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import {
  createFeedback, 
  listMyFeedback, 
  updateMyFeedback, 
  deleteMyFeedback
} from "../../controllers/tourist/feedbackController.js";
import { 
  listFeedbackMedia, 
  removeFeedbackMedia, 
  uploadFeedbackMedia 
} from "../../controllers/tourist/mediaFeedbackController.js";
import { mediaUpload } from "../../services/mediaUpload.js";

const router = express.Router();

router.post("/",           auth, requireRoles("tourist"), createFeedback);
router.get("/my",         auth, requireRoles("tourist"), listMyFeedback);
router.patch("/:feedbackId", auth, requireRoles("tourist"), updateMyFeedback);
router.delete("/:feedbackId", auth, requireRoles("tourist"), deleteMyFeedback);


//media feedback
router.post("/:feedbackId/media", auth, requireRoles("tourist"), mediaUpload.array("files", 6), uploadFeedbackMedia);
router.get ("/:feedbackId/media",  auth, requireRoles("tourist"), listFeedbackMedia);
router.delete("/:feedbackId/media/:mediaId", auth, requireRoles("tourist"), removeFeedbackMedia);

export default router;
