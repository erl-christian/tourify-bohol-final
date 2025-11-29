import { Stack } from 'expo-router';

export default function ItineraryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="live" />
    </Stack>
  );
}
