/* eslint-disable unicode-bom */
/* Social accounts OAuth view */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Facebook, Refresh, Delete, CheckCircle } from '@mui/icons-material';
import { apiClient, getApiBaseUrl } from '../../services/apiClient';
import type { SocialAccount, OAuthAccountsResponse } from '../../types/api';

const SocialAccountsOAuthView: React.FC = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const platformIcons: Record<string, React.ReactElement> = {
    facebook: <Facebook sx={{ color: '#1877F2' }} />,
  };

  const platformNames: Record<string, string> = {
    facebook: 'Facebook',
  };

  const platformDescriptions: Record<string, string> = {
    facebook: 'OAuth authentication',
  };

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<OAuthAccountsResponse>('/oauth/accounts');
      setAccounts(response.data.accounts || []);
      setError(null); // Clear any previous errors on success
    } catch (err: any) {
      console.error('Error loading accounts:', err);
      // Only set error if it's not a 401 (unauthorized) or if accounts were expected
      if (err.response?.status !== 401) {
        // Don't show error by default, only on actual failures
        console.log('Could not load accounts:', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // use searchParams for callback query params (avoid double-parsing)

      const errorParam = searchParams.get('error');
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const successParam = searchParams.get('success');
      const platformParam = searchParams.get('platform');
      const tokenParam = searchParams.get('token');

      // If there's a token in the URL, save it to localStorage
      if (tokenParam) {
        localStorage.setItem('access_token', tokenParam);
        // Trigger auth context refresh
        window.dispatchEvent(new Event('auth:token_set'));
      }

      // Handle direct OAuth callback (if app redirects directly to frontend)
      if (code && state && !successParam && !errorParam) {
        console.log('Direct OAuth callback detected, redirecting to backend');
        // Redirect to backend callback endpoint
        const backendUrl = getApiBaseUrl().replace('/api/v1', '');
        window.location.href = `${backendUrl}/api/v1/oauth/${platformParam || 'twitter'}/callback?code=${code}&state=${state}`;
        return;
      }

      if (successParam === 'true' && platformParam) {
        // OAuth successful - load accounts first
        await loadAccounts();
        
        const username = searchParams.get('username');
        const message = username
          ? `${platformParam.charAt(0).toUpperCase() + platformParam.slice(1)} connected successfully as @${username}!`
          : `${platformParam.charAt(0).toUpperCase() + platformParam.slice(1)} connected successfully!`;
        setSuccessMessage(message);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
        
        // Clear URL params to stay on the same page
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('URL params cleared, staying on social-accounts page');
      } else if (errorParam && platformParam) {
        // OAuth failed
        console.log(`OAuth error for ${platformParam}: ${errorParam}`);
        setError(`Failed to connect ${platformParam}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // No OAuth callback, just load accounts normally
        await loadAccounts();
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  const handleConnect = (platform: string) => {
    setConnecting(platform);
    setError(null);
    // For Facebook, redirect directly to backend OAuth endpoint with token
    if (platform === 'facebook') {
      const token = localStorage.getItem('access_token');
      const url = token 
        ? `${getApiBaseUrl()}/oauth/facebook?token=${encodeURIComponent(token)}`
        : `${getApiBaseUrl()}/oauth/facebook`;
      window.location.href = url;
      return;
    }
    // ...existing code for other platforms if needed...
  };

  const handleDisconnect = async (platform: string) => {
    try {
      setDisconnecting(platform);
      setError(null);

      // Map frontend platform names to backend API names
      await apiClient.delete(`/oauth/disconnect/${platform}`);

      // Refresh accounts after disconnect
      await loadAccounts();
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      setError(err.response?.data?.detail || 'Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  const getAccountInfo = (platform: string) => {
    return accounts.find(account => account.platform === platform);
  };

  const isConnected = (platform: string) => {
    return accounts.some(account => account.platform === platform);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Social Media Accounts
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Connect your social media accounts to collect and analyze data from your profiles.
        All connections use secure OAuth authentication.
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

      <Box sx={{ display: 'grid', gap: 3 }}>
        {Object.entries(platformNames).map(([platform, name]) => {
          const account = getAccountInfo(platform);
          const connected = isConnected(platform);
          const isConnecting = connecting === platform;
          const isDisconnecting = disconnecting === platform;

          return (
            <Card key={platform} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {platformIcons[platform]}
                    <Box>
                      <Typography variant="h6">{name}</Typography>
                      {connected && account ? (
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            label="Connected"
                            color="success"
                            size="small"
                            icon={<CheckCircle />}
                          />
                          {account.username && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {account.username} {account.email && `(${account.email})`}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Connected: {account.connected_at ? new Date(account.connected_at).toLocaleString() : 'Recently'}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not connected
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {connected ? (
                      <>
                        <Button
                          variant="outlined"
                          startIcon={<Refresh />}
                          onClick={() => loadAccounts()}
                          disabled={loading}
                        >
                          Refresh
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<Delete />}
                          onClick={() => handleDisconnect(platform)}
                          disabled={isDisconnecting}
                        >
                          {isDisconnecting ? <CircularProgress size={20} /> : 'Disconnect'}
                        </Button>
                      </>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {platformDescriptions[platform]}
                        </Typography>
                        <Button
                          variant="contained"
                          onClick={() => handleConnect(platform)}
                          disabled={isConnecting}
                          size="small"
                        >
                          {isConnecting ? <CircularProgress size={16} /> : 'Connect with OAuth'}
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* Note removed as requested */}
    </Box>
  );
};

export default SocialAccountsOAuthView;
