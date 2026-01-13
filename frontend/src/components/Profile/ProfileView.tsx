import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Facebook as FacebookIcon,
  AccountCircle as AccountCircleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';

interface SocialAccount {
  platform: string;
  username?: string;
  email?: string;
  connected_at: string;
}

interface OAuthAccountsResponse {
  accounts: SocialAccount[];
}

// Available avatar options from DiceBear Avatars (reliable, free, customizable)
const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Max&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver&backgroundColor=ffdfbf',
];

const ProfileView: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    localStorage.getItem('userAvatar') || AVATAR_OPTIONS[0]
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSocialAccounts();
  }, []);

  const loadSocialAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<OAuthAccountsResponse>('/oauth/accounts');
      setSocialAccounts(response.data.accounts || []);
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error('Error loading social accounts:', err);
      // Don't show error by default, only on actual failures
      if (err.response?.status !== 401) {
        console.log('Could not load social accounts:', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getFacebookAccount = () => {
    return socialAccounts.find(account => account.platform === 'facebook');
  };

  const handleAvatarChange = (avatar: string) => {
    setSelectedAvatar(avatar);
  };

  const handleSaveAvatar = () => {
    localStorage.setItem('userAvatar', selectedAvatar);
    setAvatarDialogOpen(false);
    setSuccessMessage('Avatar updated successfully!');
    setTimeout(() => setSuccessMessage(null), 3000);
    // Trigger a page refresh to update avatar everywhere
    window.dispatchEvent(new Event('avatarChanged'));
  };

  const InfoRow: React.FC<{ icon: React.ReactElement; label: string; value: string | undefined }> = ({ icon, label, value }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: 48,
        height: 48,
        borderRadius: '50%',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        color: 'primary.main',
        mr: 3,
      }}>
        {icon}
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
          {value || 'Not provided'}
        </Typography>
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const facebookAccount = getFacebookAccount();

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4, fontWeight: 700 }}>
        Profile
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Card 
        variant="outlined" 
        sx={{ 
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Header Section */}
        <Box 
          sx={{ 
            background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
            height: 120,
            position: 'relative',
          }}
        />
        
        <CardContent sx={{ pt: 0 }}>
          {/* Avatar with Edit Button */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 3, mt: -5 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={selectedAvatar}
                sx={{
                  width: 100,
                  height: 100,
                  backgroundColor: 'background.paper',
                  border: '4px solid',
                  borderColor: 'background.paper',
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                  boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
                }}
              >
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              <IconButton
                size="small"
                onClick={() => setAvatarDialogOpen(true)}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  width: 32,
                  height: 32,
                }}
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            <Box sx={{ ml: 3, mb: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                {user?.full_name || user?.username || 'User'}
              </Typography>
              <Chip 
                label="Active" 
                color="success" 
                size="small" 
                sx={{ fontSize: '0.75rem' }}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* User Information */}
          <Box>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Account Information
            </Typography>
            
            <Stack spacing={0} divider={<Divider />}>
              <InfoRow 
                icon={<AccountCircleIcon />} 
                label="Username" 
                value={user?.username} 
              />
              
              <InfoRow 
                icon={<PersonIcon />} 
                label="Full Name" 
                value={user?.full_name} 
              />
              
              <InfoRow 
                icon={<EmailIcon />} 
                label="Email Address" 
                value={user?.email} 
              />
            </Stack>
          </Box>

          {/* Connected Social Accounts */}
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Connected Social Accounts
            </Typography>
              
              {facebookAccount ? (
                <Stack spacing={0} divider={<Divider />}>
                  <InfoRow 
                    icon={<FacebookIcon sx={{ color: '#1877F2' }} />} 
                    label="Facebook Username" 
                    value={facebookAccount.username || 'Connected'} 
                  />
                  
                  {facebookAccount.email && (
                    <InfoRow 
                      icon={<EmailIcon sx={{ color: '#1877F2' }} />} 
                      label="Facebook Email" 
                      value={facebookAccount.email} 
                    />
                  )}
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(24, 119, 242, 0.1)',
                      color: '#1877F2',
                      mr: 3,
                    }}>
                      <FacebookIcon />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        Connected Since
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                        {new Date(facebookAccount.connected_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              ) : (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No social accounts connected yet. Go to Social Accounts page to connect.
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>

      {/* Avatar Selection Dialog */}
      <Dialog
        open={avatarDialogOpen}
        onClose={() => setAvatarDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Choose Your Avatar</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 2 }}>
            {AVATAR_OPTIONS.map((avatar, index) => (
              <Box
                key={index}
                onClick={() => handleAvatarChange(avatar)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 2,
                  padding: 1,
                  border: selectedAvatar === avatar ? '3px solid' : '2px solid',
                  borderColor: selectedAvatar === avatar ? 'primary.main' : 'divider',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'scale(1.05)',
                  },
                }}
              >
                <Avatar
                  src={avatar}
                  sx={{
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '1/1',
                  }}
                />
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAvatarDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveAvatar} variant="contained">
            Save Avatar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfileView;
