import express from 'express';
import { auth, requireRoles } from '../../middleware/auth.js';
import {
  getVisitorAnalytics,
  getDestinationAnalytics,
  getMovementAnalytics,
  getFeedbackDistribution,
  getAccreditationSummary,
  getMunicipalityCheckins,
  getLguVisitorNationalities,
} from '../../controllers/adminControllers/analyticsControllers.js';

const router = express.Router();

router.get(
  '/arrivals',
  auth,
  requireRoles('lgu_admin', 'lgu_staff'),
  (req, res, next) => {
    req.query.scope = 'municipality';
    return getVisitorAnalytics(req, res, next);
  }
);

router.get(
  '/top-establishments',
  auth,
  requireRoles('lgu_admin', 'lgu_staff'),
  (req, res, next) => {
    req.query.scope = 'municipality';
    return getDestinationAnalytics(req, res, next);
  }
);

router.get(
  '/movements',
  auth,
  requireRoles('lgu_admin', 'lgu_staff'),
  (req, res, next) => getMovementAnalytics(req, res, next)
);

router.get(
  '/feedback-summary',
  auth,
  requireRoles('lgu_admin', 'lgu_staff'),
  (req, res, next) => getFeedbackDistribution(req, res, next)
);

router.get(
  '/approvals',
  auth,
  requireRoles('lgu_admin', 'lgu_staff'),
  (req, res, next) => getAccreditationSummary(req, res, next)
);

router.get(
  '/checkins',
  auth,
  requireRoles('lgu_admin', 'lgu_staff'),
  (req, res, next) => getMunicipalityCheckins(req, res, next) // implement this in analyticsControllers
);

// router.get(
//   '/itinerary-stops',
//   auth,
//   requireRoles('lgu_admin', 'lgu_staff'),
//   (req, res, next) => getMunicipalityItineraryStops(req, res, next)
// );

router.get(
  '/nationalities',
  auth,
  requireRoles('lgu_admin', 'lgu_staff'),
  (req, res, next) => getLguVisitorNationalities(req, res, next)
);



export default router;
