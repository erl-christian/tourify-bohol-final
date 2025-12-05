import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing } from '../../constants/theme';

export default function LoginQrScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  const handleBarcode = useCallback(
    ({ data }) => {
      if (scanned || !data) return;
      setScanned(true);

      try {
        let establishmentId = data;

        if (data.startsWith('{')) {
          const parsed = JSON.parse(data);
          establishmentId =
            parsed.business_establishment_id ||
            parsed.est ||
            parsed.establishmentId ||
            establishmentId;
        } else if (data.startsWith('http') || data.startsWith('tourify://')) {
          const url = new URL(data);
          establishmentId =
            url.searchParams.get('est') ||
            url.searchParams.get('establishmentId') ||
            url.pathname.split('/').filter(Boolean).pop();
        }

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
