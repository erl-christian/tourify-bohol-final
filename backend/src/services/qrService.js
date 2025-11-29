import QRCode from 'qrcode';
import cloudinary from './cloudinaryService.js';

const QR_FOLDER = process.env.CLOUDINARY_QR_FOLDER ?? 'tourify/qr';

export const generateEstablishmentQr = async establishmentId => {
  const trackingUrl = `${process.env.APP_PUBLIC_URL}/tourist/check-in?est=${establishmentId}`;

  const pngBuffer = await QRCode.toBuffer(trackingUrl, {
    type: 'png',
    width: 512,
    errorCorrectionLevel: 'H',
  });

  const uploadResult = await cloudinary.uploader.upload(
    `data:image/png;base64,${pngBuffer.toString('base64')}`,
    {
      folder: QR_FOLDER,
      public_id: `qr-${establishmentId}`,
      overwrite: true,
      resource_type: 'image',
    }
  );

  return {
    publicUrl: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
};
