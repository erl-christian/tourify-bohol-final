import MediaProfile from "../../models/Media/MediaProfile.js";
import Media from "../../models/Media/Media.js";
import TouristProfile from "../../models/tourist/TouristProfile.js";
import cloudinary from "../../services/cloudinaryService.js";

const uploadToCloudinary = (fileBuffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    stream.end(fileBuffer);
  });

export const uploadTouristMedia = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) {
      res.status(404);
      throw new Error("Tourist profile not found");
    }

    const file = req.file;
    if (!file) {
      res.status(400);
      throw new Error("Image file is required");
    }

    const folder = process.env.CLOUDINARY_ROOT_FOLDER
      ? `${process.env.CLOUDINARY_ROOT_FOLDER}/tourists/${tourist.tourist_profile_id}`
      : `tourists/${tourist.tourist_profile_id}`;

    const uploadResult = await uploadToCloudinary(file.buffer, folder);

    await MediaProfile.updateMany(
      { tourist_profile_id: tourist.tourist_profile_id, is_primary: true },
      { $set: { is_primary: false } }
    );

    const media = await Media.create({
      account_id,
      business_establishment_id: tourist.tourist_profile_id,
      file_url: uploadResult.secure_url,
      file_type: "image",
      uploaded_by: account_id,
      public_id: uploadResult.public_id,
    });

    const profileMedia = await MediaProfile.create({
      tourist_profile_id: tourist.tourist_profile_id,
      media_id: media.media_id,
      is_primary: true,
    });

    tourist.avatar_media_id = media.media_id;
    tourist.avatar_url = uploadResult.secure_url;
    await tourist.save();

    res.status(201).json({
      message: "Profile photo updated",
      media,
      profileMedia,
      profile: tourist,
    });
  } catch (err) {
    next(err);
  }
};
