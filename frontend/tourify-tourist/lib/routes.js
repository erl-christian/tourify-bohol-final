import polyline from '@mapbox/polyline';

const ORS_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY;
const ORS_ENDPOINT = 'https://api.openrouteservice.org/v2/directions/driving-car';


export const getOrsRoute = async stops => {
    
    if (!ORS_KEY) {
        throw new Error('Missing OpenRouteService API key. Set EXPO_PUBLIC_ORS_API_KEY in .env.');
    }

    if (!Array.isArray(stops) || stops.length < 2) {
        return { coordinates: [], distance_km: null, duration_minutes: null };
    }

    // ORS expects [lng, lat]
    const coords = stops.map(([lng, lat]) => [lng, lat]);

    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: process.env.EXPO_PUBLIC_ORS_API_KEY,
    },
    body: JSON.stringify({ coordinates, geometry_format: 'geojson' }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ORS request failed: ${response.status} – ${text}`);
    }

    const data = await response.json();
    const feature = data?.features?.[0];

    if (!feature) {
        return { coordinates: [], distance_km: null, duration_minutes: null };
    }

    const decoded = polyline.decode(feature.geometry.coordinates);

    return {
        coordinates: decoded.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
        distance_km: feature.properties?.summary?.distance
        ? feature.properties.summary.distance / 1000
        : null,
        duration_minutes: feature.properties?.summary?.duration
        ? feature.properties.summary.duration / 60
        : null,
    };
};
