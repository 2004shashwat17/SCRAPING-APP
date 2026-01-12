import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

interface Friend {
  name: string;
  initial: string;
  sentiment: 'happy' | 'sad' | 'neutral' | 'angry';
}

interface CloseFriend {
  name: string;
  engagement: number;
}

interface AnalysisData {
  name: string;
  profileImage?: string;
  clusters: Cluster[];
  sentiments: {
    happy: number;
    sad: number;
    angry: number;
    neutral: number;
  };
  redFlags: string[];
  friends: Friend[];
  closeFriends: CloseFriend[];
  location: {
    name: string;
    coordinates: [number, number];
  };
}

// Mock data
const mockData: AnalysisData = {
  name: 'Shashwat Saxena',
  clusters: [
    { name: 'Terrorism & International ➤', numPosts: 11, topPost: 'On the roads after a while' },
    { name: 'Threats & Controversies ➤', numPosts: 8, topPost: 'Breaking news today' },
    { name: 'Mountain Adventure ➤', numPosts: 10, topPost: 'Cheers to some new adventures' },
    { name: 'Social Media & Networking ➤', numPosts: 7, topPost: 'Completed 5 Years With Facebook' },
  ],
  sentiments: {
    happy: 65,
    sad: 10,
    angry: 5,
    neutral: 20,
  },
  redFlags: ['Late night posts', 'Alcohol mentions'],
  friends: [
    { name: 'Vibhor', initial: 'V', sentiment: 'happy' },
    { name: 'neutral', initial: 'Rini', sentiment: 'neutral' },
    { name: 'Rhal', initial: 'Rini', sentiment: 'happy' },
    { name: 'Happy', initial: 'R', sentiment: 'happy' },
  ],
  closeFriends: [
    { name: 'Vibhor', engagement: 14 },
    { name: 'Ravi Saxena', engagement: 11 },
    { name: 'Neelam Rawat', engagement: 7 },
  ],
  location: {
    name: 'New Delhi',
    coordinates: [28.6139, 77.2090],
  },
};

const AnalysisView: React.FC = () => {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

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

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'happy':
        return '😊';
      case 'sad':
        return '😔';
      case 'angry':
        return '😠';
      case 'neutral':
        return '😐';
      default:
        return '😐';
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e2e', minHeight: '100vh', color: '#fff' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', gap: '20px' }}>
        <Avatar
          src="https://i.imgur.com/7QXZYqM.jpg"
          alt={mockData.name}
          sx={{ width: 80, height: 80 }}
        />
        <h2 style={{ margin: 0, fontSize: '28px' }}>{mockData.name}</h2>
      </div>

      {/* Clusters Section - Full Width */}
      <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Clusters</h3>
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

          {/* Friends and Their Sentiments */}
          <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Friends and Their Sentiments</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {mockData.friends.map((friend, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{friend.initial}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>{getSentimentEmoji(friend.sentiment)}</span>
                    <span>{friend.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiments with Progress Bars */}
          <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Sentiments</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* Happy */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>😊</span>
                    <span>Happy {mockData.sentiments.happy}%</span>
                  </span>
                </div>
                <div style={{ backgroundColor: '#3a3a4a', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: getSentimentColor('happy'),
                      height: '100%',
                      width: `${mockData.sentiments.happy}%`,
                      borderRadius: '10px',
                    }}
                  />
                </div>
              </div>

              {/* Sad */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>😔</span>
                    <span>Sad {mockData.sentiments.sad}%</span>
                  </span>
                </div>
                <div style={{ backgroundColor: '#3a3a4a', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: getSentimentColor('sad'),
                      height: '100%',
                      width: `${mockData.sentiments.sad}%`,
                      borderRadius: '10px',
                    }}
                  />
                </div>
              </div>

              {/* Angry */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>😠</span>
                    <span>Angry {mockData.sentiments.angry}%</span>
                  </span>
                </div>
                <div style={{ backgroundColor: '#3a3a4a', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: getSentimentColor('angry'),
                      height: '100%',
                      width: `${mockData.sentiments.angry}%`,
                      borderRadius: '10px',
                    }}
                  />
                </div>
              </div>

              {/* Neutral */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>😐</span>
                    <span>Neutral {mockData.sentiments.neutral}%</span>
                  </span>
                </div>
                <div style={{ backgroundColor: '#3a3a4a', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: getSentimentColor('neutral'),
                      height: '100%',
                      width: `${mockData.sentiments.neutral}%`,
                      borderRadius: '10px',
                    }}
                  />
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

          {/* Locations */}
          <div style={{ backgroundColor: '#252533', padding: '20px', borderRadius: '10px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📍 Locations
            </h3>
            <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
              <MapContainer
                center={mockData.location.coordinates}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={mockData.location.coordinates}>
                  <Popup>{mockData.location.name}</Popup>
                </Marker>
              </MapContainer>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📍</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{mockData.location.name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
