// Dark Google Maps style — tuned to match BroncoPath's #0d1117 dark theme.
// Applied via MapView customMapStyle prop (PROVIDER_GOOGLE only).

export const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#161b22' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#7d8590' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0d1117' }] },

  { featureType: 'road',          elementType: 'geometry',        stylers: [{ color: '#21262d' }] },
  { featureType: 'road',          elementType: 'geometry.stroke', stylers: [{ color: '#30363d' }] },
  { featureType: 'road.highway',  elementType: 'geometry',        stylers: [{ color: '#30363d' }] },
  { featureType: 'road.highway',  elementType: 'geometry.stroke', stylers: [{ color: '#3d444d' }] },
  { featureType: 'road.highway',  elementType: 'labels.text.fill',stylers: [{ color: '#e6edf3' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill',stylers: [{ color: '#7d8590' }] },

  { featureType: 'water',             elementType: 'geometry',         stylers: [{ color: '#0d1117' }] },
  { featureType: 'water',             elementType: 'labels.text.fill', stylers: [{ color: '#4d5566' }] },
  { featureType: 'landscape',         elementType: 'geometry',         stylers: [{ color: '#1c2128' }] },
  { featureType: 'landscape.natural', elementType: 'geometry',         stylers: [{ color: '#161b22' }] },
  { featureType: 'poi',               elementType: 'geometry',         stylers: [{ color: '#1c2128' }] },
  { featureType: 'poi',               elementType: 'labels.text.fill', stylers: [{ color: '#7d8590' }] },
  { featureType: 'poi.park',          elementType: 'geometry.fill',    stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'poi.school',        elementType: 'geometry.fill',    stylers: [{ color: '#1c2535' }] },
  { featureType: 'transit',           elementType: 'geometry',         stylers: [{ color: '#1c2128' }] },
  { featureType: 'transit.station',   elementType: 'labels.text.fill', stylers: [{ color: '#7d8590' }] },

  { featureType: 'administrative',            elementType: 'geometry.stroke',  stylers: [{ color: '#30363d' }] },
  { featureType: 'administrative.land_parcel',elementType: 'labels.text.fill', stylers: [{ color: '#7d8590' }] },
  { featureType: 'administrative.neighborhood',elementType: 'labels.text.fill',stylers: [{ color: '#4d5566' }] },
];