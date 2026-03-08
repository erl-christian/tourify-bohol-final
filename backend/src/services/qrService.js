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

const sanitizeToken = value =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildArrivalQrPayload = ({
  entryPointType = 'other',
  entryPointName = '',
  qrCodeId = '',
}) => {
  const cleanType = sanitizeToken(entryPointType) || 'other';
  const cleanName = String(entryPointName ?? '').trim();
  const resolvedQrId =
    sanitizeToken(qrCodeId) ||
    `arrival-${cleanType}-${sanitizeToken(cleanName) || 'entry-point'}`;

  return {
    qr_type: 'arrival',
    entry_point_type: cleanType,
    entry_point_name: cleanName,
    qr_code_id: resolvedQrId,
  };
};

export const generateArrivalQrDataUrl = async ({
  entryPointType = 'other',
  entryPointName = '',
  qrCodeId = '',
}) => {
  const payload = buildArrivalQrPayload({
    entryPointType,
    entryPointName,
    qrCodeId,
  });

  const encodedPayload = JSON.stringify(payload);
  const dataUrl = await QRCode.toDataURL(encodedPayload, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 720,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  return {
    payload,
    payload_json: encodedPayload,
    data_url: dataUrl,
  };
};
