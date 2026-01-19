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
import Avatar from '@mui/material/Avatar';
import { apiClient, getApiBaseUrl } from '../../services/apiClient';
// Removed modal import — opening headful browser directly instead
import type { SocialAccount, OAuthAccountsResponse } from '../../types/api';

const SocialAccountsOAuthView: React.FC = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // removed unused capture modal state (headful flow opens browser directly)
  const [captureStatus, setCaptureStatus] = useState<'idle'|'pending'|'success'|'error'>('idle');
  const [facebookConnectedLocal, setFacebookConnectedLocal] = useState<boolean>(false);
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
      const response = await apiClient.get<OAuthAccountsResponse>('/api/oauth/accounts');
      setAccounts(response.data.accounts || []);
      setCurrentUser(response.data.user || null);
      // reset local connected override if server does not report connected
      const userAny = response.data.user as any;
      if (!userAny || !userAny.facebookConnected) setFacebookConnectedLocal(false);
      if (userAny && userAny.facebookConnected) setFacebookConnectedLocal(true);
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

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    setError(null);
    // For Facebook, redirect directly to backend OAuth endpoint with token
    if (platform === 'facebook') {
      const token = localStorage.getItem('access_token');
      // If there's no access token, don't attempt OAuth — prompt the user to login first.
      if (!token) {
        setError('Please login first before connecting Facebook');
        setConnecting(null);
        return;
      }
      // Verify token is still valid before redirecting
      try {
        await apiClient.getCurrentUser();
      } catch (e: any) {
        console.warn('Access token invalid or expired:', e?.message || e);
        setError('Your session appears to be expired. Please sign in again before connecting Facebook.');
        apiClient.setToken(null);
        localStorage.removeItem('access_token');
        setConnecting(null);
        return;
      }

      // Prefer an explicit deployed backend URL for OAuth redirects.
      // Sources (in order): localStorage `API_DEPLOYED_URL`, environment `REACT_APP_BACKEND_URL`, fallback to `getApiBaseUrl()`.
      const deployedOverride = (() => {
        try {
          const v = localStorage.getItem('API_DEPLOYED_URL');
          if (v) return v;
        } catch (e) {
          // ignore
        }
        if (process.env.REACT_APP_BACKEND_URL) return process.env.REACT_APP_BACKEND_URL;
        return null;
      })();

      const rawBase = deployedOverride || getApiBaseUrl();
      // Normalize base and ensure no trailing slash
      const baseUrl = rawBase.replace(/\/$/, '').replace(/\/api(\/v1)?$/, '');
      const url = token
        ? `${baseUrl}/api/oauth/facebook?token=${encodeURIComponent(token)}`
        : `${baseUrl}/api/oauth/facebook`;
      console.log('Redirecting to (Facebook OAuth):', url);
      window.location.href = url;
      return;
    }
    // ...existing code for other platforms if needed...
  };

  const handleDisconnect = async (platform: string) => {
    try {
      setDisconnecting(platform);
      setError(null);

      // Try primary disconnect endpoint
      const endpointPrimary = `/api/oauth/disconnect/${platform}`;
      const endpointFallback = `/api/v1/oauth/disconnect/${platform}`;
      try {
        // Helpful debug log
        console.log('Attempting disconnect at', endpointPrimary);
        await apiClient.delete(endpointPrimary);
      } catch (primaryErr: any) {
        // If primary failed with 404, try fallback
        if (primaryErr && primaryErr.message && primaryErr.message.includes('status: 404')) {
          console.warn('Primary disconnect endpoint returned 404, trying fallback', endpointFallback);
          await apiClient.delete(endpointFallback);
        } else {
          throw primaryErr;
        }
      }

      // Refresh accounts after disconnect
      await loadAccounts();
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  const openHeadfulBrowser = async () => {
    setCaptureStatus('pending');
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error('Not authenticated');
      const resp = await apiClient.post('/api/facebook/open-headful', { waitForFullSession: true });
      // resp.data should contain sessionId and message
      setCaptureStatus('pending');
      const sessionId = resp?.data?.sessionId;
      // show a brief message that headful opened
      setSuccessMessage(resp?.data?.message || 'Headful browser opened. Complete login in the window.');
      setTimeout(() => setSuccessMessage(null), 5000);

      // If we received a sessionId, poll the check-session endpoint until backend reports saved
      if (sessionId) {
        const start = Date.now();
        const timeoutMs = 10 * 60 * 1000; // 10 minutes max (matches server)
        let pollInterval = 2000; // 2s base
        while (Date.now() - start < timeoutMs) {
          let checkResp: any = null;
          try {
            checkResp = await apiClient.post('/api/facebook/check-session', { sessionId, waitMs: 0, postDetectWaitMs: 0, postCaptchaWaitMs: 0 });
            if (checkResp?.data?.status === 'ok') {
              // merge any returned user info immediately (but do NOT assume 'connected' unless the
              // server explicitly reports `user.facebookConnected`)
              if (checkResp.data.user) {
                setCurrentUser((prev: any) => prev ? { ...prev, ...checkResp.data.user } : checkResp.data.user);
              }
              // refresh accounts in background to ensure server-side state is consistent
              loadAccounts().catch(() => {});
              // Only set local connected override when the server explicitly reports the account as connected
              if (checkResp.data.user && checkResp.data.user.facebookConnected) {
                setFacebookConnectedLocal(true);
                setCaptureStatus('success');
                setSuccessMessage('Facebook analysis connected — cookies saved');
                setTimeout(() => setSuccessMessage(null), 5000);
                return;
              }
              // Otherwise, cookies were saved but the server did not mark the account connected.
              setCaptureStatus('success');
              setSuccessMessage('Cookies saved for analysis (not marked connected)');
              setTimeout(() => setSuccessMessage(null), 5000);
              return;
            } else if (checkResp?.data?.status === 'captcha_required') {
              setCaptureStatus('pending');
              setError('CAPTCHA detected. Please solve it in the opened browser window.');
            }
          } catch (e: any) {
            console.warn('check-session poll error', e?.message || e);
          }
          // if server suggested a retryAfterMs, use it; otherwise use exponential backoff up to 10s
          const suggested = (Array.isArray(checkResp?.data) ? null : checkResp?.data?.retryAfterMs) as number | undefined;
          if (suggested && Number.isFinite(suggested) && suggested > 0) {
            await new Promise(r => setTimeout(r, suggested));
            pollInterval = Math.max(2000, Math.min(10000, Math.floor(suggested)));
          } else {
            await new Promise(r => setTimeout(r, pollInterval));
            pollInterval = Math.min(10000, Math.floor(pollInterval * 1.5));
          }
        }
        // timed out
        setCaptureStatus('error');
        setError('Timed out waiting for session to be saved. Try again.');
        return;
      }
    } catch (err: any) {
      console.error('Failed to open headful browser', err);
      setError(err?.message || err?.data?.detail || 'Failed to open headful browser');
      setCaptureStatus('error');
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

      {/* User Info Card */}
      {currentUser && (
        <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={currentUser.avatar}
              sx={{
                width: 60,
                height: 60,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {currentUser.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {currentUser.username}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {accounts.length > 0 
                  ? `${accounts.length} social account${accounts.length > 1 ? 's' : ''} connected`
                  : 'No social accounts connected yet'}
              </Typography>
            </Box>
          </Box>
        </Card>
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
                        {/* Analysis button removed from inline actions to render as a separate card below */}
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

        {/* Facebook Analysis card - shown below the Facebook auth card */}
        {currentUser && (
          <Card variant="outlined" sx={{ mt: 0 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">Facebook Analysis</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {(facebookConnectedLocal || currentUser?.facebookConnected)
                      ? 'Connected — cookies saved'
                      : 'Not enabled. Use the button to save cookies for analysis.'}
                  </Typography>
                  {(facebookConnectedLocal || currentUser?.facebookConnected) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Saved: {currentUser?.facebookConnectedAt ? new Date(currentUser.facebookConnectedAt).toLocaleString() : 'Recently'}
                    </Typography>
                  )}
                </Box>

                <Box>
                  {(facebookConnectedLocal || currentUser?.facebookConnected) ? (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip label="Connected" color="success" icon={<CheckCircle />} />
                      <Button variant="outlined" size="small" onClick={() => loadAccounts()} startIcon={<Refresh />}>Refresh</Button>
                    </Box>
                  ) : (
                    <Button variant="contained" onClick={() => openHeadfulBrowser()}>
                      Enable Facebook Analysis
                    </Button>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Note removed as requested */}
      {/* Modal removed: headful browser opens directly when user clicks the Enable button */}
    </Box>
  );
};

export default SocialAccountsOAuthView;
