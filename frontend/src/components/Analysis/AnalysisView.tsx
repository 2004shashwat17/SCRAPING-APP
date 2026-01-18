import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  // Chip, (unused)
  CircularProgress,
  Alert,
  Avatar,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Button,
} from '@mui/material';
import WordCloud from 'react-wordcloud';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import HeatmapMap from './HeatmapMap';
import { useNavigate } from 'react-router-dom';
import { ALL_CLUSTERS } from '../../data/clusters';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';


// Small set of clusters shown in the Activity Clusters card (top 4) with sample stats
const activityClusters = ALL_CLUSTERS.slice(0, 4).map((name, idx) => ({
  name: `${name} ➤`,
  numPosts: [11, 8, 10, 7][idx] ?? 6,
  topPost: 'Top post preview',
}));

const redFlags = ['Late night posts', 'Alcohol mentions'];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _locationPoints = [
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
// (kept for future use; underscore-prefix to avoid unused-var warning)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _getLocationColor = (count: number, maxCount: number): string => {
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
  const [edaStatus, setEdaStatus] = useState<'checking' | 'no-data' | 'done'>('checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAvatar] = useState(localStorage.getItem('userAvatar') || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4');
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [clusterCloudOpen, setClusterCloudOpen] = useState(false);
  // (cloud words come from ALL_CLUSTERS below)
  // Cloud should show all clusters from ALL_CLUSTERS; values fallback to sample counts
  const PALETTE = ['#ef476f', '#ff9f1c', '#ffd166', '#06d6a0', '#118ab2', '#8338ec', '#ff6b6b', '#4cc9f0'];

  // Assign deterministic size classes so some words render Large / Medium / Small
  const sizePattern: ('large' | 'medium' | 'small')[] = ['large', 'medium', 'small', 'medium', 'small', 'small', 'medium'];
  const classToValue = { large: 40, medium: 16, small: 7 };
  const cloudWordsAll = ALL_CLUSTERS.map((name, idx) => {
    const match = activityClusters.find(ac => ac.name.replace(/\s+►|➤/g, '').toLowerCase() === name.toLowerCase());
    const cls = sizePattern[idx % sizePattern.length];
    const value = match ? Math.max(match.numPosts, classToValue[cls]) : classToValue[cls];
    return { text: name, value, color: PALETTE[idx % PALETTE.length] };
  });
  const [selectedClusterInDialog, setSelectedClusterInDialog] = useState<string | null>(null);

  const slugify = useCallback((s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, ''), []);

// small helper for deterministic color selection fallback
const hashCode = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return h;
};

  // When dialog opens and a cluster is selected, scroll it into view
  useEffect(() => {
    if (openDialog === 'clusters' && selectedClusterInDialog) {
      const id = `cluster-${slugify(selectedClusterInDialog)}`;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Clear highlight after a short delay
      const t = setTimeout(() => setSelectedClusterInDialog(null), 3000);
      return () => clearTimeout(t);
    }
    return;
  }, [openDialog, selectedClusterInDialog, slugify]);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const navigate = useNavigate();

  // Generate years from 2000 to 3000
  const years = Array.from({ length: 1001 }, (_, i) => 2000 + i);

  // Generate monthly data based on selected year
  const getMonthlyData = (year: number) => {
    // If EDA monthly data is available, compute real counts per month for the selected year
    const monthOrder = [
      { full: 'January', short: 'Jan' },
      { full: 'February', short: 'Feb' },
      { full: 'March', short: 'Mar' },
      { full: 'April', short: 'Apr' },
      { full: 'May', short: 'May' },
      { full: 'June', short: 'Jun' },
      { full: 'July', short: 'Jul' },
      { full: 'August', short: 'Aug' },
      { full: 'September', short: 'Sep' },
      { full: 'October', short: 'Oct' },
      { full: 'November', short: 'Nov' },
      { full: 'December', short: 'Dec' },
    ];

    const result = monthOrder.map(m => ({ month: m.short, posts: 0 }));

    const monthlyData = edaData?.statistics?.monthlyData || [];
    if (Array.isArray(monthlyData) && monthlyData.length > 0) {
      monthlyData.forEach((entry: any) => {
        // entry.month is like 'October 2025' (from backend)
        if (!entry.month || !entry.count) return;
        const parts = String(entry.month).trim().split(' ');
        if (parts.length < 2) return;
        const monthName = parts[0];
        const entryYear = parseInt(parts[1], 10);
        if (entryYear !== year) return;
        // Find index in monthOrder
        const idx = monthOrder.findIndex(m => m.full.toLowerCase().startsWith(monthName.toLowerCase()) || m.short.toLowerCase() === monthName.toLowerCase());
        if (idx >= 0) {
          result[idx].posts = entry.count;
        }
      });
    }

    return result;
  };

  const handleYearChange = (event: any) => {
    setSelectedYear(event.target.value);
  };

  // handleOpenDialog removed (navigates to pages now)

  const handleCloseDialog = () => {
    setOpenDialog(null);
  };
  

  // Function to load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setEdaStatus('checking');
      setLoading(true);
      setError(null);
      
      // Fetch EDA data if user is logged in
      if (user?.id) {
        try {
          // Pass username hint if available; backend will auto-detect when absent
          const usernameHint = user?.username || (user?.email && user.email.split('@')[0]);
          const data = await apiClient.getEdaDashboardStats(user.id, usernameHint as string);
          // --- Robust EDA posts extraction for HeatmapMap ---
          // 1. Try data.posts (raw posts)
          // 2. Try data.heatmap.topLocations (aggregated)
          // 3. Try data.statistics.locations (aggregated)
          // 4. Fallback: empty array
          let posts = [];
          if (Array.isArray(data.posts) && data.posts.length > 0) {
            posts = data.posts.filter((p: any) => p.post_location);
          } else if (Array.isArray(data.heatmap?.topLocations) && data.heatmap.topLocations.length > 0) {
            posts = data.heatmap.topLocations.map((loc: any) => ({ post_location: loc.name, count: loc.count }));
          } else if (Array.isArray(data.statistics?.locations) && data.statistics.locations.length > 0) {
            posts = data.statistics.locations.map((loc: any) => ({ post_location: loc.name, count: loc.count }));
          }
          // Always set posts array for HeatmapMap
          setEdaData({ ...data, posts });
          setEdaStatus('done');
          
          // Set dashboard data from EDA
          setDashboardData({
            totalPosts: data.statistics.totalPosts,
            engagement: '2.4K',
            sentiment: '85%',
            activeHours: '6.2h',
          });
        } catch (edaError: any) {
          console.error('EDA data fetch failed:', edaError);
          // If backend said no file, explicitly mark no-data
          const msg = edaError && edaError.message ? String(edaError.message) : String(edaError || '');
          if (msg.toLowerCase().includes('eda file not found') || msg.includes('404')) {
            setEdaStatus('no-data');
          } else {
            setEdaStatus('no-data');
          }
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
  }, [user?.id, user?.email, user?.username]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    // EDA file listing removed
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Prepare chart data: use real monthly data when available, otherwise fallback to static sample values
  const monthlyRaw = getMonthlyData(selectedYear);
  const _hasMonthlyData = Array.isArray(monthlyRaw) && monthlyRaw.some(m => (m.posts || 0) > 0);
  const sampleMonthly = [
    { month: 'Jan', posts: 8 },
    { month: 'Feb', posts: 12 },
    { month: 'Mar', posts: 10 },
    { month: 'Apr', posts: 18 },
    { month: 'May', posts: 22 },
    { month: 'Jun', posts: 16 },
    { month: 'Jul', posts: 12 },
    { month: 'Aug', posts: 14 },
    { month: 'Sep', posts: 9 },
    { month: 'Oct', posts: 6 },
    { month: 'Nov', posts: 10 },
    { month: 'Dec', posts: 13 },
  ];
  const chartData = _hasMonthlyData ? monthlyRaw.map(d => ({ name: d.month, posts: d.posts })) : sampleMonthly.map(d => ({ name: d.month, posts: d.posts }));
  const usingSample = !_hasMonthlyData;

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
        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
          {edaStatus === 'checking' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress sx={{ width: 160, height: 8, borderRadius: 8 }} color="secondary" />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Checking for analysis...</Typography>
            </Box>
          )}
          {edaStatus === 'no-data' && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>No EDA data available</Typography>
          )}
          {edaStatus === 'done' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress variant="determinate" value={100} sx={{ width: 160, height: 8, borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)' }} color="success" />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} />
                <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>Your analysis done</Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Three Column Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mb: 4, alignItems: 'stretch' }}>
        {/* Statistics Card - Small Preview */}
        <Box
          onClick={() => setOpenDialog('statistics')}
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
          onClick={() => setOpenDialog('engagement')}
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
                {((edaData?.engagement?.topEngagers?.slice(0, 2)) || [
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

        {/* EDA file listing removed */}

        {/* Clusters Card - Small Preview (MOVED TO RIGHT) */}
        <Box
          onClick={() => setOpenDialog('clusters')}
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
                {(edaData?.statistics?.yearlyData || []).map((yearData: any, idx: number) => (
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
                      {yearData.count} posts
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={handleCloseDialog} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              navigate('/statistics');
              handleCloseDialog();
            }}
            sx={{ ml: 1, textTransform: 'none' }}
          >
            Details
          </Button>
        </DialogActions>
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
            {ALL_CLUSTERS.map((cluster, index) => {
              const id = `cluster-${slugify(cluster)}`;
              const isHighlighted = selectedClusterInDialog === cluster;
              const color = PALETTE[index % PALETTE.length];
              return (
                <Box
                  id={id}
                  key={index}
                  onClick={() => {
                    // If clicked, open/expand in main list if present
                    const match = activityClusters.find(ac => ac.name.replace(/\s+►|➤/g, '').toLowerCase() === cluster.toLowerCase());
                    if (match) {
                      setOpenDialog(null);
                      setExpandedCluster(match.name);
                    } else {
                      // keep the dialog open but briefly highlight
                      setSelectedClusterInDialog(cluster);
                    }
                  }}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: isHighlighted ? `${color}22` : 'rgba(255, 255, 255, 0.08)',
                    border: isHighlighted ? `1px solid ${color}55` : '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 4px 14px ${color}55`,
                      border: '2px solid rgba(255,255,255,0.18)'
                    }}
                  />
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600 }}>
                    {cluster}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={handleCloseDialog} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              navigate('/clusters', { state: { highlight: selectedClusterInDialog || undefined } });
              handleCloseDialog();
            }}
            sx={{ ml: 1, textTransform: 'none' }}
          >
            Details
          </Button>
        </DialogActions>
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={handleCloseDialog} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              navigate('/engagement');
              handleCloseDialog();
            }}
            sx={{ ml: 1, textTransform: 'none' }}
          >
            Details
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activity Clusters */}
      <Box sx={{ mb: 4 }}>
        <GlassCard gradient="linear-gradient(135deg, rgba(139, 92, 246, 0.6) 0%, rgba(236, 72, 153, 0.5) 100%)">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA' }}>
                📊 Activity Clusters
              </Typography>
              <Button
                variant="contained"
                onClick={() => setClusterCloudOpen(true)}
                sx={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(236,72,153,0.9))',
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                }}
              >
                ClusterCloud
              </Button>
            </Box>
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

      {/* Moods (stacked above Red Flags, full-width like Activity Clusters) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr' }, gap: 3, mb: 4, alignItems: 'stretch' }}>
        {/* Moods */}
        <Box>
          <GlassCard gradient="linear-gradient(135deg, rgba(16, 185, 129, 0.55) 0%, rgba(6, 182, 212, 0.5) 100%)">
          <CardContent sx={{ minHeight: '280px' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA', mb: 3 }}>
              📈 Monthly Activity Trend
            </Typography>
            {/* Monthly posts / engagement chart (replaces the moods list) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ color: '#C9CED6' }}>Monthly posts — {selectedYear}</Typography>
                <FormControl size="small">
                  <Select
                    value={selectedYear}
                    onChange={handleYearChange}
                    sx={{
                      color: '#fff',
                      background: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: 1,
                      minWidth: 100,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' },
                    }}
                  >
                    {years.map((year) => (
                      <MenuItem key={year} value={year}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ height: { xs: 140, md: 180 }, borderRadius: 2, p: 1, background: 'linear-gradient(135deg, #041224 0%, #08315a 40%, #0b2840 100%)', boxShadow: 'inset 0 4px 30px rgba(0,0,0,0.35)', backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0 2px, transparent 2px 6px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#C9CED6', fontSize: 12 }} axisLine={false} />
                    <YAxis tick={{ fill: '#C9CED6', fontSize: 12 }} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(8,16,30,0.95)', borderRadius: 8, border: 'none' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} formatter={(value: any) => [value, 'Posts']} />
                    <Area type="monotone" dataKey="posts" stroke="#34d399" fill="url(#colorPosts)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
              {usingSample && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Showing sample data for preview</Typography>
              )}

              <Typography variant="caption" sx={{ color: '#C9CED6' }}>Shows monthly posting activity (use the year selector to change the view).</Typography>
            </Box>
          </CardContent>
          </GlassCard>
        </Box>

        {/* Red Flags (full-width, red background like original) */}
        <Box>
          <GlassCard gradient="linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(245, 101, 101, 0.7) 60%, rgba(251,146,60,0.55) 100%)" priority={true}>
          <CardContent sx={{ minHeight: '280px' }}>
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
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.12)'
                    },
                  }}
                >
                  <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.12)' }}>
                    <Typography sx={{ fontSize: '1.2rem' }}>{flag.toLowerCase().includes('alcohol') ? '🍺' : '🚨'}</Typography>
                  </Box>
                  <Typography sx={{ color: '#F5F7FA', fontWeight: 700 }}>{flag}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
          </GlassCard>
        </Box>
      </Box>

      {/* Location Heatmap (deck.gl) */}
      <GlassCard priority={true}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#F5F7FA', mb: 0.5 }}>
                📍 Activity Locations Heatmap (OpenStreetMap)
              </Typography>
              <Typography variant="body2" sx={{ color: '#C9CED6' }}>
                Shows where your child is most active based on post locations. Powered by OpenStreetMap for accurate, free, and up-to-date mapping.
              </Typography>
            </Box>
          </Box>
            <Box sx={{ height: 600, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <HeatmapMap width="100%" height={600} edaData={edaData} />
          </Box>
        </CardContent>
      </GlassCard>
      {/* Cluster Cloud Dialog */}
      <Dialog
        open={clusterCloudOpen}
        onClose={() => setClusterCloudOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(180deg, rgba(18,18,20,0.95), rgba(30,30,45,0.9))',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            ☁️ ClusterCloud
          </Typography>
          <IconButton onClick={() => setClusterCloudOpen(false)} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
            A quick visual view of all clusters. Click any cluster to open its details in the list.
          </Typography>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 2 }}>
            <Box
              sx={{
                width: { xs: '100%', md: '70%' },
                maxWidth: 980,
                background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
                borderRadius: 4,
                p: { xs: 2, md: 3 },
                boxShadow: '0 20px 40px rgba(3, 10, 18, 0.45)',
                border: '1px solid rgba(0,0,0,0.06)',
                mx: 'auto',
              }}
            >
              <div style={{ width: '100%', height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <WordCloud
                  words={cloudWordsAll}
                  options={{
                    rotations: 1,
                    rotationAngles: [0, 0],
                    fontSizes: [14, 140],
                    fontFamily: 'Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
                    enableTooltip: true,
                    deterministic: true,
                    scale: 'sqrt',
                    padding: 0,
                    spiral: 'archimedean',
                    // use palette so words are colored vibrantly
                    colors: PALETTE,
                  }}
                  callbacks={{
                    onWordClick: (word: any) => {
                      const text: string = (word as any).text;
                      const match = activityClusters.find(ac => ac.name.replace(/\s+►|➤/g, '').toLowerCase() === text.toLowerCase());
                      if (match) {
                        setExpandedCluster(match.name);
                        setClusterCloudOpen(false);
                        return;
                      }
                      setClusterCloudOpen(false);
                      navigate('/clusters', { state: { highlight: text } });
                      setSelectedClusterInDialog(text);
                    },
                    // color words by matching 'color' property if present
                    getWordColor: (word: any) => (word.color ? word.color : PALETTE[Math.abs(hashCode(word.text)) % PALETTE.length]),
                  }}
                />
              </div>
            </Box>
          </Box>
          {/* removed tip line per design request */}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
