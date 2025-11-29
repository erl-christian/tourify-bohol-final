import Media from "../../models/Media/Media.js";
import MediaFeedback from "../../models/Media/MediaFeedback.js";
import Feedback from "../../models/feedback/Feedback.js";
import TouristProfile from "../../models/tourist/TouristProfile.js";
import cloudinary from '../../services/cloudinaryService.js';

const uploadToCloudinary = (fileBuffer, folder, resourceType) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation:
          resourceType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : undefined,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    stream.end(fileBuffer);
  });


// ensure the feedback belongs to the logged tourist
async function assertOwnership(account_id, feedback_id){
  const profile = await TouristProfile.findOne({ account_id });
  if (!profile) { const e=new Error("Tourist profile not found"); e.status=404; throw e; }

  const fb = await Feedback.findOne({ feedback_id });
  if (!fb) { const e=new Error("Feedback not found"); e.status=404; throw e; }
  if (fb.tourist_profile_id !== profile.tourist_profile_id) {
    const e=new Error("Not allowed to modify others' feedback"); e.status=403; throw e;
  }
  return { profile, fb };
}

// POST /api/tourist/feedback/:feedbackId/media (multipart form-data, field: files[])
export const uploadFeedbackMedia = async (req,res,next)=>{
  try{
    const account_id = req.user?.account_id;
    if(!account_id) { res.status(401); throw new Error("Unauthorized"); }
    const { feedbackId } = req.params;

    const { fb } = await assertOwnership(account_id, feedbackId);

    const created = [];

    for (const file of req.files || []) {
      const resourceType = file.mimetype.startsWith('video') ? 'video' : 'image';
      const folder = process.env.CLOUDINARY_ROOT_FOLDER
        ? `${process.env.CLOUDINARY_ROOT_FOLDER}/feedback/${fb.business_establishment_id}`
        : `feedback/${fb.business_establishment_id}`;

      const uploadResult = await uploadToCloudinary(file.buffer, folder, resourceType);

      const media = await Media.create({
        account_id,
        business_establishment_id: fb.business_establishment_id,
        file_url: uploadResult.secure_url,
        file_type: resourceType,          // satisfies enum ('image' | 'video' | 'document')
        uploaded_by: account_id,
        public_id: uploadResult.public_id,
      });

      const mf = await MediaFeedback.create({
        feedback_id: feedbackId,
        media_id: media.media_id,
      });

      created.push({ media, media_feedback: mf })
    }
    res.status(201).json({ message: "Uploaded", items: created });
  }catch(e){ next(e); }
};

// GET /api/tourist/feedback/:feedbackId/media
export const listFeedbackMedia = async (req,res,next)=>{
  try{
    const { feedbackId } = req.params;
    const links = await MediaFeedback.find({ feedback_id: feedbackId }).lean();
    res.json({ items: links });
  }catch(e){ next(e); }
};

// DELETE /api/tourist/feedback/:feedbackId/media/:mediaId
export const removeFeedbackMedia = async (req,res,next)=>{
  try{
    const account_id = req.user?.account_id;
    const { feedbackId, mediaId } = req.params;

    await assertOwnership(account_id, feedbackId);

    const del = await MediaFeedback.findOneAndDelete({ feedback_id: feedbackId, media_id: mediaId });
    if (!del) return res.status(404).json({ message: "Media link not found" });
    // (optional) also delete Media record / file from storage here
    res.json({ message: "Removed" });
  }catch(e){ next(e); }
};
