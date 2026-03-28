const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRad = (deg) => (deg * Math.PI) / 180;

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

const normalizeStopId = (stop, fallbackIndex) =>
  String(
    stop?.business_establishment_id ??
      stop?.businessEstablishment_id ??
      stop?.id ??
      `stop-${fallbackIndex}`
  );

const DEFAULT_OPTIONS = {
  alpha: 1.2,
  beta: 3.4,
  evaporation: 0.42,
  ants: 28,
  iterations: 36,
  eliteCount: 4,
  q: 1,
  maxAlternates: 3,
  crowdPenaltyWeight: 0.18,
  ratingRewardWeight: 0.08,
  explorationChance: 0.03,
};

const buildStopMeta = (stops, options) => {
  const maxRatingCount =
    Math.max(
      ...stops.map((stop) => toFiniteNumber(stop?.rating_count) ?? 0),
      0
    ) || 0;

  return stops.map((stop, index) => {
    const ratingCount = toFiniteNumber(stop?.rating_count) ?? 0;
    const ratingAvg = clamp((toFiniteNumber(stop?.rating_avg) ?? 0) / 5, 0, 1);
    const popularity = maxRatingCount > 0 ? ratingCount / maxRatingCount : 0;
    const destinationPenalty = clamp(
      1 +
        popularity * options.crowdPenaltyWeight -
        ratingAvg * options.ratingRewardWeight,
      0.75,
      1.2
    );

    return {
      index,
      id: normalizeStopId(stop, index),
      destinationPenalty,
    };
  });
};

const buildCostModel = ({ origin, stops, stopMeta }) => {
  const originCosts = stopMeta.map((meta, index) => {
    const distance = origin ? haversineKm(origin, stops[index]) : 0;
    const weighted = Math.max(distance * meta.destinationPenalty, 0.001);
    return {
      weighted,
      distance,
    };
  });

  const edgeCosts = stopMeta.map((fromMeta, fromIndex) =>
    stopMeta.map((toMeta, toIndex) => {
      if (fromIndex === toIndex) {
        return { weighted: Number.POSITIVE_INFINITY, distance: 0 };
      }
      const distance = haversineKm(stops[fromIndex], stops[toIndex]);
      const weighted = Math.max(distance * toMeta.destinationPenalty, 0.001);
      return {
        weighted,
        distance,
      };
    })
  );

  return { originCosts, edgeCosts };
};

const initializePheromone = (count) => {
  const start = Array.from({ length: count }, () => 1);
  const edges = Array.from({ length: count }, () =>
    Array.from({ length: count }, () => 1)
  );
  return { start, edges };
};

const pickNextStop = ({ unvisited, desirabilities, explorationChance }) => {
  if (!unvisited.length) return null;

  if (Math.random() < explorationChance) {
    const randomIndex = Math.floor(Math.random() * unvisited.length);
    return unvisited[randomIndex];
  }

  const total = desirabilities.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return unvisited[Math.floor(Math.random() * unvisited.length)];
  }

  let threshold = Math.random() * total;
  for (let i = 0; i < unvisited.length; i += 1) {
    threshold -= desirabilities[i];
    if (threshold <= 0) return unvisited[i];
  }

  return unvisited[unvisited.length - 1];
};

const constructAntRoute = ({ stopCount, pheromone, model, options }) => {
  const unvisited = Array.from({ length: stopCount }, (_, index) => index);
  const order = [];
  let cost = 0;
  let pureDistance = 0;
  let current = null;

  while (unvisited.length) {
    const desirabilities = unvisited.map((candidateIndex) => {
      const edge =
        current === null
          ? model.originCosts[candidateIndex]
          : model.edgeCosts[current][candidateIndex];
      const tau =
        current === null
          ? pheromone.start[candidateIndex]
          : pheromone.edges[current][candidateIndex];
      const eta = 1 / Math.max(edge.weighted, 0.001);
      return Math.pow(Math.max(tau, 1e-6), options.alpha) * Math.pow(eta, options.beta);
    });

    const next = pickNextStop({
      unvisited,
      desirabilities,
      explorationChance: options.explorationChance,
    });

    const nextEdge =
      current === null ? model.originCosts[next] : model.edgeCosts[current][next];
    cost += nextEdge.weighted;
    pureDistance += nextEdge.distance;
    order.push(next);
    current = next;

    const removeIndex = unvisited.indexOf(next);
    if (removeIndex >= 0) unvisited.splice(removeIndex, 1);
  }

  return {
    order,
    cost: Number(cost.toFixed(6)),
    distance_km: Number(pureDistance.toFixed(3)),
  };
};

const routeKey = (order, stopMeta) =>
  order.map((index) => stopMeta[index]?.id ?? String(index)).join(">");

const depositPheromone = ({ pheromone, routes, options }) => {
  const retention = 1 - options.evaporation;

  pheromone.start.forEach((value, index) => {
    pheromone.start[index] = Math.max(value * retention, 1e-6);
  });

  pheromone.edges.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (rowIndex === columnIndex) return;
      pheromone.edges[rowIndex][columnIndex] = Math.max(value * retention, 1e-6);
    });
  });

  routes.forEach((route, rank) => {
    const deposit = (options.q / Math.max(route.cost, 0.001)) * (1 + rank * 0.15);
    const [first, ...rest] = route.order;
    if (first == null) return;

    pheromone.start[first] += deposit;

    let previous = first;
    rest.forEach((current) => {
      pheromone.edges[previous][current] += deposit;
      previous = current;
    });
  });
};

export const optimizeRouteOrderWithAco = ({
  origin = null,
  stops = [],
  options = {},
}) => {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (!Array.isArray(stops) || stops.length <= 1) {
    const singleStops = (stops ?? []).map((stop, index) => ({
      ...stop,
      order: index,
    }));
    return {
      orderedStops: singleStops,
      alternates: [],
      meta: {
        method: "aco",
        ants: 0,
        iterations: 0,
      },
    };
  }

  const stopMeta = buildStopMeta(stops, mergedOptions);
  const model = buildCostModel({ origin, stops, stopMeta });
  const pheromone = initializePheromone(stops.length);
  const candidateRoutes = new Map();

  // Keep the current order as a baseline candidate for comparison.
  const baselineOrder = Array.from({ length: stops.length }, (_, index) => index);
  candidateRoutes.set(routeKey(baselineOrder, stopMeta), {
    order: baselineOrder,
    cost: baselineOrder.reduce((total, stopIndex, sequenceIndex) => {
      const edge =
        sequenceIndex === 0
          ? model.originCosts[stopIndex]
          : model.edgeCosts[baselineOrder[sequenceIndex - 1]][stopIndex];
      return total + edge.weighted;
    }, 0),
    distance_km: baselineOrder.reduce((total, stopIndex, sequenceIndex) => {
      const edge =
        sequenceIndex === 0
          ? model.originCosts[stopIndex]
          : model.edgeCosts[baselineOrder[sequenceIndex - 1]][stopIndex];
      return total + edge.distance;
    }, 0),
  });

  const antCount = Math.max(12, Math.min(48, mergedOptions.ants, stops.length * 8));
  const iterations = Math.max(12, Math.min(72, mergedOptions.iterations));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const iterationRoutes = [];

    for (let ant = 0; ant < antCount; ant += 1) {
      const route = constructAntRoute({
        stopCount: stops.length,
        pheromone,
        model,
        options: mergedOptions,
      });
      const key = routeKey(route.order, stopMeta);
      const existing = candidateRoutes.get(key);
      if (!existing || route.cost < existing.cost) {
        candidateRoutes.set(key, route);
      }
      iterationRoutes.push(route);
    }

    const eliteRoutes = iterationRoutes
      .sort((a, b) => a.cost - b.cost)
      .slice(0, Math.min(mergedOptions.eliteCount, iterationRoutes.length));

    depositPheromone({
      pheromone,
      routes: eliteRoutes,
      options: mergedOptions,
    });
  }

  const rankedRoutes = Array.from(candidateRoutes.values())
    .sort((a, b) => a.cost - b.cost)
    .slice(0, Math.max(1, mergedOptions.maxAlternates));

  const toOrderedStops = (route) =>
    route.order.map((stopIndex, order) => ({
      ...stops[stopIndex],
      order,
      aco_order: order,
      aco_weighted_cost: Number(route.cost.toFixed(4)),
      aco_distance_km: route.distance_km,
    }));

  return {
    orderedStops: rankedRoutes[0] ? toOrderedStops(rankedRoutes[0]) : stops,
    alternates: rankedRoutes.slice(1).map((route) => ({
      orderedStops: toOrderedStops(route),
      aco_weighted_cost: Number(route.cost.toFixed(4)),
      aco_distance_km: route.distance_km,
    })),
    meta: {
      method: "aco",
      ants: antCount,
      iterations,
      alpha: mergedOptions.alpha,
      beta: mergedOptions.beta,
      evaporation: mergedOptions.evaporation,
      route_count: rankedRoutes.length,
    },
  };
};

export default optimizeRouteOrderWithAco;
