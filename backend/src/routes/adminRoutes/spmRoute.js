import express from 'express';
import { auth, requireRoles } from '../../middleware/auth.js';
import { runSpmMining, getSpmStatus } from '../../services/spmService.js';

const router = express.Router();

// Cooldown: block if already running; you can add timestamps to enforce min interval if desired.
router.post('/spm/rebuild', auth, requireRoles('bto_admin', 'lgu_admin', 'lgu_staff'), async (req, res, next) => {
  try {
    const status = getSpmStatus();
    if (status.running) {
      res.status(429);
      throw new Error('SPM mining is already running');
    }
    const result = await runSpmMining();
    res.json({ message: 'SPM rebuild complete', result });
  } catch (err) {
    next(err);
  }
});

router.get('/spm/status', auth, requireRoles('bto_admin', 'lgu_admin', 'lgu_staff'), (req, res) => {
  res.json(getSpmStatus());
});

export default router;
