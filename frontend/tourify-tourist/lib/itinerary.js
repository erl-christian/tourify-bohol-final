import client from './http';

export const listSavedItineraries = () =>
  client.get('/tourist/itineraries').then(res => res.data.itineraries ?? []);

export const saveItinerary = payload =>
  client.post('/tourist/itineraries', payload).then(res => res.data);

export const optimizeRoute = async payload => {
  try {
    const res = await client.post('/tourist/itineraries/preview', payload);
    return res.data ?? {};
  } catch (err) {
    console.warn('Route optimise failed, falling back to client ordering.', err);
    return {
      summary: {
        distance_km: null,
        duration_minutes: null,
      },
      orderedStops: payload.stops ?? [],
      route_geometry: [],
      alternate_routes: [],
    };
  }
};



