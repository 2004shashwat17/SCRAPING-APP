/**
 * Data Collection Status Component
 * Shows a simple status message instead of technical collection details
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Alert,
  Paper,
  useTheme,
  keyframes,
  Button,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonChecked,
  CloudSync,
  Dataset,
  Security,
  Logout,
  Warning,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';

interface DataCollectionStatusProps {}

const DataCollectionStatus: React.FC<DataCollectionStatusProps> = () => {
  const theme = useTheme();
  const { logout, user } = useAuth();
  const [collectingData, setCollectingData] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [collectionResults, setCollectionResults] = useState<any>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [warnings, setWarnings] = useState<any[]>([]);

  // Pulse animation keyframe
  const pulse = keyframes`
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  `;

  // Handle logout
  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      await logout();
      setLogoutDialogOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
      setLogoutDialogOpen(false);
    }
  };

  const handleLogoutCancel = () => {
    setLogoutDialogOpen(false);
  };

  // Handle data collection
  const handleStartDataCollection = async () => {
    try {
      setIsCollecting(true);
      setCollectingData(true);
      setProgress(0);
      setWarnings([]);
      
      // Start data collection
      const response = await apiClient.triggerDataCollection();
      console.log('Data collection started:', response);
      
      // Store results and warnings
      setCollectionResults(response);
      if (response.warnings) {
        setWarnings(response.warnings);
      }
      
      // Progress will be handled by useEffect
      
    } catch (error) {
      console.error('Failed to start data collection:', error);
      setIsCollecting(false);
      setCollectingData(false);
      setProgress(0);
    }
  };

  // Simulate data collection progress only when collecting
  useEffect(() => {
    if (!collectingData) return;
    
    const timer = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          setCollectingData(false);
          setIsCollecting(false);
          return 100;
        }
        return prevProgress + Math.random() * 10;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [collectingData]);

  const getPermissions = () => {
    const permissions = localStorage.getItem('socialMediaPermissions');
    return permissions ? JSON.parse(permissions) : {};
  };

  const permissions = getPermissions();
  const enabledPlatforms = Object.entries(permissions)
    .filter(([_, enabled]) => enabled)
    .map(([platform, _]) => platform);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0, fontWeight: 700 }}>
          Data Collection Status
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {user && (
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              Welcome, {user.username}
            </Typography>
          )}
          {/* Desktop logout button */}
          <Button
            variant="outlined"
            color="error"
            startIcon={<Logout />}
            onClick={handleLogoutClick}
            sx={{ 
              display: { xs: 'none', sm: 'flex' },
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: theme.palette.error.light,
                color: 'white',
              }
            }}
          >
            Logout
          </Button>
          {/* Mobile logout button */}
          <IconButton
            color="error"
            onClick={handleLogoutClick}
            sx={{ 
              display: { xs: 'flex', sm: 'none' },
              '&:hover': {
                backgroundColor: theme.palette.error.light,
                color: 'white',
              }
            }}
            title="Logout"
          >
            <Logout />
          </IconButton>
        </Box>
      </Box>

      <Alert 
        severity="info" 
        sx={{ mb: 3 }}
        icon={<Security />}
      >
        <Typography variant="body1">
          <strong>Privacy Protected:</strong> We only collect and analyze publicly available data 
          to identify potential security threats and vulnerabilities in your digital footprint.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Collection Status Card */}
          <Box sx={{ flex: { md: 2 } }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CloudSync 
                    sx={{ 
                      mr: 2, 
                    color: collectingData ? theme.palette.primary.main : theme.palette.success.main,
                    animation: collectingData ? `${pulse} 2s infinite` : 'none',
                  }} 
                />
                <Typography variant="h6">
                  {collectingData ? 'Data Collection in Progress' : 'Data Collection Complete'}
                </Typography>
              </Box>

              {collectingData ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Scanning social media platforms for potential threats and vulnerabilities...
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={progress} 
                    sx={{ mb: 2, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(progress)}% Complete
                  </Typography>
                </>
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Latest scan completed successfully. Monitoring continues in real-time.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip 
                      icon={<CheckCircle />} 
                      label="Active Monitoring" 
                      color="success" 
                      variant="outlined"
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      onClick={handleStartDataCollection}
                      disabled={isCollecting || collectingData}
                      startIcon={<CloudSync />}
                      sx={{ textTransform: 'none' }}
                    >
                      {isCollecting || collectingData ? 'Collecting...' : 'Start Data Collection'}
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
          </Box>

          {/* Monitored Platforms Card */}
          <Box sx={{ flex: { md: 1 } }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Dataset sx={{ mr: 2, color: theme.palette.primary.main }} />
                  <Typography variant="h6">Monitored Platforms</Typography>
                </Box>

                {enabledPlatforms.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {enabledPlatforms.map((platform) => (
                      <Box key={platform} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RadioButtonChecked 
                        sx={{ color: theme.palette.success.main, fontSize: 16 }} 
                      />
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {platform}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No platforms selected for monitoring.
                  Visit Settings to configure data sources.
                </Typography>
              )}
            </CardContent>
          </Card>
          </Box>
        </Box>

        {/* Data Collection Warnings */}
        {warnings.length > 0 && (
          <Box>
            {warnings.map((warning, index) => (
              <Alert 
                key={index}
                severity="warning" 
                sx={{ mb: 2 }}
                icon={<Warning />}
              >
                <Typography variant="body1">
                  <strong>{warning.platform.charAt(0).toUpperCase() + warning.platform.slice(1)} Data Collection Limited:</strong> {warning.message}
                </Typography>
                {warning.recommendation && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Recommendation:</strong> {warning.recommendation}
                  </Typography>
                )}
              </Alert>
            ))}
          </Box>
        )}

        {/* Collection Metrics */}
        <Box>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Collection Summary
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, textAlign: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary.main">
                    {collectingData ? Math.round(progress * 10) : '1,247'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Data Points Analyzed
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {collectingData ? Math.round(progress / 10) : '23'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Potential Issues Found
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {collectingData ? Math.round(progress / 20) : '8'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Trends Identified
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={handleLogoutCancel}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
      >
        <DialogTitle id="logout-dialog-title">
          Confirm Logout
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="logout-dialog-description">
            Are you sure you want to logout? You will need to login again to access the platform.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLogoutCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleLogoutConfirm} color="error" variant="contained">
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataCollectionStatus;