/**
 * Social Media Permission Modal Component
 * Requests user permission to access their social media data for OSINT analysis
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Shield,
  Lock,
  Facebook,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import apiClient from '../../services/apiClient';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: theme.spacing(2),
    maxWidth: 600,
    width: '100%',
    margin: theme.spacing(2),
  },
}));

const PlatformCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  border: `1px solid ${theme.palette.divider}`,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

interface SocialPlatform {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  enabled: boolean;
}

interface PermissionModalProps {
  open: boolean;
  onClose: () => void;
  onPermissionGranted: (permissions: { [key: string]: boolean }) => void;
}

const SocialMediaPermissionModal: React.FC<PermissionModalProps> = ({
  open,
  onClose,
  onPermissionGranted,
}) => {
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([
    {
      id: 'facebook',
      name: 'Facebook',
      icon: <Facebook size={24} color="#1877F2" />,
      description: 'Monitor public posts and trending topics',
      enabled: false,
    },
  ]);

  const handlePlatformToggle = (platformId: string) => {
    setPlatforms(prev =>
      prev.map(platform =>
        platform.id === platformId
          ? { ...platform, enabled: !platform.enabled }
          : platform
      )
    );
  };

  const handleGrantPermissions = async () => {
    if (!agreedToTerms) {
      return;
    }

    setLoading(true);

    // Convert to the format expected by the backend API
    const enabledPlatforms = platforms
      .filter(platform => platform.enabled)
      .map(platform => platform.id);

    // Keep the old format for localStorage compatibility
    const permissions = platforms.reduce((acc, platform) => {
      acc[platform.id] = platform.enabled;
      return acc;
    }, {} as { [key: string]: boolean });

    // Update localStorage for immediate UI feedback
    localStorage.setItem('socialMediaPermissions', JSON.stringify(permissions));
    localStorage.setItem('permissionsGranted', 'true');

    setLoading(false);
    onPermissionGranted(permissions);
    onClose();

    // Optionally, still try to call the backend, but don't block UI on it
    try {
      await apiClient.updatePermissions({ platforms: enabledPlatforms });
    } catch (error) {
      console.error('Error saving permissions:', error);
      // Optionally show an error message, but popup will close regardless
    }
  };

  const handleSkip = async () => {
    try {
      // Send empty platforms array to backend (no permissions granted)
      await apiClient.updatePermissions({ platforms: [] });
    } catch (error) {
      console.error('Error saving skip permissions:', error);
    }

    // Set default permissions for localStorage (all disabled)
    const permissions = platforms.reduce((acc, platform) => {
      acc[platform.id] = false;
      return acc;
    }, {} as { [key: string]: boolean });

    localStorage.setItem('socialMediaPermissions', JSON.stringify(permissions));
    localStorage.setItem('permissionsGranted', 'true');
    
    onPermissionGranted(permissions);
    onClose();
  };

  const enabledCount = platforms.filter(p => p.enabled).length;

  return (
    <StyledDialog open={open} onClose={() => {}} disableEscapeKeyDown>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Shield size={32} color="#1976d2" />
          <Box>
            <Typography variant="h5" component="h2" fontWeight="bold">
              OSINT Intelligence Access
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Configure your social media monitoring preferences
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Privacy First:</strong> We only analyze publicly available data to identify potential security threats and vulnerabilities in your digital footprint.
          </Typography>
        </Alert>

        <Typography variant="h6" gutterBottom>
          Select Platforms to Monitor:
        </Typography>

        <Box mb={2}>
          {platforms.map((platform) => (
            <PlatformCard key={platform.id} variant="outlined">
              <CardContent sx={{ py: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={2}>
                    {platform.icon}
                    <Box>
                      <Typography variant="h6">{platform.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {platform.description}
                      </Typography>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    {platform.enabled && (
                      <Chip
                        label="Enabled"
                        color="primary"
                        size="small"
                        icon={<CheckCircle size={16} />}
                      />
                    )}
                    <Checkbox
                      checked={platform.enabled}
                      onChange={() => handlePlatformToggle(platform.id)}
                      color="primary"
                    />
                  </Box>
                </Box>
              </CardContent>
            </PlatformCard>
          ))}
        </Box>

        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            What We Monitor:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <AlertTriangle size={20} color="#f57c00" />
              </ListItemIcon>
              <ListItemText
                primary="Potential security threats"
                secondary="Suspicious activity patterns"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Lock size={20} color="#4caf50" />
              </ListItemIcon>
              <ListItemText
                primary="Privacy vulnerabilities"
                secondary="Information exposure risks"
              />
            </ListItem>
          </List>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Typography variant="body2">
              I agree to the monitoring of my public social media data for security analysis purposes
            </Typography>
          }
        />
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={handleSkip} color="inherit">
          Skip for Now
        </Button>
        <Button
          onClick={handleGrantPermissions}
          variant="contained"
          disabled={!agreedToTerms || loading}
          startIcon={loading ? <CircularProgress size={20} /> : <Shield size={20} />}
          sx={{
            background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)',
            },
          }}
        >
          {loading ? 'Configuring...' : `Grant Access${enabledCount > 0 ? ` (${enabledCount} platforms)` : ''}`}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default SocialMediaPermissionModal;