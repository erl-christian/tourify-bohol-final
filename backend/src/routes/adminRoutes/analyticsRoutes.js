import express from 'express';
import { auth, requireRoles } from '../../middleware/auth.js';
import {
  getEstablishmentFeedbackStats,
  getVisitorAnalytics,
  getDestinationAnalytics,
  getMovementAnalytics,
  getProvinceArrivals,
  getMunicipalityArrivals,
  getVisitorHeatmap,
  getFeedbackDistribution,
  getAccreditationSummary,
  getVisitorNationalities,
} from '../../controllers/adminControllers/analyticsControllers.js';
import { exportAnalyticsExcel, exportAnalyticsPdf } from '../../controllers/adminControllers/exportController.js';
import { exportLguAnalyticsExcel, exportLguAnalyticsPdf } from '../../controllers/adminControllers/lguExportController.js';

const router = express.Router();

router.get(
  '/establishments/:estId/feedback-stats',
  auth,
  requireRoles('lgu_admin', 'lgu_staff', 'bto_admin', 'bto_staff'),
  getEstablishmentFeedbackStats
);

router.get(
  '/visitors',
  auth,
  requireRoles('bto_admin', 'bto_staff', 'lgu_admin'),
  getVisitorAnalytics
);

router.get(
  '/destinations',
  auth,
  requireRoles('bto_admin', 'bto_staff', 'lgu_admin'),
  getDestinationAnalytics
);

router.get(
  '/movements',
  auth,
  requireRoles('bto_admin', 'bto_staff', 'lgu_admin'),
  getMovementAnalytics
);

router.get(
  '/analytics/movements',
  auth,
  requireRoles('bto_admin', 'bto_staff', 'lgu_admin'),
  getMovementAnalytics
);

const noCacheConfig = {
  headers: { 'Cache-Control': 'no-cache' },
};

export const fetchMovementAnalytics = params =>
  http.get('/admin/analytics/movements', { params, ...noCacheConfig });

router.get(
  '/arrivals/province',
  auth,
  requireRoles('bto_admin', 'bto_staff', 'lgu_admin'),
  getProvinceArrivals
);

router.get(
  '/arrivals/municipalities',
  auth,
  requireRoles('bto_admin', 'bto_staff', 'lgu_admin', 'lgu_staff'),
  getMunicipalityArrivals
);

router.get(
  '/heatmap',
  auth,
  requireRoles('bto_admin', 'bto_staff', 'lgu_admin', 'lgu_staff'),
  getVisitorHeatmap
);

router.get(
  '/feedback-distribution',
  auth,
  requireRoles('bto_admin', 'bto_staff'),
  getFeedbackDistribution
);

router.get(
  '/accreditation',
  auth,
  requireRoles('bto_admin', 'bto_staff'),
  getAccreditationSummary
);

router.get(
  '/nationalities',
  auth,
  requireRoles('bto_admin', 'bto_staff'),
  getVisitorNationalities
);


router.get('/export/excel', auth, requireRoles('bto_admin', 'bto_staff'), exportAnalyticsExcel);
router.get('/export/pdf', auth, requireRoles('bto_admin', 'bto_staff'), exportAnalyticsPdf);

router.get('/lgu/export/excel', auth, requireRoles('lgu_admin', 'lgu_staff'), exportLguAnalyticsExcel);
router.get('/lgu/export/pdf', auth, requireRoles('lgu_admin', 'lgu_staff'), exportLguAnalyticsPdf);

router.get('/movements', auth, requireRoles('bto_admin', 'bto_staff', 'lgu_admin'), getMovementAnalytics);

export default router;
