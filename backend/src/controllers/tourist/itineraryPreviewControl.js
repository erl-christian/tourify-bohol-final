import axios from 'axios';
import polyline from '@mapbox/polyline';
import TouristProfile from '../../models/tourist/TouristProfile.js';

const ORS_ENDPOINT =
  'https://api.openrouteservice.org/v2/directions/driving-car?geometry_format=geojson';

export const previewItinerary = async (req, res, next) => {
  try {
    const toRad = deg => (deg * Math.PI) / 180;

    const haversine = (a, b) => {
      const R = 6371; // km
      const dLat = toRad(b.latitude - a.latitude);
      const dLng = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);

      const sinLat = Math.sin(dLat / 2);
      const sinLng = Math.sin(dLng / 2);

      const aa =
        sinLat * sinLat +
        sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);

      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    };

    const runAntColony = (stops, origin, options = {}) => {
      const n = stops.length;
      if (n <= 1 || !origin) return stops.map((_, idx) => idx);

      const {
        alpha = 1,
        beta = 3,
        rho = 0.55,
        q = 120,
        iterations = 60,
        ants = Math.max(30, n * 10),
      } = options;

      const distances = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => 0)
      );
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          if (i === j) continue;
          distances[i][j] = haversine(stops[i], stops[j]) + 1e-6;
        }
      }

      const originDistances = stops.map(stop => haversine(origin, stop) + 1e-6);
      const pheromone = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => 1)
      );
      const pheromoneOrigin = Array.from({ length: n }, () => 1);

      const pathLength = path => {
        let total = originDistances[path[0]];
        for (let i = 0; i < path.length - 1; i += 1) {
          total += distances[path[i]][path[i + 1]];
        }
        return total;
      };

      let bestPath = stops.map((_, idx) => idx);
      let bestScore = Number.POSITIVE_INFINITY;

      for (let iter = 0; iter < iterations; iter += 1) {
        const solutions = [];

        for (let ant = 0; ant < ants; ant += 1) {
          const remaining = new Set(bestPath);
          let current = -1;
          const tour = [];

          while (remaining.size) {
            const roulette = [];
            let denom = 0;

            remaining.forEach(candidate => {
              const tau =
                current === -1
                  ? pheromoneOrigin[candidate]
                  : pheromone[current][candidate];
              const dist =
                current === -1
                  ? originDistances[candidate]
                  : distances[current][candidate];

              const weight =
                Math.pow(tau, alpha) * Math.pow(1 / dist, beta);

              roulette.push({ candidate, weight });
              denom += weight;
            });

            let slice = Math.random() * denom;
            let chosen = roulette[roulette.length - 1].candidate;
            for (const step of roulette) {
              slice -= step.weight;
              if (slice <= 0) {
                chosen = step.candidate;
                break;
              }
            }

            tour.push(chosen);
            remaining.delete(chosen);
            current = chosen;
          }

          const tourCost = pathLength(tour);
          if (tourCost < bestScore) {
            bestScore = tourCost;
            bestPath = tour.slice();
          }
          solutions.push({ tour, tourCost });
        }

        // evaporate
        for (let i = 0; i < n; i += 1) {
          pheromoneOrigin[i] *= 1 - rho;
          for (let j = 0; j < n; j += 1) {
            pheromone[i][j] *= 1 - rho;
          }
        }

        solutions.forEach(({ tour, tourCost }) => {
          const contribution = q / tourCost;
          pheromoneOrigin[tour[0]] += contribution;
          for (let i = 0; i < tour.length - 1; i += 1) {
            const from = tour[i];
            const to = tour[i + 1];
            pheromone[from][to] += contribution;
            pheromone[to][from] += contribution;
          }
        });
      }

      return bestPath;
    };
    const account_id = req.user?.account_id;
    if (!account_id) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) {
      const err = new Error('Tourist profile not found');
      err.status = 404;
      throw err;
    }

    const { stops = [], origin } = req.body;

    const originPoint =
      origin &&
      Number.isFinite(Number(origin.latitude)) &&
      Number.isFinite(Number(origin.longitude))
        ? {
            latitude: Number(origin.latitude),
            longitude: Number(origin.longitude),
          }
        : null;

    const normalizedStops = stops.map(stop => {
      const lat = Number(stop.latitude);
      const lng = Number(stop.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const err = new Error(
          `Missing coordinates for stop ${stop.business_establishment_id ?? ''}`
        );
        err.status = 400;
        throw err;
      }
      return { latitude: lat, longitude: lng };
    });
    

    // const ordering = runAntColony(normalizedStops, originPoint);
    const hasManualOrder = stops.every(stop => Number.isFinite(stop.preferred_order));

    let orderedStops;
    if (hasManualOrder) {
      orderedStops = stops
        .slice()
        .sort((a, b) => a.preferred_order - b.preferred_order)
        .map((stop, index) => ({ ...stop, order: index }));
    } else {
      const ordering = runAntColony(normalizedStops, originPoint);
      orderedStops = ordering.map((stopIndex, order) => ({
        ...stops[stopIndex],
        order,
      }));
    }

    


    if (!Array.isArray(stops) || stops.length < 1) {
      return res.json({
        orderedStops,
        summary: { distance_km: null, duration_minutes: null },
        route_geometry: [],
        alternate_routes: [],
      });
    }

    const coordinates = [];
    if (originPoint) {
      coordinates.push([originPoint.longitude, originPoint.latitude]);
    }
    orderedStops.forEach(stop => {
      coordinates.push([Number(stop.longitude), Number(stop.latitude)]);
    });

    console.log(
      'Ordered stops:',
      orderedStops.map(stop => ({
        order: stop.order,
        id: stop.business_establishment_id,
        latitude: stop.latitude,
        longitude: stop.longitude,
      }))
    );

    if (coordinates.length < 2) {
      return res.json({
        orderedStops,
        summary: { distance_km: null, duration_minutes: null },
        route_geometry: [],
        alternate_routes: [],
      }); 
    }


    let summary = { distance_km: null, duration_minutes: null };
    let routeGeometry = [];
    const buildORSRequest = radius =>
      axios.post(
        ORS_ENDPOINT,
        {
          coordinates,
          radiuses: new Array(coordinates.length).fill(radius),
          instructions: false,
        },
        {
          headers: {
            Authorization: process.env.ORS_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
    try {
      let orsResponse;

      try {
        orsResponse = await buildORSRequest(200); // narrow search first
      } catch (err) {
        if (err.response?.data?.error?.code === 2010) {
          console.warn(
            'ORS snap failed at 200 m; retrying with 10 000 m',
            err.response.data
          );
          orsResponse = await buildORSRequest(10000); // big fallback
        } else {
          throw err;
        }
      }

      const route = orsResponse.data?.routes?.[0];
      if (route) {
        const rawSummary = route.summary ?? {};
        summary = {
          distance_km: rawSummary.distance ? rawSummary.distance / 1000 : null,
          duration_minutes: rawSummary.duration ? rawSummary.duration / 60 : null,
        };

        const geometry = route.geometry;
        if (geometry?.coordinates) {
          routeGeometry = geometry.coordinates.map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }));
        } else if (typeof geometry === 'string') {
          routeGeometry = polyline
            .decode(geometry, 5)
            .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
        }
      }
    } catch (apiError) {
      console.warn(
        'ORS preview request failed',
        apiError.response?.data ?? apiError.message
      );
    }

    return res.json({
      orderedStops,
      summary,
      route_geometry: routeGeometry,
      alternate_routes: [],
      origin: originPoint,
    });
  } catch (err) {
    next(err);
  }
};
