import Feedback from '../../models/feedback/Feedback.js';
import FeedbackResponse from '../../models/feedback/FeedbackResponse.js';
import BusinessEstablishment from '../../models/businessEstablishmentModels/BusinessEstablishment.js';
import TouristProfile from '../../models/tourist/TouristProfile.js';

export const listFeedbackThread = async (req, res, next) => {
  try {
    const { establishmentId } = req.params;

    const est = await BusinessEstablishment.findOne({
      businessEstablishment_id: establishmentId,
    });
    if (!est) { res.status(404); throw new Error('Establishment not found'); }

    const feedback = await Feedback.find({ business_establishment_id: establishmentId })
      .sort({ createdAt: -1 })
      .lean();

    const feedbackIds = feedback.map(fb => fb.feedback_id);
    const responses = await FeedbackResponse.find({ feedback_id: { $in: feedbackIds } })
      .sort({ createdAt: 1 })
      .lean();

    const grouped = feedback.map(fb => ({
      ...fb,
      responses: responses.filter(resp => resp.feedback_id === fb.feedback_id),
    }));

    res.json({ establishment: est, feedback: grouped });
  } catch (err) { next(err); }
};

export const replyToFeedback = async (req, res, next) => {
  try {
    const { feedbackId } = req.params;
    const { response_text } = req.body;
    if (!response_text) { res.status(400); throw new Error('response_text required'); }

    const fb = await Feedback.findOne({ feedback_id: feedbackId });
    if (!fb) { res.status(404); throw new Error('Feedback not found'); }

    const payload = { feedback_id: feedbackId, response_text };
    if (req.user.role === 'business_establishment') {
      payload.business_establishment_profile_id = req.user.profile_id;
    } else if (['lgu_admin', 'lgu_staff', 'bto_admin'].includes(req.user.role)) {
      payload.admin_staff_profile_id = req.user.profile_id;
    } else {
      res.status(403); throw new Error('Not allowed to reply');
    }

    const resp = await FeedbackResponse.create(payload);
    res.status(201).json({ message: 'Reply posted', reply: resp });
  } catch (err) { next(err); }
};
