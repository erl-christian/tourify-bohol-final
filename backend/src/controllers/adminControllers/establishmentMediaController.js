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

    const mediaKind = req.body.media_kind || 'spot_gallery';
    if (!['spot_gallery', 'submission_requirement'].includes(mediaKind)) {
      res.status(400);
      throw new Error('Invalid media_kind');
    }

    const inferFileType = (mime = '') => {
      if (mime.startsWith('image/')) return 'image';
      if (mime.startsWith('video/')) return 'video';
      return 'document';
    };

    const toCloudinaryType = (fileType) => {
      if (fileType === 'image') return 'image';
      if (fileType === 'video') return 'video';
      return 'raw';
    };

    const folder = process.env.CLOUDINARY_ROOT_FOLDER
      ? `${process.env.CLOUDINARY_ROOT_FOLDER}/${estId}`
      : estId;

    const uploads = await Promise.all(
      files.map(async (file) => {
        const fileType = inferFileType(file.mimetype);

        if (mediaKind === 'spot_gallery' && fileType === 'document') {
          res.status(400);
          throw new Error('Documents are not allowed for spot_gallery');
        }
        if (mediaKind === 'submission_requirement' && fileType === 'video') {
          res.status(400);
          throw new Error('Videos are not allowed for submission_requirement');
        }

        const result = await uploadToCloudinary(
          file.buffer,
          folder,
          toCloudinaryType(fileType)
        );

        return Media.create({
          account_id: req.user?.account_id,
          business_establishment_id: estId,
          media_kind: mediaKind,
          file_url: result.secure_url,
          file_type: fileType,
          original_name: file.originalname,
          mime_type: file.mimetype,
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
        resource_type:
          media.file_type === 'video'
            ? 'video'
            : media.file_type === 'image'
            ? 'image'
            : 'raw'
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
    const { media_kind } = req.query;
    const filter = { business_establishment_id: estId };
    if (media_kind) filter.media_kind = media_kind;
    const items = await Media.find(filter).sort({ createdAt: -1 });
    res.json({ media: items });
  } catch (err) {
    next(err);
  }
};
