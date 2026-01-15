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
  CheckCircle,
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

// A simple inline SVG placeholder that prompts the user to "Choose avatar".
// Encoded as a data URL so it's always available offline and copyright-free.
const CHOOSE_AVATAR_SVG = encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'>
    <rect width='100%' height='100%' fill='#f3f4f6' rx='16' />
    <g transform='translate(32,32)'>
      <circle cx='96' cy='64' r='48' fill='#e5e7eb' />
      <rect x='32' y='128' width='128' height='24' rx='12' fill='#e5e7eb' />
      <text x='96' y='210' font-family='Segoe UI, Roboto, Arial' font-size='18' fill='#6b7280' text-anchor='middle'>Choose avatar</text>
    </g>
  </svg>
`);
const CHOOSE_AVATAR = `data:image/svg+xml;utf8,${CHOOSE_AVATAR_SVG}`;

const ProfileView: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  // Default to empty for new users so they see a "Choose avatar" prompt
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    // Priority: server avatar > local cached avatar > choose-avatar placeholder > first dicebear option
    user?.avatar || localStorage.getItem('userAvatar') || CHOOSE_AVATAR || AVATAR_OPTIONS[0]
  );
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [consents, setConsents] = useState<any[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(false);
  const [consentsError, setConsentsError] = useState<string | null>(null);

  useEffect(() => {
    loadSocialAccounts();
    loadConsents();
    // If this is a fresh login (no server avatar and no cached avatar), set the "Choose avatar" placeholder
    if (!user?.avatar && !localStorage.getItem('userAvatar')) {
      localStorage.setItem('userAvatar', CHOOSE_AVATAR);
      setSelectedAvatar(CHOOSE_AVATAR);
    }
  }, [user?.avatar]);

  const loadConsents = async () => {
    try {
      setLoadingConsents(true);
      setConsentsError(null);
      const resp = await apiClient.get<any>('/api/consent');
      setConsents(resp.data.consents || []);
    } catch (e: any) {
      console.error('Failed to load consents', e);
      setConsentsError(e.message || 'Failed to load consents');
    } finally {
      setLoadingConsents(false);
    }
  };

  const loadSocialAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<OAuthAccountsResponse>('/api/oauth/accounts');
      setSocialAccounts(response.data.accounts || []);
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error('Error loading social accounts:', err);
      // Don't show error by default, only on actual failures
      if (err.response?.status !== 401) {
        console.log('Could not load social accounts:', err.message || err);
        setError('Failed to load social accounts');
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
    setUploadedAvatar(null);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedAvatar(ev.target?.result as string);
        setSelectedAvatar(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAvatar = async () => {
    try {
      await apiClient.updateAvatar(selectedAvatar);
      setAvatarDialogOpen(false);
      setSuccessMessage('Avatar updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      // Trigger a page refresh to update avatar everywhere
      // Update local cache and notify listeners
      localStorage.setItem('userAvatar', selectedAvatar);
      window.dispatchEvent(new Event('avatarChanged'));
      // No full reload — AuthContext listens for 'avatarChanged' and will refresh user data
    } catch (err) {
      console.error('Failed to update avatar:', err);
      setError('Failed to update avatar');
    }
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

      {/* Consents panel */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Consent & Permissions</Typography>
        <Card sx={{ mb: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2">Recorded consents for your account</Typography>
              <Box>
                <Button size="small" onClick={loadConsents} disabled={loadingConsents}>
                  {loadingConsents ? 'Refreshing...' : 'Refresh'}
                </Button>
              </Box>
            </Box>
            {consentsError && <Alert severity="error">{consentsError}</Alert>}
            {!loadingConsents && consents.length === 0 && <Typography variant="body2">No consents recorded yet.</Typography>}
            {consents.map((c, idx) => (
              <Box key={idx} sx={{ p: 1, borderRadius: 1, background: 'rgba(0,0,0,0.03)', mb: 1 }}>
                <Typography variant="subtitle2">{c.username || 'You'} — {new Date(c.createdAt).toLocaleString()}</Typography>
                <Typography variant="body2">Platforms: {(c.platforms || []).join(', ') || 'None'}</Typography>
                <Typography variant="caption" color="text.secondary">Agreed: {c.agreedToTerms ? 'Yes' : 'No'}</Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>

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
              {/**
               * If the user has no avatar yet, show a "Choose" placeholder
               * rather than pre-populating a DiceBear avatar.
               */}
              <Avatar
                src={(user?.avatar || selectedAvatar) || undefined}
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
                { (user?.avatar || selectedAvatar || uploadedAvatar)
                  ? (user?.username?.charAt(0).toUpperCase() || 'U')
                  : 'Choose'
                }
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
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                      <Box>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          Facebook Account
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {facebookAccount.username || 'Connected'}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label="Connected"
                      color="success"
                      size="small"
                      icon={<CheckCircle />}
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  
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
            {/* Avatar options */}
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
            {/* Upload image option */}
            <Box sx={{ gridColumn: 'span 3', mt: 2, textAlign: 'center' }}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="avatar-upload-input"
                type="file"
                onChange={handleAvatarUpload}
              />
              <label htmlFor="avatar-upload-input">
                <Button variant="outlined" component="span">
                  Upload Image
                </Button>
              </label>
              {uploadedAvatar && (
                <Box mt={2}>
                  <Typography variant="caption" color="text.secondary">Preview:</Typography>
                  <Avatar src={uploadedAvatar} sx={{ width: 64, height: 64, mx: 'auto', mt: 1 }} />
                </Box>
              )}
            </Box>
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
