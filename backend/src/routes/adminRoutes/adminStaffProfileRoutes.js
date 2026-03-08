import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import {
  actOnEstablishment,
  createLGUAdmin,
  createLGUStaff,
  getEstablishmentDetails,
  getLGUStaffs,
  listMunicipalOwners,
  lguCreateOwnerProfile,
  lguCreateEstablishmentForOwner,
  listApprovalHistory,
  listAllEstablishments,
  listMyEstablishments,
  listPendingEstablishment,
  ownerCreateEstablishment,
  ownerUpdatePendingEstablishment,
  listMunicipalEstablishments,
  regenerateEstablishmentQr,
  endorseEstablishmentToAdmin,
  listMunicipalFeedbackForEstablishment,
  listOwnerFeedbackForEstablishment,
  getOwnerEstablishmentActivity,
  updateLguAdminStatus,
  updateLguManagedAccountStatus,
  updateLguAdmin,
  updateLguManagedAccount,
  lguModerateFeedback, 
  createBTOStaff
} from "../../controllers/adminControllers/adminStaffProfileController.js";
import {
  listEstablishmentMedia,
  removeEstablishmentMedia,
  uploadEstablishmentMedia,
} from "../../controllers/adminControllers/establishmentMediaController.js";
import { mediaUpload } from "../../services/mediaUpload.js";
import {
  lguReplyFeedback,
  ownerReplyFeedback,
  btoReplyFeedback, 
  btoModerateFeedback
} from "../../controllers/adminControllers/feedbackModerationController.js";
import { getFeedbackDetails, listFeedbackForEstablishment} from "../../controllers/publicControllers/publicFeedbackController.js";
import {
  generateFeedbackSummary,
  getLatestFeedbackSummary,
  getEstablishmentFeedbackStats,
} from "../../controllers/adminControllers/analyticsControllers.js";

const router = express.Router();

// bto/lgu/staff
router.post("/bto/create-lgu-admin", auth, requireRoles("bto_admin", "bto_staff"), createLGUAdmin);
router.post("/bto/create-bto-staff", auth, requireRoles("bto_admin", "bto_staff"), createBTOStaff);
router.post("/lgu/create-lgu-staff", auth, requireRoles("lgu_admin"), createLGUStaff);

router.get("/bto/list", auth, requireRoles("bto_admin", "bto_staff", "lgu_admin"), getLGUStaffs);
router.get("/bto/establishments", auth, requireRoles("bto_admin", "bto_staff"), listAllEstablishments);
router.patch( '/lgu/accounts/:accountId', auth, requireRoles('lgu_admin'), updateLguManagedAccount);

// establishments
router.post("/lgu/create-owner", auth, requireRoles("lgu_admin"), lguCreateOwnerProfile);
router.get("/lgu/owners", auth, requireRoles("lgu_admin", "lgu_staff"), listMunicipalOwners);
router.post("/lgu/establishments", auth, requireRoles("lgu_admin", "lgu_staff"), lguCreateEstablishmentForOwner);
router.post("/lgu/establishments/:estId/approval", auth, requireRoles("lgu_admin", "lgu_staff"), actOnEstablishment);
router.post("/establishments", auth, requireRoles("business_establishment"), ownerCreateEstablishment);

router.get("/establishments", auth, requireRoles("business_establishment"), listMyEstablishments);

router.get("/lgu/establishments", auth, requireRoles("lgu_admin", "lgu_staff"), listMunicipalEstablishments);
router.get("/lgu/establishments/pending", auth, requireRoles("lgu_admin", "lgu_staff"), listPendingEstablishment);
router.get("/lgu/establishments/:estId", auth, requireRoles("lgu_admin", "lgu_staff"), getEstablishmentDetails);
router.get("/lgu/establishments/:estId/approvals", auth, requireRoles("lgu_admin", "lgu_staff"), listApprovalHistory);
router.get('/bto/establishments/:estId', auth, requireRoles('bto_admin', 'bto_staff'), getEstablishmentDetails);
router.post("/lgu/establishments/:estId/endorse", auth, requireRoles("lgu_staff"), endorseEstablishmentToAdmin);

router.patch("/establishments/:estId", auth, requireRoles("business_establishment"), ownerUpdatePendingEstablishment);

router.post("/establishments/:estId/qr", auth, requireRoles("business_establishment", "lgu_admin"), regenerateEstablishmentQr);

// media
router.post(
  "/establishments/:estId/media",
  auth,
  requireRoles("business_establishment", "lgu_admin"),
  mediaUpload.array("files", 6),
  uploadEstablishmentMedia
);
router.get(
  "/establishments/:estId/media",
  auth,
  requireRoles("business_establishment", "lgu_admin", "lgu_staff", "bto_admin", "bto_staff"),
  listEstablishmentMedia
);
router.delete(
  "/establishments/:estId/media/:mediaId",
  auth,
  requireRoles("business_establishment", "lgu_admin"),
  removeEstablishmentMedia
);

// feedback
router.post("/establishments/feedback/:feedbackId/reply", auth, requireRoles("business_establishment"), ownerReplyFeedback);
router.post("/lgu/feedback/:feedbackId/reply", auth, requireRoles("lgu_admin", "lgu_staff"), lguReplyFeedback);

// router.get("/feedback/:feedbackId", auth, requireRoles("business_establishment", "lgu_admin", "lgu_staff"), getFeedbackDetails);

router.post("/lgu/establishments/:estId/feedback-summary", auth, requireRoles("lgu_admin", "bto_admin", "bto_staff", "lgu_staff"), generateFeedbackSummary);
router.get("/lgu/establishments/:estId/feedback-summary/latest", auth, requireRoles("lgu_admin", "bto_admin", "bto_staff", "lgu_staff"), getLatestFeedbackSummary);

router.get(
  '/analytics/establishments/:estId/feedback-stats',
  auth,
  requireRoles('lgu_admin', 'bto_admin', 'bto_staff', 'lgu_staff'),
  getEstablishmentFeedbackStats
);

// distinct endpoints so each role hits the right controller
router.get(
  "/lgu/establishments/:estId/feedback",
  auth,
  requireRoles("lgu_admin", "lgu_staff"),
  listMunicipalFeedbackForEstablishment
);

router.get(
  "/establishments/:estId/feedback",
  auth,
  requireRoles("business_establishment"),
  listOwnerFeedbackForEstablishment
);

router.get(
  "/establishments/:estId/activity",
  auth,
  requireRoles("business_establishment"),
  getOwnerEstablishmentActivity
);

router.get(
  '/bto/establishments/:estId/feedback',
  auth,
  requireRoles('bto_admin', 'bto_staff'),
  listFeedbackForEstablishment
);

router.get(
  '/feedback/:feedbackId',
  auth,
  requireRoles('business_establishment', 'lgu_admin', 'lgu_staff', 'bto_admin', 'bto_staff'),
  getFeedbackDetails
);

router.patch(
  "/bto/lgu-admins/:accountId/status",
  auth,
  requireRoles("bto_admin", "bto_staff"),
  updateLguAdminStatus
);


router.patch(
  '/lgu/accounts/:accountId/status',
  auth,
  requireRoles('lgu_admin'),
  updateLguManagedAccountStatus,
);

router.patch(
  '/bto/lgu-admins/:accountId',
  auth,
  requireRoles('bto_admin', 'bto_staff'),
  updateLguAdmin,
);

router.post("/bto/feedback/:feedbackId/reply", auth, requireRoles("bto_admin", "bto_staff"), btoReplyFeedback);
router.patch("/bto/feedback/:feedbackId/moderate", auth, requireRoles("bto_admin", "bto_staff"), btoModerateFeedback);


router.patch( '/lgu/feedback/:feedbackId/moderate',auth,requireRoles('lgu_admin', 'lgu_staff'),lguModerateFeedback,);

export default router;


