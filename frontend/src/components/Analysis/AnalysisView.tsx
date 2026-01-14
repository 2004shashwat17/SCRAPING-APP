import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Avatar,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  TrendingUp as TrendingUpIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Circle, Tooltip as MapTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Location coordinates mapping
const LOCATION_COORDS: Record<string, [number, number]> = {
  'New Delhi': [28.6139, 77.2090],
  'Delhi': [28.6139, 77.2090],
  'Mumbai': [19.0760, 72.8777],
  'Dalhousie': [32.5437, 75.9472],
  'Jammu, Katra': [32.9916, 74.9320],
  'Jammu': [32.7266, 74.8570],
  'Katra': [32.9916, 74.9320],
  'Thailand': [15.8700, 100.9925],
  'Ludhiana': [30.9010, 75.8573],
};

const activityClusters = [
  { name: 'Terrorism & International ➤', numPosts: 11, topPost: 'On the roads after a while' },
  { name: 'Threats & Controversies ➤', numPosts: 8, topPost: 'Breaking news today' },
  { name: 'Mountain Adventure ➤', numPosts: 10, topPost: 'Cheers to some new adventures' },
  { name: 'Social Media & Networking ➤', numPosts: 7, topPost: 'Completed 5 Years With Facebook' },
];

const redFlags = ['Late night posts', 'Alcohol mentions'];

const locationPoints = [
  { lat: 28.6139, lng: 77.2090, intensity: 0.9 },
  { lat: 28.6169, lng: 77.2120, intensity: 0.8 },
  { lat: 28.6109, lng: 77.2060, intensity: 0.7 },
  { lat: 30.9010, lng: 75.8573, intensity: 0.6 },
  { lat: 30.9040, lng: 75.8603, intensity: 0.5 },
  { lat: 19.0760, lng: 72.8777, intensity: 0.8 },
  { lat: 19.0790, lng: 72.8807, intensity: 0.7 },
  { lat: 19.0730, lng: 72.8747, intensity: 0.6 },
];

// Function to get color based on post count density
const getLocationColor = (count: number, maxCount: number): string => {
  const intensity = count / maxCount;
  if (intensity >= 0.7) return '#ff0000'; // Dense - Dark Red
  if (intensity >= 0.4) return '#ff6600'; // Medium - Orange  
  return '#ffaa00'; // Low - Yellow
};

const GlassCard: React.FC<{ children: React.ReactNode; gradient?: string; priority?: boolean }> = ({ children, gradient, priority }) => {
  return (
    <Card
      sx={{
        background: gradient || 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.4)',
        borderRadius: 3,
        boxShadow: priority 
          ? '0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35)'
          : '0 8px 32px rgba(0, 0, 0, 0.5)',
        transition: 'all 0.3s ease',
        width: '100%',
        flex: 1,
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: priority
            ? '0 0 0 1px rgba(255,255,255,0.1), 0 12px 40px rgba(139, 92, 246, 0.6)'
            : '0 12px 40px rgba(139, 92, 246, 0.6)',
          border: '1px solid rgba(139, 92, 246, 0.6)',
        },
      }}
    >
      {children}
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [edaData, setEdaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAvatar] = useState(localStorage.getItem('userAvatar') || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4');
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2025);

  // Generate years from 2000 to 3000
  const years = Array.from({ length: 1001 }, (_, i) => 2000 + i);

  // Generate monthly data based on selected year
  const getMonthlyData = (year: number) => {
    // Generate random but consistent data based on year
    const seed = year;
    return [
      { month: 'Jan', posts: 50 + (seed * 7) % 40 },
      { month: 'Feb', posts: 45 + (seed * 11) % 35 },
      { month: 'Mar', posts: 60 + (seed * 13) % 45 },
      { month: 'Apr', posts: 40 + (seed * 17) % 38 },
      { month: 'May', posts: 55 + (seed * 19) % 42 },
      { month: 'Jun', posts: 50 + (seed * 23) % 40 },
      { month: 'Jul', posts: 58 + (seed * 29) % 43 },
      { month: 'Aug', posts: 62 + (seed * 31) % 45 },
      { month: 'Sep', posts: 52 + (seed * 37) % 41 },
      { month: 'Oct', posts: 48 + (seed * 41) % 39 },
      { month: 'Nov', posts: 44 + (seed * 43) % 37 },
      { month: 'Dec', posts: 50 + (seed * 47) % 40 },
    ];
  };

  const handleYearChange = (event: any) => {
    setSelectedYear(event.target.value);
  };

  const handleOpenDialog = (dialogType: string) => {
    setOpenDialog(dialogType);
  };

  const handleCloseDialog = () => {
    setOpenDialog(null);
  };

  // Function to load dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch EDA data if user is logged in
      if (user?.id) {
        try {
          const data = await apiClient.getEdaDashboardStats(user.id, 'shaswat');
          setEdaData(data);
          
          // Set dashboard data from EDA
          setDashboardData({
            totalPosts: data.statistics.totalPosts,
            engagement: '2.4K',
            sentiment: '85%',
            activeHours: '6.2h',
          });
        } catch (edaError) {
          console.error('EDA data fetch failed:', edaError);
          // Use mock data on error
          setDashboardData({
            totalPosts: 847,
            engagement: '2.4K',
            sentiment: '85%',
            activeHours: '6.2h',
          });
        }
      } else {
        // Use mock data if no user
        setDashboardData({
          totalPosts: 847,
          engagement: '2.4K',
          sentiment: '85%',
          activeHours: '6.2h',
        });
      }
    } catch (err) {
      console.log('Using mock data', err);
      setDashboardData({
        totalPosts: 847,
        engagement: '2.4K',
        sentiment: '85%',
        activeHours: '6.2h',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboardData) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="80vh"
        sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        }}
      >
        <CircularProgress size={60} sx={{ color: '#a78bfa' }} />
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

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 25%, #312e81 50%, #4c1d95 75%, #5b21b6 100%)',
        backgroundAttachment: 'fixed',
        p: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
        <Avatar
          src={userAvatar}
          sx={{
            width: 72,
            height: 72,
            border: '3px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
          }}
        />
        <Box>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 900, 
              color: '#F5F7FA',
              mb: 0.5,
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            Welcome Back! 👋
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#C9CED6',
              fontSize: '1.1rem',
            }}
          >
            Here's what's happening with your child's online activity
          </Typography>
        </Box>
      </Box>

      {/* Three Column Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mb: 4, alignItems: 'stretch' }}>
        {/* Statistics Card - Small Preview */}
        <Box
          onClick={() => handleOpenDialog('statistics')}
          sx={{
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            width: '100%',
            '&:hover': {
              transform: 'scale(1.03) translateY(-2px)',
            },
          }}
        >
          <GlassCard gradient="linear-gradient(135deg, rgba(99, 102, 241, 0.6) 0%, rgba(139, 92, 246, 0.5) 100%)" priority={true}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', minHeight: '280px', width: '100%' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA', mb: 1 }}>
                📊 Statistics
              </Typography>
              <Typography variant="body2" sx={{ color: '#C9CED6', mb: 2, fontSize: '0.9rem' }}>
                Overview of key metrics and activities
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.2)' }}>
                  <Typography variant="body2" sx={{ color: '#C9CED6' }}>
                    📝 Total Posts: <strong style={{ color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>{edaData?.statistics?.totalPosts || 847}</strong>
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.2)' }}>
                  <Typography variant="body2" sx={{ color: '#C9CED6' }}>
                    📍 Locations: <strong style={{ color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>{edaData?.statistics?.totalLocations || 3} cities</strong>
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: '#a78bfa', textAlign: 'center', mt: 1, fontWeight: 600 }}>
                  Click to see more details →
                </Typography>
              </Box>
            </CardContent>
          </GlassCard>
        </Box>

        {/* Engagement Card - Small Preview (MOVED TO MIDDLE) */}
        <Box
          onClick={() => handleOpenDialog('engagement')}
          sx={{
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            width: '100%',
            '&:hover': {
              transform: 'scale(1.03) translateY(-2px)',
            },
          }}
        >
          <GlassCard gradient="linear-gradient(135deg, rgba(16, 185, 129, 0.6) 0%, rgba(5, 150, 105, 0.5) 100%)">
            <CardContent sx={{ display: 'flex', flexDirection: 'column', minHeight: '280px', width: '100%' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA', mb: 1 }}>
                👥 Overall Engagement
              </Typography>
              <Typography variant="body2" sx={{ color: '#C9CED6', mb: 2, fontSize: '0.9rem' }}>
                Top engagers and their interaction levels
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                {(edaData?.engagement?.topEngagers?.slice(0, 2) || [
                  { name: 'Vibhor', count: 14 },
                  { name: 'Ravi Saxena', count: 11 },
                ]).map((person: any, index: number) => (
                  <Box key={index} sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#C9CED6', fontSize: '0.85rem' }}>
                      {person.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#F5F7FA', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {person.count}
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: '#34d399', textAlign: 'center', mt: 1, fontWeight: 600 }}>
                  +8 more people →
                </Typography>
              </Box>
            </CardContent>
          </GlassCard>
        </Box>

        {/* Clusters Card - Small Preview (MOVED TO RIGHT) */}
        <Box
          onClick={() => handleOpenDialog('clusters')}
          sx={{
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            width: '100%',
            '&:hover': {
              transform: 'scale(1.03) translateY(-2px)',
            },
          }}
        >
          <GlassCard gradient="linear-gradient(135deg, rgba(236, 72, 153, 0.6) 0%, rgba(219, 39, 119, 0.5) 100%)">
            <CardContent sx={{ display: 'flex', flexDirection: 'column', minHeight: '280px', width: '100%' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA', mb: 1 }}>
                🎯 Clusters
              </Typography>
              <Typography variant="body2" sx={{ color: '#C9CED6', mb: 2, fontSize: '0.9rem' }}>
                Content categories and themes
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                {[
                  'Humor & Entertainment',
                  'Travel & Destinations',
                ].map((cluster, index) => (
                  <Box key={index} sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#f472b6' }} />
                    <Typography variant="body2" sx={{ color: '#C9CED6', fontSize: '0.85rem' }}>
                      {cluster}
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: '#f472b6', textAlign: 'center', mt: 1, fontWeight: 600 }}>
                  +10 more clusters →
                </Typography>
              </Box>
            </CardContent>
          </GlassCard>
        </Box>
      </Box>

      {/* Dialog Popups */}
      {/* Statistics Dialog */}
      <Dialog
        open={openDialog === 'statistics'}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.9) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            📊 Statistics - Full Details
          </Typography>
          <IconButton onClick={handleCloseDialog} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 3, lineHeight: 1.6 }}>
            Get a complete overview of your child's social media activity. See how many posts they've shared, where they're posting from, and when they're most active throughout the year.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {/* Total Posts */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                <Typography sx={{ fontSize: '1.5rem' }}>📝</Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                  Total Posts
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, pl: 5.5 }}>
                {edaData?.statistics?.totalPosts || 847}
              </Typography>
            </Box>

            {/* Locations with Post Count */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Typography sx={{ fontSize: '1.5rem' }}>📍</Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                  Locations
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 5.5 }}>
                {(edaData?.statistics?.locations || [
                  { name: 'Delhi', count: 1 },
                  { name: 'Jammu', count: 1 },
                  { name: 'Dalhousie', count: 1 },
                  { name: 'Thailand', count: 1 },
                ]).map((location: any, idx: number) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 500 }}>
                      {location.name}
                    </Typography>
                    <Typography
                      sx={{
                        color: '#fff',
                        fontWeight: 700,
                        background: 'rgba(255, 255, 255, 0.2)',
                        px: 2,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.9rem',
                      }}
                    >
                      {location.count} post{location.count > 1 ? 's' : ''}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Monthly Breakdown */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography sx={{ fontSize: '1.5rem' }}>📅</Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                    Monthly Posts - {selectedYear}
                  </Typography>
                </Box>
                <FormControl size="small">
                  <Select
                    value={selectedYear}
                    onChange={handleYearChange}
                    sx={{
                      color: '#fff',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 1,
                      minWidth: 100,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.7)',
                      },
                      '& .MuiSvgIcon-root': {
                        color: '#fff',
                      },
                    }}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          maxHeight: 300,
                          background: 'rgba(30, 41, 59, 0.95)',
                          backdropFilter: 'blur(20px)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          '& .MuiMenuItem-root': {
                            color: '#fff',
                            '&:hover': {
                              background: 'rgba(139, 92, 246, 0.2)',
                            },
                            '&.Mui-selected': {
                              background: 'rgba(139, 92, 246, 0.3)',
                              '&:hover': {
                                background: 'rgba(139, 92, 246, 0.4)',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    {years.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, pl: 5.5 }}>
                {getMonthlyData(selectedYear).map((monthData, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.1)',
                      p: 1,
                      borderRadius: 1,
                    }}
                  >
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.85rem', fontWeight: 500 }}>
                      {monthData.month}
                    </Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                      {monthData.posts}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Yearly Breakdown */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Typography sx={{ fontSize: '1.5rem' }}>📆</Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                  Yearly Posts
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 5.5 }}>
                {[
                  { year: '2025', posts: 423 },
                  { year: '2024', posts: 312 },
                  { year: '2023', posts: 112 },
                ].map((yearData, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.1)',
                      p: 1.5,
                      borderRadius: 1,
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
                      {yearData.year}
                    </Typography>
                    <Typography
                      sx={{
                        color: '#fff',
                        fontWeight: 700,
                        background: 'rgba(255, 255, 255, 0.2)',
                        px: 2.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '1.1rem',
                      }}
                    >
                      {yearData.posts} posts
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Clusters Dialog */}
      <Dialog
        open={openDialog === 'clusters'}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.95) 0%, rgba(219, 39, 119, 0.9) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            🎯 All Clusters
          </Typography>
          <IconButton onClick={handleCloseDialog} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 3, lineHeight: 1.6 }}>
            These are the main topics and themes your child posts about on social media. Understanding their interests helps you stay connected with what matters to them and identify any concerning patterns in their content.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {[
              'Humor & Entertainment',
              'Travel & Destinations',
              'Mountain Adventures',
              'SEO & Professional Events',
              'Social Media & Networking',
              'Nostalgia & Memories',
              'Education & Milestones',
              'Meetups & Networking Events',
              'Industry Experts & Mentors',
              'Life Philosophy & Wisdom',
              'Emotional & Social Causes',
              'Miscellaneous',
            ].map((cluster, index) => (
              <Box
                key={index}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
                  }}
                />
                <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600 }}>
                  {cluster}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Engagement Dialog */}
      <Dialog
        open={openDialog === 'engagement'}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.9) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            👥 All Engagers
          </Typography>
          <IconButton onClick={handleCloseDialog} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 3, lineHeight: 1.6 }}>
            These are the people who interact most with your child's posts through likes, comments, and shares. Knowing their closest online friends helps you understand their social circle and who influences them the most.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {(edaData?.engagement?.topEngagers || [
              { name: 'Vibhor', count: 14 },
              { name: 'Ravi Saxena', count: 11 },
              { name: 'Neelam Rawat', count: 7 },
              { name: 'Priya Sharma', count: 9 },
              { name: 'Amit Kumar', count: 6 },
              { name: 'Sonia Verma', count: 8 },
              { name: 'Rahul Singh', count: 5 },
              { name: 'Pooja Gupta', count: 7 },
              { name: 'Karan Malhotra', count: 4 },
              { name: 'Anjali Reddy', count: 6 },
            ]).map((person: any, index: number) => (
              <Box
                key={index}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600 }}>
                  {person.name}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    color: '#fff',
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.2)',
                    px: 2.5,
                    py: 0.5,
                    borderRadius: 2,
                  }}
                >
                  {person.count}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Activity Clusters */}
      <Box sx={{ mb: 4 }}>
        <GlassCard gradient="linear-gradient(135deg, rgba(139, 92, 246, 0.6) 0%, rgba(236, 72, 153, 0.5) 100%)">
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA', mb: 3 }}>
              📊 Activity Clusters
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              {activityClusters.map((cluster, index) => {
                const gradients = [
                  'linear-gradient(135deg, rgba(139, 92, 246, 0.35) 0%, rgba(99, 102, 241, 0.25) 100%)',
                  'linear-gradient(135deg, rgba(236, 72, 153, 0.35) 0%, rgba(219, 39, 119, 0.25) 100%)',
                  'linear-gradient(135deg, rgba(59, 130, 246, 0.35) 0%, rgba(37, 99, 235, 0.25) 100%)',
                  'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.25) 100%)',
                ];
                const hoverGradients = [
                  'linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(99, 102, 241, 0.35) 100%)',
                  'linear-gradient(135deg, rgba(236, 72, 153, 0.5) 0%, rgba(219, 39, 119, 0.35) 100%)',
                  'linear-gradient(135deg, rgba(59, 130, 246, 0.5) 0%, rgba(37, 99, 235, 0.35) 100%)',
                  'linear-gradient(135deg, rgba(16, 185, 129, 0.5) 0%, rgba(5, 150, 105, 0.35) 100%)',
                ];
                return (
                <Box key={index}>
                  <Box
                    onClick={() => setExpandedCluster(expandedCluster === cluster.name ? null : cluster.name)}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      background: gradients[index % 4],
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: hoverGradients[index % 4],
                        border: '1px solid rgba(139, 92, 246, 0.5)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 16px rgba(139, 92, 246, 0.3)',
                      },
                    }}
                  >
                    <Typography variant="body1" sx={{ color: '#F5F7FA', fontWeight: 700 }}>
                      {cluster.name}
                    </Typography>
                    <Box
                      sx={{
                        transition: 'transform 0.3s ease',
                        transform: expandedCluster === cluster.name ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      {expandedCluster === cluster.name ? <ExpandLessIcon sx={{ color: '#a78bfa' }} /> : <ExpandMoreIcon sx={{ color: '#a78bfa' }} />}
                    </Box>
                  </Box>
                  {expandedCluster === cluster.name && (
                    <Box sx={{ 
                      p: 2, 
                      mt: 1, 
                      borderRadius: 2, 
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Typography sx={{ fontSize: '1.2rem' }}>📊</Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          Total posts: <strong style={{ color: '#a78bfa' }}>{cluster.numPosts}</strong>
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography sx={{ fontSize: '1.2rem' }}>🔥</Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          Top post: <em>"{cluster.topPost}"</em>
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              )})}
            </Box>
          </CardContent>
        </GlassCard>
      </Box>

      {/* Close Friends & Red Flags */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 4 }}>
        {/* Moods */}
        <GlassCard gradient="linear-gradient(135deg, rgba(16, 185, 129, 0.55) 0%, rgba(6, 182, 212, 0.5) 100%)">
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA', mb: 3 }}>
              😊 Moods
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                { 
                  label: 'Happy', 
                  value: 65, 
                  color: '#10b981', 
                  icon: '😊',
                  keywords: ['celebration', 'friends', 'adventure', 'success', 'love', 'fun']
                },
                { 
                  label: 'Sad', 
                  value: 15, 
                  color: '#3b82f6', 
                  icon: '😢',
                  keywords: ['miss', 'alone', 'disappointed', 'upset', 'cry']
                },
                { 
                  label: 'Angry', 
                  value: 10, 
                  color: '#ef4444', 
                  icon: '😠',
                  keywords: ['unfair', 'frustrated', 'annoyed', 'mad', 'hate']
                },
                { 
                  label: 'Neutral', 
                  value: 10, 
                  color: '#f59e0b', 
                  icon: '😐',
                  keywords: ['normal', 'routine', 'update', 'daily', 'work']
                },
              ].map((mood, index) => (
                <Box key={index}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography sx={{ fontSize: '1.5rem' }}>{mood.icon}</Typography>
                      <Typography variant="body1" sx={{ color: '#F5F7FA', fontWeight: 700 }}>
                        {mood.label}
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ color: mood.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {mood.value}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={mood.value}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      mb: 1,
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: mood.color,
                        borderRadius: 4,
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {mood.keywords.map((keyword, kidx) => (
                      <Chip
                        key={kidx}
                        label={keyword}
                        size="small"
                        sx={{
                          background: `${mood.color}22`,
                          color: mood.color,
                          fontWeight: 500,
                          fontSize: '0.7rem',
                          border: `1px solid ${mood.color}44`,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </GlassCard>

        {/* Red Flags */}
        <GlassCard gradient="linear-gradient(135deg, rgba(239, 68, 68, 0.65) 0%, rgba(251, 146, 60, 0.55) 100%)" priority={true}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Typography sx={{ fontSize: '1.8rem' }}>⚠️</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA' }}>
                Red Flags
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {redFlags.map((flag, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    background: 'rgba(239, 68, 68, 0.3)',
                    border: '1px solid rgba(239, 68, 68, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'rgba(239, 68, 68, 0.35)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '1.5rem' }}>
                    {flag.toLowerCase().includes('alcohol') ? '🍺' : '🚨'}
                  </Typography>
                  <Typography sx={{ color: '#F5F7FA', fontWeight: 700 }}>{flag}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </GlassCard>
      </Box>

      {/* Location Heatmap */}
      <GlassCard priority={true}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA', mb: 0.5 }}>
                📍 Activity Locations Heatmap
              </Typography>
              <Typography variant="body2" sx={{ color: '#C9CED6' }}>
                Shows where your child is most active based on post locations
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['Last 7 days', '30 days', 'All time'].map((filter, idx) => (
                <Chip
                  key={idx}
                  label={filter}
                  onClick={() => {}}
                  sx={{
                    background: idx === 2 ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    color: idx === 2 ? '#a78bfa' : '#C9CED6',
                    border: idx === 2 ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                    fontWeight: idx === 2 ? 700 : 500,
                    fontSize: '0.75rem',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      background: 'rgba(139, 92, 246, 0.3)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.5)',
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: '#ff0000' }} />
              <Typography variant="body2" sx={{ color: '#C9CED6', fontWeight: 600 }}>
                High activity: New Delhi, Mumbai
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: '#ffaa00' }} />
              <Typography variant="body2" sx={{ color: '#C9CED6', fontWeight: 600 }}>
                Moderate activity: Ludhiana
              </Typography>
            </Box>
          </Box>
          <Box sx={{ height: 550, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <MapContainer
              center={[26, 76]}
              zoom={5}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {(() => {
                // Get top 4 locations from EDA data
                const topLocations = edaData?.heatmap?.topLocations || [];
                const maxCount = topLocations.length > 0 ? topLocations[0].count : 1;
                
                // Map to coordinates with density-based colors
                return topLocations
                  .filter((loc: any) => LOCATION_COORDS[loc.name])
                  .map((loc: any, idx: number) => {
                    const coords = LOCATION_COORDS[loc.name];
                    const color = getLocationColor(loc.count, maxCount);
                    const intensity = loc.count / maxCount;
                    
                    return (
                      <Circle
                        key={idx}
                        center={coords}
                        radius={intensity * 50000}
                        pathOptions={{
                          fillColor: color,
                          fillOpacity: 0.5,
                          color: color,
                          weight: 2,
                          opacity: 0.7,
                        }}
                      >
                        <MapTooltip>
                          <strong>{loc.name}</strong><br/>
                          {loc.count} post{loc.count > 1 ? 's' : ''}
                        </MapTooltip>
                      </Circle>
                    );
                  });
              })()}
            </MapContainer>
          </Box>
        </CardContent>
      </GlassCard>
    </Box>
  );
};

export default Dashboard;
