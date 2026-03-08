import axios from "axios";
import polyline from "@mapbox/polyline";
import TouristProfile from "../../models/tourist/TouristProfile.js";
const OPENWEATHER_ENDPOINT = "https://api.openweathermap.org/data/2.5/weather";
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY || "";
const weatherCache = new Map();

const midpoint = (from, to) => ({
  latitude: (from.latitude + to.latitude) / 2,
  longitude: (from.longitude + to.longitude) / 2,
});

const weatherMainPenalty = main => {
  const key = String(main || "").toLowerCase();
  if (key === "thunderstorm") return 1.0;
  if (key === "drizzle") return 0.55;
  if (key === "rain") return 0.75;
  if (key === "snow") return 0.85;
  if (key === "clear") return 0.05;
  if (key === "clouds") return 0.2;
  return 0.35; // atmosphere/unknown
};

const cacheKeyForPoint = point =>
  `${point.latitude.toFixed(2)},${point.longitude.toFixed(2)}`;

const fetchWeatherPenalty = async point => {
  if (!OPENWEATHER_KEY) return 0;

  const cacheKey = cacheKeyForPoint(point);
  const hit = weatherCache.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.ts < 10 * 60 * 1000) return hit.value; // 10 min cache

  try {
    const response = await axios.get(OPENWEATHER_ENDPOINT, {
      params: {
        lat: point.latitude,
        lon: point.longitude,
        appid: OPENWEATHER_KEY,
        units: "metric",
      },
      timeout: 9000,
    });

    const main = response.data?.weather?.[0]?.main;
    const base = weatherMainPenalty(main);
    const wind = Number(response.data?.wind?.speed ?? 0);
    const visibility = Number(response.data?.visibility ?? 10000);

    const windPenalty = clamp((wind - 8) / 20, 0, 0.35);
    const visibilityPenalty = clamp((8000 - visibility) / 8000, 0, 0.3);

    const value = Number(clamp(base + windPenalty + visibilityPenalty, 0, 1).toFixed(3));
    weatherCache.set(cacheKey, { value, ts: now });
    return value;
  } catch {
    return 0.15; // neutral fallback
  }
};

const ORS_DIRECTIONS_ENDPOINT =
  "https://api.openrouteservice.org/v2/directions/driving-car?geometry_format=geojson";
const ORS_KEY = process.env.OPENROUTESERVICE_API_KEY || process.env.ORS_API_KEY || "";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getTrafficHourMultiplier = (date = new Date()) => {
  const hour = date.getHours();
  if ((hour >= 7 && hour < 10) || (hour >= 16 && hour < 20)) return 1.25;
  if (hour >= 10 && hour < 16) return 1.05;
  return 0.9;
};

const computeTrafficPenalty = ({ distanceKm, durationMinutes, date = new Date() }) => {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMinutes)) return 0;
  if (distanceKm <= 0 || durationMinutes <= 0) return 0;

  const avgSpeedKmh = distanceKm / (durationMinutes / 60);
  const freeFlowKmh = distanceKm <= 4 ? 30 : distanceKm <= 18 ? 42 : 60;
  const basePenalty = clamp((freeFlowKmh - avgSpeedKmh) / freeFlowKmh, 0, 1);
  return Number(clamp(basePenalty * getTrafficHourMultiplier(date), 0, 1).toFixed(3));
};

const toFiniteNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRouteGeometry = geometry => {
  if (!geometry) return [];
  if (Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
  }
  if (typeof geometry === "string") {
    return polyline.decode(geometry, 5).map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));
  }
  return [];
};

const toRad = deg => (deg * Math.PI) / 180;

const haversineKm = (from, to) => {
  const R = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a =
    sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fallbackLegCandidate = (from, to, routeIndex = 0, weatherPenalty = 0) => {
  const distanceKm = haversineKm(from, to);
  const durationMinutes = distanceKm > 0 ? (distanceKm / 38) * 60 : 0;
  const trafficPenalty = computeTrafficPenalty({ distanceKm, durationMinutes });
  return {
    route_index: routeIndex,
    route_geometry: [
      { latitude: from.latitude, longitude: from.longitude },
      { latitude: to.latitude, longitude: to.longitude },
    ],
    weather_penalty: Number(weatherPenalty.toFixed(3)),
    distance_km: Number(distanceKm.toFixed(3)),
    duration_minutes: Number(durationMinutes.toFixed(2)),
    traffic_penalty: trafficPenalty,
    efficiency_score: Number(
      (distanceKm > 0 && durationMinutes > 0 ? distanceKm / durationMinutes : 0).toFixed(4)
    ),
    final_score: 0,
    source: "fallback",
  };
};

const scoreRoutes = routes => {
  if (!routes.length) return [];
  const distances = routes.map(route => route.distance_km ?? 0);
  const durations = routes.map(route => route.duration_minutes ?? 0);
  const traffics = routes.map(route => route.traffic_penalty ?? 0);
  const weathers = routes.map(route => route.weather_penalty ?? 0);
  const efficiencies = routes.map(route => route.efficiency_score ?? 0);

  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const minTraffic = Math.min(...traffics);
  const maxTraffic = Math.max(...traffics);
  const minWeather = Math.min(...weathers);
  const maxWeather = Math.max(...weathers);
  const minEfficiency = Math.min(...efficiencies);
  const maxEfficiency = Math.max(...efficiencies);

  const normalize = (value, min, max) => {
    if (!Number.isFinite(value)) return 0;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0;
    return clamp((value - min) / (max - min), 0, 1);
  };

  return routes
    .map(route => {
      const distanceScore = normalize(route.distance_km ?? 0, minDistance, maxDistance);
      const durationScore = normalize(route.duration_minutes ?? 0, minDuration, maxDuration);
      const trafficScore = normalize(route.traffic_penalty ?? 0, minTraffic, maxTraffic);
      const weatherScore = normalize(route.weather_penalty ?? 0, minWeather, maxWeather);
      const efficiencyNormalized = normalize(
        route.efficiency_score ?? 0,
        minEfficiency,
        maxEfficiency
      );
      const efficiencyPenalty = 1 - efficiencyNormalized;
      const finalScore =
        durationScore * 0.35 +
        distanceScore * 0.2 +
        trafficScore * 0.2 +
        weatherScore * 0.15 +
        efficiencyPenalty * 0.1;

      return {
        ...route,
        final_score: Number(finalScore.toFixed(4)),
      };
    })
    .sort((a, b) => a.final_score - b.final_score);
};

const fetchLegCandidates = async (from, to) => {
  const legWeatherPenalty = await fetchWeatherPenalty(midpoint(from, to));
  const fallback = [fallbackLegCandidate(from, to, 0, legWeatherPenalty)];
  if (!ORS_KEY) return fallback;

  const parseOrsRoutes = routes => {
    const parsed = routes.map((route, index) => {
      const distanceKm = Number(route.summary?.distance ?? 0) / 1000;
      const durationMinutes = Number(route.summary?.duration ?? 0) / 60;
      const trafficPenalty = computeTrafficPenalty({ distanceKm, durationMinutes });
      const efficiencyScore =
        distanceKm > 0 && durationMinutes > 0 ? distanceKm / durationMinutes : 0;

      return {
        route_index: index,
        route_geometry: parseRouteGeometry(route.geometry),
        distance_km: Number(distanceKm.toFixed(3)),
        duration_minutes: Number(durationMinutes.toFixed(2)),
        traffic_penalty: Number(trafficPenalty.toFixed(3)),
        weather_penalty: Number(legWeatherPenalty.toFixed(3)),
        efficiency_score: Number(efficiencyScore.toFixed(4)),
        final_score: 0,
        source: "ors",
      };
    });

    return scoreRoutes(parsed);
  };

  const requestRoutes = async radius =>
    axios.post(
      ORS_DIRECTIONS_ENDPOINT,
      {
        coordinates: [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ],
        radiuses: [radius, radius],
        instructions: false,
        alternative_routes: {
          target_count: 3,
          share_factor: 0.6,
          weight_factor: 1.4,
        },
      },
      {
        headers: {
          Authorization: ORS_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 25000,
      }
    );

  try {
    const response = await requestRoutes(3000);
    const routes = Array.isArray(response.data?.routes) ? response.data.routes : [];
    if (!routes.length) return fallback;
    return parseOrsRoutes(routes);
  } catch (error) {
    if (error.response?.data?.error?.code === 2010) {
      try {
        const response = await requestRoutes(10000);
        const routes = Array.isArray(response.data?.routes) ? response.data.routes : [];
        if (!routes.length) return fallback;
        return parseOrsRoutes(routes);
      } catch (innerError) {
        console.warn("ORS leg routing fallback failed:", innerError.message);
        return fallback;
      }
    }
    console.warn("ORS leg routing failed:", error.message);
    return fallback;
  }
};

const mergeGeometries = segments => {
  const merged = [];
  segments.forEach((segment, index) => {
    if (!Array.isArray(segment) || !segment.length) return;
    if (index === 0) {
      merged.push(...segment);
      return;
    }
    merged.push(...segment.slice(1));
  });
  return merged;
};

const buildVariant = (legCandidates, selection, routeIndex) => {
  let totalDistance = 0;
  let totalDuration = 0;
  let totalTraffic = 0;
  let totalWeather = 0;
  let trafficCount = 0;
  let weatherCount = 0;
  const segments = [];

  for (let i = 0; i < legCandidates.length; i += 1) {
    const optionIndex = selection[i] ?? 0;
    const chosen = legCandidates[i][optionIndex] ?? legCandidates[i][0];
    if (!chosen) continue;

    totalDistance += Number(chosen.distance_km ?? 0);
    totalDuration += Number(chosen.duration_minutes ?? 0);
    totalTraffic += Number(chosen.traffic_penalty ?? 0);
    totalWeather += Number(chosen.weather_penalty ?? 0);
    trafficCount += 1;
    weatherCount += 1;
    segments.push(chosen.route_geometry ?? []);
  }

  const avgTraffic = trafficCount > 0 ? totalTraffic / trafficCount : 0;
  const avgWeather = weatherCount > 0 ? totalWeather / weatherCount : 0;
  const efficiency =
    totalDistance > 0 && totalDuration > 0 ? totalDistance / totalDuration : 0;

  return {
    route_index: routeIndex,
    selection,
    route_geometry: mergeGeometries(segments),
    distance_km: Number(totalDistance.toFixed(3)),
    duration_minutes: Number(totalDuration.toFixed(2)),
    traffic_penalty: Number(avgTraffic.toFixed(3)),
    weather_penalty: Number(avgWeather.toFixed(3)),
    efficiency_score: Number(efficiency.toFixed(4)),
    final_score: 0,
  };
};

const buildVariants = legCandidates => {
  if (!legCandidates.length) return [];
  const baseSelection = legCandidates.map(() => 0);
  const selectionKeys = new Set();
  const selections = [];

  const pushSelection = selection => {
    const key = selection.join("-");
    if (selectionKeys.has(key)) return;
    selectionKeys.add(key);
    selections.push(selection);
  };

  pushSelection(baseSelection);

  for (let legIndex = 0; legIndex < legCandidates.length; legIndex += 1) {
    const options = legCandidates[legIndex];
    for (let optionIndex = 1; optionIndex < options.length; optionIndex += 1) {
      const nextSelection = baseSelection.slice();
      nextSelection[legIndex] = optionIndex;
      pushSelection(nextSelection);
      if (selections.length >= 6) break;
    }
    if (selections.length >= 6) break;
  }

  const rawVariants = selections.map((selection, index) =>
    buildVariant(legCandidates, selection, index)
  );

  return scoreRoutes(rawVariants).map((variant, index) => ({
    ...variant,
    route_index: index,
  }));
};

export const previewItinerary = async (req, res, next) => {
  try {
    const accountId = req.user?.account_id;
    if (!accountId) {
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }

    const tourist = await TouristProfile.findOne({ account_id: accountId }).lean();
    if (!tourist) {
      const err = new Error("Tourist profile not found");
      err.status = 404;
      throw err;
    }

    const { stops = [], origin } = req.body;
    if (!Array.isArray(stops) || !stops.length) {
      return res.json({
        orderedStops: [],
        ordered_stops: [],
        summary: {
          distance_km: null,
          duration_minutes: null,
          traffic_penalty: null,
          weather_penalty: null,
          efficiency_score: null,
          final_score: null,
        },
        route_geometry: [],
        alternate_routes: [],
        origin: null,
      });
    }

    const normalizedStops = stops.map((stop, index) => {
      const latitude = toFiniteNumber(stop.latitude);
      const longitude = toFiniteNumber(stop.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const err = new Error(
          `Missing coordinates for stop ${stop.business_establishment_id ?? index + 1}`
        );
        err.status = 400;
        throw err;
      }

      return {
        ...stop,
        latitude,
        longitude,
        order: index,
      };
    });

    const originPoint =
      Number.isFinite(toFiniteNumber(origin?.latitude)) &&
      Number.isFinite(toFiniteNumber(origin?.longitude))
        ? {
            latitude: Number(origin.latitude),
            longitude: Number(origin.longitude),
          }
        : null;

    // Preserve stop sequence from the tourist's selected order.
    const orderedStops = normalizedStops.map((stop, index) => ({
      ...stop,
      order: index,
    }));

    const routePoints = originPoint ? [originPoint, ...orderedStops] : orderedStops;
    if (routePoints.length < 2) {
      return res.json({
        orderedStops,
        ordered_stops: orderedStops,
        summary: {
          distance_km: 0,
          duration_minutes: 0,
          traffic_penalty: 0,
          weather_penalty: 0,
          efficiency_score: 0,
          final_score: 0,
        },
        route_geometry: [],
        alternate_routes: [],
        origin: originPoint,
      });
    }

    const legPromises = [];
    for (let i = 0; i < routePoints.length - 1; i += 1) {
      legPromises.push(fetchLegCandidates(routePoints[i], routePoints[i + 1]));
    }
    const legCandidates = await Promise.all(legPromises);

    const variants = buildVariants(legCandidates);
    const best = variants[0] ?? null;
    const alternates = variants.slice(1).map(route => ({
      route_index: route.route_index,
      route_geometry: route.route_geometry,
      summary: {
        distance_km: route.distance_km,
        duration_minutes: route.duration_minutes,
        traffic_penalty: route.traffic_penalty,
        weather_penalty: route.weather_penalty,
        efficiency_score: route.efficiency_score,
        final_score: route.final_score,
      },
    }));

    const summary = best
      ? {
          distance_km: best.distance_km,
          duration_minutes: best.duration_minutes,
          traffic_penalty: best.traffic_penalty,
          weather_penalty: best.weather_penalty,
          efficiency_score: best.efficiency_score,
          final_score: best.final_score,
        }
      : {
          distance_km: null,
          duration_minutes: null,
          traffic_penalty: null,
          weather_penalty: null,
          efficiency_score: null,
          final_score: null,
        };

    return res.json({
      orderedStops,
      ordered_stops: orderedStops,
      summary,
      route_geometry: best?.route_geometry ?? [],
      alternate_routes: alternates,
      origin: originPoint,
    });
  } catch (err) {
    next(err);
  }
};
