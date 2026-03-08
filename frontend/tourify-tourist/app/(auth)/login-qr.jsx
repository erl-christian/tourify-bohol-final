import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing } from '../../constants/theme';
import { scanTouristArrival } from '../../lib/tourist';

const buildArrivalSessionId = () =>
  `arr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const parseQrData = data => {
  const raw = String(data ?? '').trim();
  if (!raw) return null;

  if (raw.startsWith('{')) {
    const parsed = JSON.parse(raw);
    const qrType = String(parsed.qr_type ?? parsed.type ?? '').toLowerCase();
    if (qrType === 'arrival') {
      return {
        kind: 'arrival',
        entry_point_type: parsed.entry_point_type ?? parsed.entryPointType ?? 'other',
        entry_point_name: parsed.entry_point_name ?? parsed.entryPointName ?? '',
        qr_code_id: parsed.qr_code_id ?? parsed.qrCodeId ?? 'arrival-qr',
      };
    }
    return {
      kind: 'establishment',
      establishmentId:
        parsed.business_establishment_id ||
        parsed.est ||
        parsed.establishmentId ||
        null,
    };
  }

  if (raw.startsWith('http') || raw.startsWith('tourify://')) {
    const url = new URL(raw);
    const qrType = String(url.searchParams.get('type') ?? url.searchParams.get('qr_type') ?? '').toLowerCase();
    if (qrType === 'arrival' || url.searchParams.get('arrival') === '1') {
      return {
        kind: 'arrival',
        entry_point_type: url.searchParams.get('entryPointType') ?? url.searchParams.get('entry_point_type') ?? 'other',
        entry_point_name: url.searchParams.get('entryPointName') ?? url.searchParams.get('entry_point_name') ?? '',
        qr_code_id: url.searchParams.get('qrCodeId') ?? url.searchParams.get('qr_code_id') ?? 'arrival-qr',
      };
    }
    return {
      kind: 'establishment',
      establishmentId:
        url.searchParams.get('est') ||
        url.searchParams.get('establishmentId') ||
        url.pathname.split('/').filter(Boolean).pop() ||
        null,
    };
  }

  if (raw.toUpperCase().startsWith('ARRIVAL:')) {
    const chunks = raw.replace(/^ARRIVAL:/i, '').split('|');
    return {
      kind: 'arrival',
      entry_point_type: chunks[0] ?? 'other',
      entry_point_name: chunks[1] ?? '',
      qr_code_id: chunks[2] ?? 'arrival-qr',
    };
  }

  return { kind: 'establishment', establishmentId: raw };
};

export default function LoginQrScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  const handleBarcode = useCallback(
    async ({ data }) => {
      if (scanned || !data) return;
      setScanned(true);

      try {
        const parsedPayload = parseQrData(data);
        if (!parsedPayload) throw new Error('QR payload is empty.');

        if (parsedPayload.kind === 'arrival') {
          const sessionId = buildArrivalSessionId();
          await scanTouristArrival({
            entry_point_type: parsedPayload.entry_point_type,
            entry_point_name: parsedPayload.entry_point_name,
            qr_code_id: parsedPayload.qr_code_id,
            session_id: sessionId,
          });

          router.replace({
            pathname: '/(auth)/welcome',
            params: {
              arrivalSessionId: sessionId,
              entryPointType: parsedPayload.entry_point_type,
              entryPointName: parsedPayload.entry_point_name,
            },
          });
          return;
        }

        const establishmentId = parsedPayload.establishmentId;
        if (!establishmentId) throw new Error('No establishment ID detected.');
        console.log('[QR SCAN] establishmentId parsed:', establishmentId);
        router.replace({ pathname: '/(auth)/login', params: { establishmentId } });
      } catch (err) {
        Alert.alert('Invalid QR code', err.message || 'Please scan a Tourify venue QR.');
        setScanned(false);
      }
    },
    [router, scanned],
  );


  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.info}>Requesting camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.info}>
          Tourify needs camera access to scan venue QR codes.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarcode}
      />
      <View style={styles.overlay}>
        <Text style={styles.tip}>Align the venue QR inside the frame</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    position: 'absolute',
    bottom: spacing(2),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tip: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing(1),
    padding: spacing(2),
    backgroundColor: '#000',
  },
  info: {
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  primaryButton: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.9),
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
