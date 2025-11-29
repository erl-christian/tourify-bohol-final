import Feedback from "../../models/feedback/Feedback.js";
import FeedbackResponse from "../../models/feedback/FeedbackResponse.js";
import AdminStaffProfile from "../../models/adminModels/AdminStaffProfile.js";
import BusinessEstablishmentProfile from "../../models/businessEstablishmentModels/BusinessEstablishmentProfile.js";

// POST /api/admin/lgu/feedback/:feedbackId/reply
// body: { response_text }
export const lguReplyFeedback = async (req, res, next) => {
  try {
    const accId = req.user?.account_id;
    const admin = await AdminStaffProfile.findOne({ account_id: accId, position: "LGU Admin" });
    if (!admin) { res.status(403); throw new Error("Only LGU Admins can reply"); }

    const { feedbackId } = req.params;
    const fb = await Feedback.findOne({ feedback_id: feedbackId });
    if (!fb) { res.status(404); throw new Error("Feedback not found"); }

    const { response_text } = req.body;
    if (!response_text) { res.status(400); throw new Error("response_text is required"); }

    const resp = await FeedbackResponse.create({
      feedback_id: feedbackId,
      admin_staff_profile_id: admin.admin_staff_profile_id,
      response_text
    });

    res.status(201).json({ message: "Reply posted", reply: resp });
  } catch (e) { next(e); }
};

// POST /api/owners/feedback/:feedbackId/reply
export const ownerReplyFeedback = async (req, res, next) => {
  try {
    const accId = req.user?.account_id;
    const owner = await BusinessEstablishmentProfile.findOne({ account_id: accId });
    if (!owner) { res.status(403); throw new Error("Only Establishment Owners can reply"); }

    const { feedbackId } = req.params;
    const fb = await Feedback.findOne({ feedback_id: feedbackId, business_establishment_id: { $exists: true } });
    if (!fb) { res.status(404); throw new Error("Feedback not found"); }

    const { response_text } = req.body;
    if (!response_text) { res.status(400); throw new Error("response_text is required"); }

    const resp = await FeedbackResponse.create({
      feedback_id: feedbackId,
      business_establishment_profile_id: owner.business_establishment_profile_id,
      response_text
    });

    res.status(201).json({ message: "Reply posted", reply: resp });
  } catch (e) { next(e); }
};
