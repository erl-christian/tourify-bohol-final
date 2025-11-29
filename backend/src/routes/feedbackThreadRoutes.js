import express from 'express';
import { auth, requireRoles } from '../middleware/auth.js';
import { listFeedbackThread, replyToFeedback } from '../controllers/feedback/feedbackThreadController.js';

const router = express.Router();

router.get(
  '/establishments/:establishmentId',
  auth,
  requireRoles('tourist', 'business_establishment', 'lgu_admin', 'lgu_staff', 'bto_admin'),
  listFeedbackThread
);

router.post(
  '/:feedbackId/reply',
  auth,
  requireRoles('business_establishment', 'lgu_admin', 'lgu_staff', 'bto_admin'),
  replyToFeedback
);

export default router;
