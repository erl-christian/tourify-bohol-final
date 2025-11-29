import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import {
  createTag, listTags,
  addTagToEstablishment, removeTagFromEstablishment, listEstablishmentTags
} from "../../controllers/adminControllers/tagController.js";

const router = express.Router();

// tag masterlist (LGU Admin or BTO)
router.post("/", auth, requireRoles("lgu_admin","bto_admin"), createTag);
router.get("/",  auth, requireRoles("lgu_admin","bto_admin","lgu_staff"), listTags);

// assign/remove to establishment
router.post("/establishments/:estId/tags", auth, requireRoles("lgu_admin","lgu_staff"), addTagToEstablishment);
router.delete("/establishments/:estId/tags/:tagId", auth, requireRoles("lgu_admin","lgu_staff"), removeTagFromEstablishment);
router.get("/establishments/:estId/tags", auth, requireRoles("lgu_admin","lgu_staff","business_establishment"), listEstablishmentTags);

export default router;
