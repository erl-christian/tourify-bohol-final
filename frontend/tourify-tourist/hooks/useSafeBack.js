import { useRouter, router as RouterSingleton } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

export default function useSafeBack(fallback = '/home') {
  const router = useRouter();
  const navigation = useNavigation();

  return useCallback(() => {
    if (router?.canGoBack?.()) return router.back();
    if (navigation?.canGoBack?.()) return navigation.goBack();
    if (RouterSingleton?.back) return RouterSingleton.back();
    if (router?.replace) return router.replace(fallback);
    RouterSingleton?.replace?.(fallback);
  }, [router, navigation, fallback]);
}
