import express from "express";
import {
  getEstablishments,
  getEstablishmentDetails,
  getMapOverview,
} from "../../controllers/publicControllers/publicEstablishmentController.js";

const router = express.Router();
router.get("/establishments", getEstablishments);
router.get("/establishments/map-overview", getMapOverview);
router.get("/establishments/:estId", getEstablishmentDetails);

export default router;
