import MapboxGL from '@rnmapbox/maps';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? 'ZC6E56zBHhCOAuR5Zasp');
MapboxGL.setTelemetryEnabled(false);

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const regionToZoom = delta => clamp(Math.log2(360 / (delta || 1)), 3, 18);
const zoomToDelta = zoom => 360 / Math.pow(2, zoom ?? 12);

export const MapView = forwardRef(
  (
    {
      initialRegion = { latitude: 9.75, longitude: 124.1, latitudeDelta: 0.6, longitudeDelta: 0.6 },
      children,
      style,
      onRegionChangeComplete,
      showsUserLocation,
      showsCompass = true,
      rotateEnabled = true,
      pitchEnabled = true,
      scrollEnabled = true,
      zoomEnabled = true,
      styleURL,
      ...rest
    },
    ref
  ) => {
    const cameraRef = useRef(null);

    const startZoom = regionToZoom(initialRegion.latitudeDelta ?? 0.6);

    const handleRegionChange = evt => {
      if (!onRegionChangeComplete) return;
      const [lng, lat] = evt?.geometry?.coordinates ?? [];
      const zoom = evt?.properties?.zoomLevel ?? evt?.properties?.zoom ?? startZoom;
      const delta = zoomToDelta(zoom);
      onRegionChangeComplete({
        latitude: lat ?? initialRegion.latitude,
        longitude: lng ?? initialRegion.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      });
    };

    useImperativeHandle(ref, () => ({
      animateToRegion: (region, duration = 600) => {
        if (!region) return;
        cameraRef.current?.setCamera({
          centerCoordinate: [region.longitude ?? initialRegion.longitude, region.latitude ?? initialRegion.latitude],
          zoomLevel: regionToZoom(region.latitudeDelta ?? initialRegion.latitudeDelta),
          duration,
        });
      },
      animateCamera: ({ center, zoom, duration = 600 }) =>
        cameraRef.current?.setCamera({
          centerCoordinate: center ? [center.longitude, center.latitude] : undefined,
          zoomLevel: zoom ?? undefined,
          duration,
        }),
      fitToCoordinates: (coords = [], { edgePadding = {}, animated = true } = {}) => {
        if (!coords.length) return;
        const lats = coords.map(c => c.latitude);
        const lngs = coords.map(c => c.longitude);
        const ne = [Math.max(...lngs), Math.max(...lats)];
        const sw = [Math.min(...lngs), Math.min(...lats)];
        const lr = ((edgePadding.left ?? 0) + (edgePadding.right ?? 0)) / 2;
        const tb = ((edgePadding.top ?? 0) + (edgePadding.bottom ?? 0)) / 2;
        cameraRef.current?.fitBounds(ne, sw, lr || 24, tb || 24, animated ? 600 : 0);
      },
    }));

    return (
      <MapboxGL.MapView
        style={style}
        styleURL={styleURL ?? MAP_STYLE_URL}
        compassEnabled={showsCompass}
        rotateEnabled={rotateEnabled}
        pitchEnabled={pitchEnabled}
        scrollEnabled={scrollEnabled}
        zoomEnabled={zoomEnabled}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionDidChange={handleRegionChange}
        {...rest}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={[initialRegion.longitude, initialRegion.latitude]}
          zoomLevel={startZoom}
        />
        {showsUserLocation ? <MapboxGL.UserLocation visible /> : null}
        {children}
      </MapboxGL.MapView>
    );
  }
);

export const Marker = ({ id, coordinate, title, description, pinColor = '#6c5ce7', onPress, children }) => {
  const annotationId =
    id ??
    `${coordinate?.latitude ?? 'lat'}-${coordinate?.longitude ?? 'lng'}-${Math.random()
      .toString(16)
      .slice(2)}`;
  if (!coordinate) return null;
  return (
    <MapboxGL.PointAnnotation
      id={annotationId}
      coordinate={[coordinate.longitude, coordinate.latitude]}
      onSelected={onPress}
    >
      {children ?? <View style={[styles.pin, { backgroundColor: pinColor }]} />}
      {title ? (
        <MapboxGL.Callout title={title}>
          {description ? <Text style={styles.calloutText}>{description}</Text> : null}
        </MapboxGL.Callout>
      ) : null}
    </MapboxGL.PointAnnotation>
  );
};

export const Polyline = ({
  coordinates = [],
  strokeColor = '#2563eb',
  strokeWidth = 4,
  lineCap = 'round',
  lineJoin = 'round',
}) => {
  const geojson = useMemo(
    () => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
          .filter(c => Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude))
          .map(c => [c.longitude, c.latitude]),
      },
    }),
    [coordinates]
  );

  const sourceId = useMemo(
    () => `line-src-${Math.random().toString(16).slice(2)}`,
    []
  );
  const layerId = useMemo(
    () => `line-lyr-${Math.random().toString(16).slice(2)}`,
    []
  );

  if (!geojson.geometry.coordinates.length) return null;

  return (
    <MapboxGL.ShapeSource id={sourceId} shape={geojson}>
      <MapboxGL.LineLayer
        id={layerId}
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
          lineCap: lineCap === 'round' ? 'round' : 'butt',
          lineJoin: lineJoin === 'round' ? 'round' : 'bevel',
        }}
      />
    </MapboxGL.ShapeSource>
  );
};

const styles = StyleSheet.create({
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
  },
  calloutText: { color: '#111827', paddingVertical: 4 },
});
