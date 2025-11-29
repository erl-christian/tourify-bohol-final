import express from 'express';
import { auth, requireRoles } from '../../middleware/auth.js';
import { shareItinerary, listSharedItineraries } from '../../controllers/tourist/sharedItineraryController.js';

const router = express.Router();

router.get('/', listSharedItineraries);
router.post('/:itineraryId/share', auth, requireRoles('tourist'), shareItinerary);

export default router;
