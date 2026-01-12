import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Facebook,
  Twitter,
  Reddit,
  Refresh,
  Delete,
  CheckCircle,
} from '@mui/icons-material';
import { apiClient, getApiBaseUrl } from '../../services/apiClient';
import type {
  SocialAccount,
  OAuthAccountsResponse,
  OAuthConnectResponse
} from '../../types/api';

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
    } catch (err: any) {
      console.error('Error loading accounts:', err);
      setError('Failed to load connected accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleOAuthCallback = async () => {
      await loadAccounts();

      // Debug: Log current URL and all parameters
      console.log('🌐 Current page URL:', window.location.href);
      console.log('🌐 Search params:', window.location.search);
      console.log('🌐 Hash:', window.location.hash);

      // Check for Auth0 callback (from URL parameters after backend redirect)
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const error = urlParams.get('error');
      const platform = urlParams.get('platform');

      // If the OAuth callback contains success/code but the user is not authenticated,
      // redirect to the auth page so the user can sign in (and then view connected accounts).
      const token = localStorage.getItem('access_token');
      if (!token && (urlParams.get('success') || urlParams.get('code') || searchParams.get('code'))) {
        navigate('/');
        return;
      }

      // If backend provided a token in the redirect (after OAuth), capture it and set auth
      const tokenFromUrl = urlParams.get('token') || searchParams.get('token');
      if (tokenFromUrl) {
        try {
          localStorage.setItem('access_token', tokenFromUrl);
          apiClient.setToken(tokenFromUrl);
          // Refresh accounts and user state
          await loadAccounts();
        } catch (err) {
          console.error('Failed to set token from OAuth redirect:', err);
        }
        // Remove the token from the URL to avoid leaking it in history
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete('token');
        const newUrl = window.location.pathname + (cleanParams.toString() ? `?${cleanParams.toString()}` : '');
        window.history.replaceState({}, document.title, newUrl);
      }

      // Handle success/error from backend redirect
      if ((success === 'true' || error) && platform) {
        if (success === 'true') {
          const username = urlParams.get('username');
          const message = username
            ? `${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully as @${username}!`
            : `${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully!`;
          setSuccessMessage(message);
          await loadAccounts();
        } else if (error) {
          setError(`Failed to connect ${platform}: ${urlParams.get('details') || error}`);
        }

        // Clean up URL parameters
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        return;
      }

      // Handle regular OAuth callback
      const errorParam = searchParams.get('error');
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const successParam = searchParams.get('success');
      const platformParam = searchParams.get('platform');

      // Add detailed logging for debugging
      const allParams = Object.fromEntries(searchParams.entries());
      console.log('🔍 All URL parameters:', allParams);
      console.log('🔍 OAuth callback detected:', {
        success: successParam,
        error: errorParam,
        platform: platformParam,
        code: code,
        state: state,
        currentURL: window.location.href
      });

      // Handle direct OAuth callback (if app redirects directly to frontend)
      if (code && state && !successParam && !errorParam) {
        console.log('Direct OAuth callback detected, redirecting to backend');
        // Redirect to backend callback endpoint
        const backendUrl = getApiBaseUrl().replace('/api/v1', '');
        window.location.href = `${backendUrl}/api/v1/oauth/${platformParam || 'twitter'}/callback?code=${code}&state=${state}`;
        return;
      }

      if (successParam === 'true' && platformParam) {
        // OAuth successful
        console.log(`OAuth success for ${platformParam}, refreshing accounts...`);
        await loadAccounts(); // Refresh accounts
        const username = searchParams.get('username');
        const message = username
          ? `${platformParam.charAt(0).toUpperCase() + platformParam.slice(1)} connected successfully as @${username}!`
          : `${platformParam.charAt(0).toUpperCase() + platformParam.slice(1)} connected successfully!`;
        setSuccessMessage(message);
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('URL params cleared, staying on social-accounts page');
      } else if (errorParam && platformParam) {
        // OAuth failed
        console.log(`OAuth error for ${platformParam}: ${errorParam}`);
        setError('Failed to connect');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleOAuthCallback();
  }, [searchParams]);

  const handleConnect = (platform: string) => {
    setConnecting(platform);
    setError(null);
    // For Facebook, redirect directly to backend OAuth endpoint
    if (platform === 'facebook') {
      window.location.href = `${getApiBaseUrl()}/api/oauth/connect/facebook`;
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
                            label={`Connected as ${account.username}`}
                            color="success"
                            size="small"
                            icon={<CheckCircle />}
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Last sync: {account.last_sync ? new Date(account.last_sync).toLocaleString() : 'Never'}
                          </Typography>
                          {account.platform === 'reddit' && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Posts: {account.posts_count || 0} | Comments: {account.comments_count || 0} | Saved: {account.saved_count || 0}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Upvoted: {account.upvoted_count || 0} | Downvoted: {account.downvoted_count || 0} | Hidden: {account.hidden_count || 0}
                              </Typography>
                            </Box>
                          )}
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
