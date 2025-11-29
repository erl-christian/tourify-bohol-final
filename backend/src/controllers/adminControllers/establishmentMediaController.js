import cloudinary from '../../services/cloudinaryService.js';
import Media from '../../models/Media/Media.js';

const uploadToCloudinary = (fileBuffer, folder, resourceType) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation: resourceType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : undefined,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    stream.end(fileBuffer);
  });

export const uploadEstablishmentMedia = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const files = req.files || [];
    if (!files.length) {
      res.status(400);
      throw new Error('No media uploaded');
    }

    const folder = process.env.CLOUDINARY_ROOT_FOLDER
      ? `${process.env.CLOUDINARY_ROOT_FOLDER}/${estId}`
      : estId;

    const uploads = await Promise.all(
      files.map(async (file) => {
        const resourceType = file.mimetype.startsWith('video') ? 'video' : 'image';
        const result = await uploadToCloudinary(file.buffer, folder, resourceType);

        return Media.create({
        account_id: req.user?.account_id,
        business_establishment_id: estId,
        file_url: result.secure_url,
        file_type: resourceType,
        caption: req.body.caption || null,
        uploaded_by: req.user?.account_id,
        public_id: result.public_id,
        });
      }),
    );

    res.status(201).json({ message: 'Media uploaded', media: uploads });
  } catch (err) {
    next(err);
  }
};

export const removeEstablishmentMedia = async (req, res, next) => {
  try {
    const { estId, mediaId } = req.params;
    const media = await Media.findOneAndDelete({
      business_establishment_id: estId,
      media_id: mediaId,
    });

    if (!media) {
      res.status(404);
      throw new Error('Media not found');
    }

    if (media.public_id) {
      await cloudinary.uploader.destroy(media.public_id, {
        resource_type: media.file_type === 'video' ? 'video' : 'image',
      });
    }

    res.json({ message: 'Media deleted' });
  } catch (err) {
    next(err);
  }
};

export const listEstablishmentMedia = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const items = await Media.find({ business_establishment_id: estId }).sort({ createdAt: -1 });
    res.json({ media: items });
  } catch (err) {
    next(err);
  }
};
