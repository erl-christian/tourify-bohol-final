import express from 'express';
import { auth, requireRoles } from '../../middleware/auth.js';
import {
  getRatingTrend,
  getReviewCounts,
  getCheckins,
  getTagPerformanceSummary,
  getFeedbackCategoryBreakdown,
} from '../../controllers/ownerControllers/analyticsController.js';

const router = express.Router();

router.get('/:estId/rating-trend', auth, requireRoles('business_establishment'), getRatingTrend);
router.get('/:estId/review-counts', auth, requireRoles('business_establishment'), getReviewCounts);
router.get('/:estId/checkins', auth, requireRoles('business_establishment'), getCheckins);
router.get('/:estId/tag-performance', auth, requireRoles('business_establishment'), getTagPerformanceSummary);
router.get('/:estId/feedback-categories', auth, requireRoles('business_establishment'), getFeedbackCategoryBreakdown);

export default router;
