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

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

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

const GlassCard: React.FC<{ children: React.ReactNode; gradient?: string }> = ({ children, gradient }) => {
  return (
    <Card
      sx={{
        background: gradient || 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s ease',
        width: '100%',
        flex: 1,
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 40px rgba(139, 92, 246, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.4)',
        },
      }}
    >
      {children}
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAvatar] = useState(localStorage.getItem('userAvatar') || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4');
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<string | null>(null);

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
      // Use mock data for now since backend endpoint doesn't exist yet
      const mockStats = {
        totalPosts: 847,
        engagement: '2.4K',
        sentiment: '85%',
        activeHours: '6.2h',
      };
      setDashboardData(mockStats);
    } catch (err) {
      console.log('Using mock data');
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
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
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
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #5b21b6 75%, #6d28d9 100%)',
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
              fontWeight: 800, 
              color: '#fff',
              mb: 0.5,
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            Welcome Back! 👋
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.8)',
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
              transform: 'scale(1.03)',
            },
          }}
        >
          <GlassCard gradient="linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%)">
            <CardContent sx={{ display: 'flex', flexDirection: 'column', minHeight: '280px', width: '100%' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                📊 Statistics
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2, fontSize: '0.9rem' }}>
                Overview of key metrics and activities
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.08)' }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    📝 Total Posts: <strong style={{ color: '#fff' }}>847</strong>
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.08)' }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    📍 Locations: <strong style={{ color: '#fff' }}>3 cities</strong>
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: '#8b5cf6', textAlign: 'center', mt: 1, fontWeight: 600 }}>
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
              transform: 'scale(1.03)',
            },
          }}
        >
          <GlassCard gradient="linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.2) 100%)">
            <CardContent sx={{ display: 'flex', flexDirection: 'column', minHeight: '280px', width: '100%' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                👥 Overall Engagement
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2, fontSize: '0.9rem' }}>
                Top engagers and their interaction levels
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                {[
                  { name: 'Vibhor', engagement: 14 },
                  { name: 'Ravi Saxena', engagement: 11 },
                ].map((person, index) => (
                  <Box key={index} sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#fff', fontSize: '0.85rem' }}>
                      {person.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 700 }}>
                      {person.engagement}
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: '#10b981', textAlign: 'center', mt: 1, fontWeight: 600 }}>
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
              transform: 'scale(1.03)',
            },
          }}
        >
          <GlassCard gradient="linear-gradient(135deg, rgba(236, 72, 153, 0.3) 0%, rgba(219, 39, 119, 0.2) 100%)">
            <CardContent sx={{ display: 'flex', flexDirection: 'column', minHeight: '280px', width: '100%' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                🎯 Clusters
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2, fontSize: '0.9rem' }}>
                Content categories and themes
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                {[
                  'Humor & Entertainment',
                  'Travel & Destinations',
                ].map((cluster, index) => (
                  <Box key={index} sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899' }} />
                    <Typography variant="body2" sx={{ color: '#fff', fontSize: '0.85rem' }}>
                      {cluster}
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: '#ec4899', textAlign: 'center', mt: 1, fontWeight: 600 }}>
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
            Get a complete overview of your child's social media activity. See how many posts they've shared, where they're posting from, and who's engaging most with their content. This helps you understand their online presence and social connections.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {[
              { label: 'Total Posts', value: '847', icon: '📝' },
              { label: 'Locations', value: 'Delhi, Mumbai, Ludhiana', icon: '📍' },
              { label: 'Most Liked By', value: 'Vibhor (142 likes)', icon: '❤️' },
              { label: 'Most Commented By', value: 'Ravi Saxena (89 comments)', icon: '💬' },
              { label: 'Most Shared By', value: 'Neelam Rawat (56 shares)', icon: '🔄' },
            ].map((stat, index) => (
              <Box
                key={index}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                  <Typography sx={{ fontSize: '1.5rem' }}>{stat.icon}</Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                    {stat.label}
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, pl: 5.5 }}>
                  {stat.value}
                </Typography>
              </Box>
            ))}
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
            {[
              { name: 'Vibhor', engagement: 14 },
              { name: 'Ravi Saxena', engagement: 11 },
              { name: 'Neelam Rawat', engagement: 7 },
              { name: 'Priya Sharma', engagement: 9 },
              { name: 'Amit Kumar', engagement: 6 },
              { name: 'Sonia Verma', engagement: 8 },
              { name: 'Rahul Singh', engagement: 5 },
              { name: 'Pooja Gupta', engagement: 7 },
              { name: 'Karan Malhotra', engagement: 4 },
              { name: 'Anjali Reddy', engagement: 6 },
            ].map((person, index) => (
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
                  {person.engagement}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Activity Clusters */}
      <Box sx={{ mb: 4 }}>
        <GlassCard gradient="linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.2) 100%)">
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 3 }}>
              📊 Activity Clusters
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              {activityClusters.map((cluster, index) => {
                const gradients = [
                  'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)',
                  'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(219, 39, 119, 0.1) 100%)',
                  'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
                  'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)',
                ];
                const hoverGradients = [
                  'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%)',
                  'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(219, 39, 119, 0.15) 100%)',
                  'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.15) 100%)',
                  'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.15) 100%)',
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
                        boxShadow: '0 8px 16px rgba(139, 92, 246, 0.2)',
                      },
                    }}
                  >
                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600 }}>
                      {cluster.name}
                    </Typography>
                    {expandedCluster === cluster.name ? <ExpandLessIcon sx={{ color: '#a78bfa' }} /> : <ExpandMoreIcon sx={{ color: '#a78bfa' }} />}
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
        <GlassCard gradient="linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 182, 212, 0.2) 100%)">
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 3 }}>
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
                      <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600 }}>
                        {mood.label}
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ color: mood.color, fontWeight: 700 }}>
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
        <GlassCard gradient="linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(251, 146, 60, 0.2) 100%)">
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 3 }}>
              🚨 Red Flags
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {redFlags.map((flag, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Typography sx={{ fontSize: '1.5rem' }}>
                    {flag.toLowerCase().includes('alcohol') ? '🍺' : '🚨'}
                  </Typography>
                  <Typography sx={{ color: '#fff', fontWeight: 500 }}>{flag}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </GlassCard>
      </Box>

      {/* Location Heatmap */}
      <GlassCard>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 2 }}>
            📍 Activity Locations Heatmap
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2 }}>
            Shows where your child is most active based on post locations
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: '#ff0000' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                High activity: New Delhi, Mumbai
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: '#ffaa00' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Moderate activity: Ludhiana
              </Typography>
            </Box>
          </Box>
          <Box sx={{ height: 400, borderRadius: 2, overflow: 'hidden' }}>
            <MapContainer
              center={[26, 76]}
              zoom={5}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {locationPoints.map((location, idx) => {
                const getColor = (intensity: number) => {
                  if (intensity >= 0.8) return '#ff0000';
                  if (intensity >= 0.6) return '#ff6600';
                  return '#ffaa00';
                };
                
                return (
                  <Circle
                    key={idx}
                    center={[location.lat, location.lng]}
                    radius={location.intensity * 50000}
                    pathOptions={{
                      fillColor: getColor(location.intensity),
                      fillOpacity: 0.5,
                      color: getColor(location.intensity),
                      weight: 2,
                      opacity: 0.7,
                    }}
                  >
                    <MapTooltip>
                      Activity intensity: {Math.round(location.intensity * 100)}%
                    </MapTooltip>
                  </Circle>
                );
              })}
            </MapContainer>
          </Box>
        </CardContent>
      </GlassCard>
    </Box>
  );
};

export default Dashboard;
