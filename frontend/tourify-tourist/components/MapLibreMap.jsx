import MapView, { Marker, Polyline } from 'react-native-maps';
export { MapView, Marker, Polyline };
export default MapView;

// import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
// import { StyleSheet, View } from 'react-native';
// import {
//   MapView as MLMapView,
//   Camera,
//   PointAnnotation,
//   ShapeSource,
//   LineLayer,
//   UserLocation,
// } from '@maplibre/maplibre-react-native';

// const DEFAULT_STYLE_URL =
//   process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty';

// let markerCounter = 0;
// let polylineCounter = 0;

// const toLngLat = coordinate => [coordinate.longitude, coordinate.latitude];

// const buildBoundsFromRegion = region => {
//   if (!region) return null;
//   const latDelta = region.latitudeDelta ?? 0.1;
//   const lngDelta = region.longitudeDelta ?? 0.1;
//   const halfLat = latDelta / 2;
//   const halfLng = lngDelta / 2;
//   return {
//     ne: [region.longitude + halfLng, region.latitude + halfLat],
//     sw: [region.longitude - halfLng, region.latitude - halfLat],
//   };
// };

// const toPaddingArray = edgePadding => {
//   if (!edgePadding) return undefined;
//   const top = edgePadding.top ?? 0;
//   const right = edgePadding.right ?? 0;
//   const bottom = edgePadding.bottom ?? 0;
//   const left = edgePadding.left ?? 0;
//   return [top, right, bottom, left];
// };

// const MapView = forwardRef((props, ref) => {
//   const {
//     children,
//     style,
//     mapStyle = DEFAULT_STYLE_URL,
//     initialRegion,
//     region,
//     onRegionChangeComplete,
//     showsCompass,
//     showsUserLocation,
//     zoomControlEnabled,
//     showsPointsOfInterest,
//     toolbarEnabled,
//     ...rest
//   } = props;

//   const mapRef = useRef(null);
//   const cameraRef = useRef(null);
//   const didSetInitial = useRef(false);

//   const fitBounds = (bounds, options = {}) => {
//     if (!cameraRef.current || !bounds) return;
//     const padding = toPaddingArray(options.edgePadding);
//     const duration = options.animated === false ? 0 : options.duration ?? 800;
//     cameraRef.current.fitBounds(bounds.ne, bounds.sw, padding, duration);
//   };

//   const fitToCoordinates = (coords, options = {}) => {
//     if (!coords?.length) return;
//     if (coords.length === 1) {
//       cameraRef.current?.setCamera({
//         centerCoordinate: toLngLat(coords[0]),
//         zoomLevel: 13,
//         animationDuration: options.animated === false ? 0 : options.duration ?? 800,
//       });
//       return;
//     }
//     const lats = coords.map(c => c.latitude);
//     const lngs = coords.map(c => c.longitude);
//     fitBounds(
//       { ne: [Math.max(...lngs), Math.max(...lats)], sw: [Math.min(...lngs), Math.min(...lats)] },
//       options
//     );
//   };

//   const animateToRegion = (nextRegion, duration = 800) => {
//     const bounds = buildBoundsFromRegion(nextRegion);
//     if (bounds) fitBounds(bounds, { animated: true, duration });
//   };

//   const animateCamera = (camera = {}) => {
//     const center = camera.center
//       ? [camera.center.longitude, camera.center.latitude]
//       : camera.centerCoordinate;
//     cameraRef.current?.setCamera({
//       centerCoordinate: center,
//       zoomLevel: camera.zoom ?? camera.zoomLevel,
//       heading: camera.heading,
//       pitch: camera.pitch,
//       animationDuration: camera.duration ?? 800,
//     });
//   };

//   useImperativeHandle(ref, () => ({
//     fitToCoordinates,
//     animateToRegion,
//     animateCamera,
//   }));

//   useEffect(() => {
//     if (didSetInitial.current || !initialRegion) return;
//     didSetInitial.current = true;
//     const bounds = buildBoundsFromRegion(initialRegion);
//     if (bounds) {
//       setTimeout(() => fitBounds(bounds, { animated: false }), 0);
//     }
//   }, [initialRegion]);

//   useEffect(() => {
//     if (!region) return;
//     const bounds = buildBoundsFromRegion(region);
//     if (bounds) fitBounds(bounds, { animated: false });
//   }, [region]);

//   const handleRegionDidChange = async () => {
//     if (!onRegionChangeComplete || !mapRef.current) return;
//     try {
//       const bounds = await mapRef.current.getVisibleBounds();
//       if (!bounds || bounds.length < 2) return;
//       const [ne, sw] = bounds;
//       onRegionChangeComplete({
//         latitude: (ne[1] + sw[1]) / 2,
//         longitude: (ne[0] + sw[0]) / 2,
//         latitudeDelta: Math.abs(ne[1] - sw[1]),
//         longitudeDelta: Math.abs(ne[0] - sw[0]),
//       });
//     } catch {
//       // ignore
//     }
//   };

//   return (
//     <MLMapView
//       ref={mapRef}
//       style={style}
//       mapStyle={mapStyle}
//       compassEnabled={showsCompass}
//       onRegionDidChange={handleRegionDidChange}
//       {...rest}
//     >
//       <Camera ref={cameraRef} />
//       {showsUserLocation ? <UserLocation visible /> : null}
//       {children}
//     </MLMapView>
//   );
// });

// const Marker = ({
//   coordinate,
//   title,
//   description,
//   pinColor,
//   children,
//   onPress,
//   onCalloutPress,
// }) => {
//   if (!coordinate) return null;
//   const idRef = useRef(`marker-${markerCounter++}`);
//   const handleSelect = () => {
//     onPress?.();
//     onCalloutPress?.();
//   };

//   return (
//     <PointAnnotation
//       id={idRef.current}
//       coordinate={toLngLat(coordinate)}
//       title={title}
//       snippet={description}
//       onSelected={handleSelect}
//     >
//       {children || (
//         <View style={[styles.defaultPin, pinColor ? { backgroundColor: pinColor } : null]} />
//       )}
//     </PointAnnotation>
//   );
// };

// const Polyline = ({
//   coordinates,
//   strokeColor = '#111827',
//   strokeWidth = 3,
//   lineCap = 'round',
//   lineJoin = 'round',
// }) => {
//   const idRef = useRef(`polyline-${polylineCounter++}`);
//   const shape = useMemo(() => {
//     if (!coordinates || coordinates.length < 2) return null;
//     return {
//       type: 'Feature',
//       geometry: {
//         type: 'LineString',
//         coordinates: coordinates.map(coord => [coord.longitude, coord.latitude]),
//       },
//     };
//   }, [coordinates]);

//   if (!shape) return null;

//   return (
//     <ShapeSource id={`${idRef.current}-source`} shape={shape}>
//       <LineLayer
//         id={idRef.current}
//         style={{ lineColor: strokeColor, lineWidth: strokeWidth, lineCap, lineJoin }}
//       />
//     </ShapeSource>
//   );
// };

// export { MapView, Marker, Polyline };
// export default MapView;

// const styles = StyleSheet.create({
//   defaultPin: {
//     width: 18,
//     height: 18,
//     borderRadius: 9,
//     backgroundColor: '#3b82f6',
//     borderWidth: 2,
//     borderColor: '#fff',
//   },
// });

