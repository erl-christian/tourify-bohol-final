import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import {
  createTouristProfile,
  getMyProfile,
  getMyTouristProfile,
  updateMyTouristProfile,
} from "../../controllers/tourist/touristController.js";
import { uploadTouristMedia } from "../../controllers/tourist/mediaController.js";
import { mediaUpload } from "../../services/mediaUpload.js";

const router = express.Router();

router.post("/create-profile", auth, requireRoles("tourist"), createTouristProfile);
router.get("/profile", auth, requireRoles("tourist"), getMyTouristProfile);
router.patch("/update-profile", auth, requireRoles("tourist"), updateMyTouristProfile);
router.post(
  "/profile/media",
  auth,
  requireRoles("tourist"),
  mediaUpload.single("file"),
  uploadTouristMedia
);
router.get("/me", auth, requireRoles("tourist"), getMyProfile);

export default router;
