import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  useTheme,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Article as ArticleIcon,
  ThumbUp as ThumbUpIcon,
} from '@mui/icons-material';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

// Location coordinates mapping (you can extend this)
const LOCATION_COORDS: Record<string, [number, number]> = {
  'New Delhi': [28.6139, 77.2090],
  'Delhi': [28.6139, 77.2090],
  'Mumbai': [19.0760, 72.8777],
  'Dalhousie': [32.5437, 75.9472],
  'Jammu, Katra': [32.9916, 74.9320],
  'Thailand': [15.8700, 100.9925],
  'Jammu': [32.7266, 74.8570],
  'Katra': [32.9916, 74.9320],
};

interface EdaStats {
  statistics: {
    totalPosts: number;
    totalLocations: number;
    locations: Array<{ name: string; count: number }>;
  };
  engagement: {
    topEngagers: Array<{ name: string; count: number }>;
  };
  locations: Array<{ name: string; count: number }>;
}

// Component to auto-fit map bounds
const MapBoundsFitter: React.FC<{ locations: Array<{ coords: [number, number] }> }> = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = locations.map(loc => loc.coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);

  return null;
};

const EdaDashboard: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [stats, setStats] = useState<EdaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.getEdaDashboardStats(user.id, 'shaswat');
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No data available</Alert>
      </Box>
    );
  }

  // Prepare location data for map
  const mapLocations = stats.locations
    .filter(loc => LOCATION_COORDS[loc.name])
    .map(loc => ({
      name: loc.name,
      count: loc.count,
      coords: LOCATION_COORDS[loc.name],
    }));

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Social Media Analytics Dashboard
      </Typography>

      {/* Statistics Section */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: 'white' }}>
                    {stats.statistics.totalPosts}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Total Posts
                  </Typography>
                </Box>
                <ArticleIcon sx={{ fontSize: 60, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: 'white' }}>
                    {stats.statistics.totalLocations}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Locations
                  </Typography>
                </Box>
                <LocationIcon sx={{ fontSize: 60, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: 'white' }}>
                    {stats.engagement.topEngagers.length > 0 ? stats.engagement.topEngagers[0].count : 0}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Top Engager Interactions
                  </Typography>
                </Box>
                <ThumbUpIcon sx={{ fontSize: 60, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Location Details and Engagement */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
        {/* Location Breakdown */}
        <Box sx={{ flex: '1 1 400px', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Location Breakdown
              </Typography>
              <List>
                {stats.statistics.locations.map((location, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <LocationIcon sx={{ mr: 2, color: theme.palette.primary.main }} />
                      <ListItemText
                        primary={location.name}
                        secondary={`${location.count} posts`}
                      />
                      <Chip
                        label={location.count}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </ListItem>
                    {index < stats.statistics.locations.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>

        {/* Overall Engagement */}
        <Box sx={{ flex: '1 1 400px', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Overall Engagement - Top Engagers
              </Typography>
              <List>
                {stats.engagement.topEngagers.slice(0, 10).map((engager, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: theme.palette.primary.main,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          mr: 2,
                        }}
                      >
                        {index + 1}
                      </Box>
                      <ListItemText
                        primary={engager.name}
                        secondary={`${engager.count} interactions`}
                      />
                      <Chip
                        label={engager.count}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    </ListItem>
                    {index < Math.min(stats.engagement.topEngagers.length - 1, 9) && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Activity Locations Heatmap */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Activity Locations Heat Map
          </Typography>
          <Box sx={{ height: 500, borderRadius: 2, overflow: 'hidden' }}>
            {mapLocations.length > 0 ? (
              <MapContainer
                center={[28.6139, 77.2090]}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapBoundsFitter locations={mapLocations} />
                {mapLocations.map((location, index) => {
                  // Calculate radius based on count (more posts = bigger circle)
                  const radius = Math.min(20 + location.count * 2, 50);
                  return (
                    <CircleMarker
                      key={index}
                      center={location.coords}
                      radius={radius}
                      fillColor={theme.palette.primary.main}
                      fillOpacity={0.6}
                      color={theme.palette.primary.dark}
                      weight={2}
                    >
                      <Popup>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {location.name}
                          </Typography>
                          <Typography variant="body2">
                            {location.count} posts
                          </Typography>
                        </Box>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Alert severity="info">No location data available for mapping</Alert>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EdaDashboard;
