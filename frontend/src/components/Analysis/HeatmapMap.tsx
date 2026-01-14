


import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import cityCoordinates from './cityCoordinates';

interface HeatmapMapProps {
  edaData: any;
  width?: number | string;
  height?: number | string;
}

const HeatmapLayer = ({ points }: { points: Array<[number, number, number]> }) => {
  const map = useMap();
  React.useEffect(() => {
    if (!map) return;
    let heatLayer: any = null;
    let markerGroup: L.LayerGroup | null = null;

    if (points.length > 0) {
      // Compute max count to normalize heat intensity
      const counts = points.map(p => p[2] as number);
      const maxCount = Math.max(...counts, 1);

      // Create heat layer with gradient and max normalization
      heatLayer = (L as any).heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: maxCount,
        gradient: { 0.2: 'blue', 0.4: 'lime', 0.6: 'orange', 0.8: 'red' }
      }).addTo(map);

      // Also add visible circle markers so you can confirm where points are
      markerGroup = L.layerGroup();
      points.forEach(([lat, lng, count]) => {
        const r = Math.max(6, Math.min(20, (count as number) + 4));
        const marker = L.circleMarker([lat as number, lng as number], {
          radius: r,
          color: '#ff3333',
          weight: 1,
          fillColor: '#ff6666',
          fillOpacity: 0.8,
        });
        marker.bindPopup(`Count: ${count}`);
        markerGroup!.addLayer(marker);
      });
      markerGroup.addTo(map);
    }

    return () => {
      if (heatLayer) {
        map.removeLayer(heatLayer);
      }
      if (markerGroup) {
        map.removeLayer(markerGroup);
      }
    };
  }, [map, points]);
  return null;
};

// FitBounds component: adjusts the map view so all points are visible and uses some padding
const FitBounds = ({ points }: { points: Array<[number, number, number]> }) => {
  const map = useMap();
  React.useEffect(() => {
    if (!map || !points || points.length === 0) return;
    try {
      const latlngs = points.map(p => [p[0] as number, p[1] as number]);
      const bounds = L.latLngBounds(latlngs as any);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    } catch (e) {
      // ignore
    }
  }, [map, points]);
  return null;
};

const HeatmapMap: React.FC<HeatmapMapProps> = ({ edaData, width = 900, height = 600 }) => {
  // Transform EDA data to [lat, lng, intensity] for leaflet.heat
  // Aggregate post counts per city from edaData (CSV-like structure)
  // FLOW:
  // 1. For each post, extract the city/location name from post_location.
  // 2. Aggregate the number of posts per city.
  // 3. For each city, check if it exists in cityCoordinates.
  // 4. If found, map city to [lat, lng, count] for the heatmap.
  // 5. Only cities present in cityCoordinates are shown on the map.
  const [extraCoords, setExtraCoords] = useState<Record<string, [number, number]>>(() => {
    try {
      const raw = localStorage.getItem('cityCoordinatesCache');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cityCoordinatesCache', JSON.stringify(extraCoords));
    } catch (e) {
      // ignore storage errors
    }
  }, [extraCoords]);

  const points = useMemo(() => {
    if (!edaData || !edaData.posts) return [];
    // Print all unique post_location values for mapping
    const uniqueLocations = Array.from(new Set(edaData.posts.map((p: any) => p.post_location && p.post_location.trim()).filter(Boolean))) as string[];
    // eslint-disable-next-line no-console
    console.log('Unique post_location values:', uniqueLocations);
    // Step 2: Aggregate counts per city (case-insensitive, flexible)
    const cityCounts: Record<string, number> = {};
    edaData.posts.forEach((post: any) => {
      let city = post.post_location && post.post_location.trim();
      if (city) {
        // Normalize: lowercase, remove extra spaces, ignore commas
        city = city.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    });
    // Build a normalized lookup for cityCoordinates (static + cached extra coords)
    const normalizedCoords: Record<string, [number, number]> = {};
    Object.entries(cityCoordinates).forEach(([name, coords]) => {
      const norm = name.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
      normalizedCoords[norm] = coords;
    });
    Object.entries(extraCoords).forEach(([name, coords]) => {
      const norm = name.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
      normalizedCoords[norm] = coords;
    });
    // Step 3-5: Map city names to coordinates and build heatmap points
    const mapped = Object.entries(cityCounts)
      .map(([city, count]) => {
        const coords = normalizedCoords[city];
        if (coords) {
          return [coords[0], coords[1], count, city];
        }
        // If city not found, skip
        return null;
      })
      .filter(Boolean) as [number, number, number, string][];
    // Debug log: show which cities are mapped
    if (mapped.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('No cities matched for heatmap. Check city names in data and cityCoordinates.');
    } else {
      // eslint-disable-next-line no-console
      console.log('Heatmap cities:', mapped.map(([lat, lng, count, city]) => ({ city, lat, lng, count })));
    }
    // Remove city name for leaflet.heat
    return mapped.map(([lat, lng, count]) => [lat, lng, count]) as [number, number, number][];
  }, [edaData, extraCoords]);

  // Effect: find unmatched normalized city names and geocode them using Nominatim (limited, cached)
  useEffect(() => {
    if (!edaData || !edaData.posts) return;
    const uniqueLocations = Array.from(new Set(edaData.posts.map((p: any) => p.post_location && p.post_location.trim()).filter(Boolean)));
    // Normalize function
    const normFn = (s: string) => s.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
    // Build normalized map for existing coords
    const normalizedCoords: Record<string, [number, number]> = {};
    Object.entries(cityCoordinates).forEach(([name, coords]) => {
      normalizedCoords[normFn(name)] = coords;
    });
    Object.entries(extraCoords).forEach(([name, coords]) => {
      normalizedCoords[normFn(name)] = coords;
    });
    // Find unmatched
    const unmatched = uniqueLocations
      .map((s) => ({ raw: s as string, norm: normFn(s as string) }))
      .filter((p: any) => !normalizedCoords[p.norm])
      .map((p: any) => p.raw);

    if (unmatched.length === 0) return;

    let cancelled = false;

    const geocodeOne = async (location: string) => {
      try {
        // Try raw location first (no forced country) to allow non-India cities like 'Thailand' to resolve
        const q = `${location}`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        if (!res.ok) return null;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const top = data[0];
          // Accept the top result (no country forced). Ensure lat/lon exist.
          if (top && top.lat && top.lon) {
            return [parseFloat(top.lat), parseFloat(top.lon)];
          }
        }
        // As a fallback, try adding "India" (helps ambiguous short names)
        const qIndia = `${location}, India`;
        const url2 = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(qIndia)}`;
        const res2 = await fetch(url2, { headers: { 'Accept-Language': 'en' } });
        if (!res2.ok) return null;
        const data2 = await res2.json();
        if (Array.isArray(data2) && data2.length > 0) {
          const top2 = data2[0];
          if (top2 && top2.lat && top2.lon) return [parseFloat(top2.lat), parseFloat(top2.lon)];
        }
      } catch (e) {
        // ignore
      }
      return null;
    };

    const run = async () => {
      const newEntries: Record<string, [number, number]> = {};
      // Limit number to avoid abusive usage
      const limit = Math.min(unmatched.length, 10);
      for (let i = 0; i < limit; i++) {
        const raw = unmatched[i];
        const coords = await geocodeOne(raw);
        if (coords && !cancelled) {
          newEntries[raw] = coords as [number, number];
          // small delay between requests
          await new Promise(r => setTimeout(r, 800));
        }
      }
      if (!cancelled && Object.keys(newEntries).length > 0) {
        setExtraCoords(prev => ({ ...prev, ...newEntries }));
        // eslint-disable-next-line no-console
        console.log('Geocoded and cached locations:', Object.keys(newEntries));
      }
    };

    run();

    return () => { cancelled = true; };
  }, [edaData, extraCoords]);

  return (
    <div style={{ width: typeof width === 'number' ? `${width}px` : width || '100%', height: typeof height === 'number' ? `${height}px` : height || '600px' }}>
      <MapContainer
        center={[22, 78]}
        zoom={5}
        style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatmapLayer points={points} />
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
};

export default HeatmapMap;
