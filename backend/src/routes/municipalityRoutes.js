import express from "express"
import { createMunicipality, listMunicipalities } from "../controllers/municipalityController.js";

const router = express.Router();

router.post("/", createMunicipality);
router.get("/", listMunicipalities);

export default router;