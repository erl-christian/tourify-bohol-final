import Feedback from '../../models/feedback/Feedback.js';
import FeedbackResponse from '../../models/feedback/FeedbackResponse.js';
import BusinessEstablishment from '../../models/businessEstablishmentModels/BusinessEstablishment.js';
import TouristProfile from '../../models/tourist/TouristProfile.js';
import AdminStaffProfile from '../../models/adminModels/AdminStaffProfile.js';
import BusinessEstablishmentProfile from '../../models/businessEstablishmentModels/BusinessEstablishmentProfile.js';

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

    const payload = {
      feedback_id: feedbackId,
      response_text: String(response_text).trim(),
    };
    if (!payload.response_text) { res.status(400); throw new Error('response_text required'); }

    if (req.user.role === 'business_establishment') {
      const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id: req.user.account_id })
        .select('business_establishment_profile_id')
        .lean();
      if (!ownerProfile?.business_establishment_profile_id) {
        res.status(403); throw new Error('Owner profile not found');
      }
      payload.business_establishment_profile_id = ownerProfile.business_establishment_profile_id;
    } else if (['lgu_admin', 'lgu_staff', 'bto_admin'].includes(req.user.role)) {
      if (req.user.role === 'bto_admin') {
        payload.bto_account_id = req.user.account_id;
      } else {
        const adminProfile = await AdminStaffProfile.findOne({ account_id: req.user.account_id })
          .select('admin_staff_profile_id')
          .lean();
        if (!adminProfile?.admin_staff_profile_id) {
          res.status(403); throw new Error('LGU profile not found');
        }
        payload.admin_staff_profile_id = adminProfile.admin_staff_profile_id;
      }
    } else if (req.user.role === 'tourist') {
      const tourist = await TouristProfile.findOne({ account_id: req.user.account_id })
        .select('tourist_profile_id')
        .lean();
      if (!tourist?.tourist_profile_id) {
        res.status(403); throw new Error('Tourist profile not found');
      }

      if (String(fb.tourist_profile_id) !== String(tourist.tourist_profile_id)) {
        res.status(403); throw new Error('You can only reply to your own feedback thread');
      }
      payload.tourist_profile_id = tourist.tourist_profile_id;
    } else {
      res.status(403); throw new Error('Not allowed to reply');
    }

    const resp = await FeedbackResponse.create(payload);
    res.status(201).json({ message: 'Reply posted', reply: resp });
  } catch (err) { next(err); }
};
