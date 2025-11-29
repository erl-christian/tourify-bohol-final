import express from "express";
import { auth, requireRoles } from "../../middleware/auth.js";
import {
  createItinerary,
  getMyItineraries,
  updateItineraryStatus,
  getTravelHistory
} from "../../controllers/tourist/itineraryController.js";

import { 
  addHistoryStop, 
  deleteHistoryStop, 
  listItineraryStops,
  markStopVisited, 
  reorderItineraryStops, 
  updateHistoryStop } from "../../controllers/tourist/travelHistoryController.js";
import { checkinStop, finalizeItinerary } from "../../controllers/tourist/checkInController.js";
import { previewItinerary } from "../../controllers/tourist/itineraryPreviewControl.js";


const router = express.Router();

//itinerary
router.post("/", auth, requireRoles("tourist"), createItinerary);
router.get("/", auth, requireRoles("tourist"), getMyItineraries);
router.patch("/:id/status", auth, requireRoles("tourist"), updateItineraryStatus);

//travel history
router.post("/:itineraryId/history", auth, requireRoles("tourist"), addHistoryStop);
router.get("/:itineraryId/history",  auth, requireRoles("tourist"), listItineraryStops);
router.patch("/history/:thId",           auth, requireRoles("tourist"), updateHistoryStop);
router.patch("/history/:thId/visit",     auth, requireRoles("tourist"), markStopVisited);
router.delete("/history/:thId",          auth, requireRoles("tourist"), deleteHistoryStop);

router.patch("/:itineraryId/history/reorder", auth, requireRoles("tourist"), reorderItineraryStops);

//check in
router.post("/:itineraryId/checkin", auth, requireRoles("tourist"), checkinStop);
router.post( "/:itineraryId/complete", auth, requireRoles("tourist"), finalizeItinerary);

//mmapping
router.post("/preview", auth, requireRoles("tourist"), previewItinerary);

//travel history
router.get('/history', auth,requireRoles('tourist'),getTravelHistory);

export default router;
