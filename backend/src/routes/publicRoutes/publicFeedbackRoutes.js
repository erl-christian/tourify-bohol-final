import express from "express";
import { getFeedbackDetails, listFeedbackForEstablishment } from "../../controllers/publicControllers/publicFeedbackController.js";
const router = express.Router();

router.get("/establishments/:estId/feedback", listFeedbackForEstablishment);
router.get("/feedback/:feedbackId", getFeedbackDetails);


export default router;
