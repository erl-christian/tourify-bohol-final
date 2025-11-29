import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import { addFavorite, listFavorites, removeFavorite } from "../../controllers/tourist/favoriteController.js";

const router = express.Router();

router.post("/favorites", auth, requireRoles("tourist"), addFavorite);
router.get("/favorites", auth, requireRoles("tourist"), listFavorites);
router.delete("/favorites/:estId", auth, requireRoles("tourist"), removeFavorite);

export default router;
