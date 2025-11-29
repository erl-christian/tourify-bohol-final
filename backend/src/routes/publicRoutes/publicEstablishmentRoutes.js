import express from "express";
import { getEstablishments, getEstablishmentDetails } from "../../controllers/publicControllers/publicEstablishmentController.js";

const router = express.Router();
router.get("/establishments", getEstablishments);
router.get("/establishments/:estId", getEstablishmentDetails);

export default router;
