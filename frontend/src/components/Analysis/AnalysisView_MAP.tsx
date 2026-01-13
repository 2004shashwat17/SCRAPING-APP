import React, { useState } from 'react';
import { MapContainer, TileLayer, Circle, Tooltip } from 'react-leaflet';
import Avatar from '@mui/material/Avatar';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface Cluster {
  name: string;
  numPosts: number;
  topPost: string;
}

interface CloseFriend {
  name: string;
  engagement: number;
}

interface LocationPoint {
  lat: number;
  lng: number;
  intensity: number;
}

interface AnalysisData {
  name: string;
  profileImage?: string;
  clusters: Cluster[];
  sentiments: {
    happy: { percentage: number; keywords: string[] };
    sad: { percentage: number; keywords: string[] };
    angry: { percentage: number; keywords: string[] };
    neutral: { percentage: number; keywords: string[] };
  };
  redFlags: string[];
  closeFriends: CloseFriend[];
  locations: LocationPoint[];
}

// Mock data with enhanced sentiments and multiple locations
const mockData: AnalysisData = {
  name: 'Your Child',
  clusters: [
    { name: 'Terrorism & International ➤', numPosts: 11, topPost: 'On the roads after a while' },
    { name: 'Threats & Controversies ➤', numPosts: 8, topPost: 'Breaking news today' },
    { name: 'Mountain Adventure ➤', numPosts: 10, topPost: 'Cheers to some new adventures' },
    { name: 'Social Media & Networking ➤', numPosts: 7, topPost: 'Completed 5 Years With Facebook' },
  ],
  sentiments: {
    happy: {
      percentage: 65,
      keywords: ['celebration', 'friends', 'adventure', 'success', 'love', 'fun'],
    },
    sad: {
      percentage: 10,
      keywords: ['miss', 'alone', 'disappointed', 'upset'],
    },
    angry: {
      percentage: 5,
      keywords: ['unfair', 'frustrated', 'annoyed'],
    },
    neutral: {
      percentage: 20,
      keywords: ['normal', 'routine', 'update', 'daily', 'work'],
    },
  },
  redFlags: ['Late night posts', 'Alcohol mentions'],
  closeFriends: [
    { name: 'Vibhor', engagement: 14 },
    { name: 'Ravi Saxena', engagement: 11 },
    { name: 'Neelam Rawat', engagement: 7 },
  ],
  // Multiple locations: Delhi, Ludhiana, Mumbai with varying intensities
  locations: [
    // New Delhi cluster
    { lat: 28.6139, lng: 77.2090, intensity: 0.9 },
    { lat: 28.6169, lng: 77.2120, intensity: 0.8 },
    { lat: 28.6109, lng: 77.2060, intensity: 0.7 },
    // Ludhiana cluster
    { lat: 30.9010, lng: 75.8573, intensity: 0.6 },
    { lat: 30.9040, lng: 75.8603, intensity: 0.5 },
    // Mumbai cluster
    { lat: 19.0760, lng: 72.8777, intensity: 0.8 },
    { lat: 19.0790, lng: 72.8807, intensity: 0.7 },
    { lat: 19.0730, lng: 72.8747, intensity: 0.6 },
  ],
};

const AnalysisView: React.FC = () => {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  // Get avatar from localStorage or default
  const userAvatar = localStorage.getItem('userAvatar') || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4';

  const toggleCluster = (clusterName: string) => {
    setExpandedCluster(expandedCluster === clusterName ? null : clusterName);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'happy':
        return '#4caf50';
      case 'sad':
        return '#ff9800';
      case 'angry':
        return '#f44336';
      case 'neutral':
        return '#9e9e9e';
      default:
        return '#9e9e9e';
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e2e', minHeight: '100vh', color: '#fff' }}>
      {/* Header Section with Parent-Friendly Message */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
          <Avatar
            src={userAvatar}
            alt={mockData.name}
            sx={{ width: 80, height: 80, cursor: 'pointer' }}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: '28px', marginBottom: '8px' }}>{mockData.name}</h2>
            <p style={{ margin: 0, fontSize: '16px', color: '#b4b4c8', lineHeight: '1.5' }}>
              📊 Understanding your child's online activity helps ensure their safety and well-being
            </p>
          </div>
        </div>
      </div>

      {/* Clusters Section - Full Width */}
      <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Activity Clusters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {mockData.clusters.map((cluster, index) => (
            <div key={index}>
              <div
                style={{
                  backgroundColor: '#3a3a4a',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onClick={() => toggleCluster(cluster.name)}
              >
                <span>{cluster.name}</span>
                <span style={{ fontSize: '18px' }}>
                  {expandedCluster === cluster.name ? '▼' : '▶'}
                </span>
              </div>
              {expandedCluster === cluster.name && (
                <div
                  style={{
                    backgroundColor: '#2d2d3d',
                    padding: '15px',
                    marginTop: '5px',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '20px' }}>📊</span>
                    <span>Total posts: {cluster.numPosts}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>🔥</span>
                    <span>Top post: "{cluster.topPost}"</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Close Friends Table */}
          <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Close Friends</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #3a3a4a' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>High Engagement</th>
                </tr>
              </thead>
              <tbody>
                {mockData.closeFriends.map((friend, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #3a3a4a' }}>
                    <td style={{ padding: '12px' }}>{friend.name}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#4caf50' }}>
                      {friend.engagement}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Enhanced Sentiments with Keywords */}
          <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Sentiments & Topics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Happy */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>😊</span>
                    <span style={{ fontWeight: 'bold' }}>Happy {mockData.sentiments.happy.percentage}%</span>
                  </span>
                </div>
                <div style={{ backgroundColor: '#3a3a4a', borderRadius: '10px', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div
                    style={{
                      backgroundColor: getSentimentColor('happy'),
                      height: '100%',
                      width: `${mockData.sentiments.happy.percentage}%`,
                      borderRadius: '10px',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {mockData.sentiments.happy.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#4caf5033',
                        color: '#4caf50',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sad */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>😔</span>
                    <span style={{ fontWeight: 'bold' }}>Sad {mockData.sentiments.sad.percentage}%</span>
                  </span>
                </div>
                <div style={{ backgroundColor: '#3a3a4a', borderRadius: '10px', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div
                    style={{
                      backgroundColor: getSentimentColor('sad'),
                      height: '100%',
                      width: `${mockData.sentiments.sad.percentage}%`,
                      borderRadius: '10px',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {mockData.sentiments.sad.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#ff980033',
                        color: '#ff9800',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              {/* Angry */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>😠</span>
                    <span style={{ fontWeight: 'bold' }}>Angry {mockData.sentiments.angry.percentage}%</span>
                  </span>
                </div>
                <div style={{ backgroundColor: '#3a3a4a', borderRadius: '10px', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div
                    style={{
                      backgroundColor: getSentimentColor('angry'),
                      height: '100%',
                      width: `${mockData.sentiments.angry.percentage}%`,
                      borderRadius: '10px',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {mockData.sentiments.angry.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#f4433633',
                        color: '#f44336',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              {/* Neutral */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>😐</span>
                    <span style={{ fontWeight: 'bold' }}>Neutral {mockData.sentiments.neutral.percentage}%</span>
                  </span>
                </div>
                <div style={{ backgroundColor: '#3a3a4a', borderRadius: '10px', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div
                    style={{
                      backgroundColor: getSentimentColor('neutral'),
                      height: '100%',
                      width: `${mockData.sentiments.neutral.percentage}%`,
                      borderRadius: '10px',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {mockData.sentiments.neutral.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#9e9e9e33',
                        color: '#9e9e9e',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Red Flags */}
          <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Red Flags</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mockData.redFlags.map((flag, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#3a3a4a',
                    padding: '10px',
                    borderRadius: '8px',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>
                    {flag.toLowerCase().includes('alcohol') ? '🍺' : '🚨'}
                  </span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location Heatmap */}
          <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📍 Activity Locations Heatmap
            </h3>
            <p style={{ margin: 0, marginBottom: '15px', fontSize: '14px', color: '#b4b4c8' }}>
              Shows where your child is most active based on post locations
            </p>
            <div style={{ height: '350px', borderRadius: '8px', overflow: 'hidden' }}>
              <MapContainer
                center={[26, 76]} // Center on India to show all locations
                zoom={5} // Zoomed out to show multiple cities
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Render circles as heatmap visualization */}
                {mockData.locations.map((location, idx) => {
                  const getColor = (intensity: number) => {
                    if (intensity >= 0.8) return '#ff0000'; // Red for high
                    if (intensity >= 0.6) return '#ff6600'; // Orange
                    return '#ffaa00'; // Yellow for moderate
                  };
                  
                  return (
                    <Circle
                      key={idx}
                      center={[location.lat, location.lng]}
                      radius={location.intensity * 50000} // Scale radius by intensity
                      pathOptions={{
                        fillColor: getColor(location.intensity),
                        fillOpacity: 0.5,
                        color: getColor(location.intensity),
                        weight: 2,
                        opacity: 0.7,
                      }}
                    >
                      <Tooltip>
                        Activity intensity: {Math.round(location.intensity * 100)}%
                      </Tooltip>
                    </Circle>
                  );
                })}
              </MapContainer>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🔴</span>
                <span>High activity: New Delhi, Mumbai</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🟡</span>
                <span>Moderate activity: Ludhiana</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
