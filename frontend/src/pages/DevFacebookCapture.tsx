import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, Typography, TextField, Button, Paper, Alert, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import apiClient, { getApiBaseUrl } from '../services/apiClient';

// Development helper page: when running in development, default the backend URL to localhost:5001
// This avoids accidentally hitting a deployed backend during local testing.
const DEV_BACKEND_URL = 'http://localhost:5001';

export default function DevFacebookCapture() {
  const [userId, setUserId] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    // auto-fill userId when logged in
    if (!userId && user && user.id) setUserId(user.id);
  }, [user, userId]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [headful, setHeadful] = useState(false);
  const [waitingForCookies, setWaitingForCookies] = useState(false);
  const [waitCountdown, setWaitCountdown] = useState<number | null>(null);
  const [waitAbort, setWaitAbort] = useState<AbortController | null>(null);
  const [post2faWait, setPost2faWait] = useState<number>(30);
    const [postDetectWait, setPostDetectWait] = useState<number>(10);
    const [postCaptchaWait, setPostCaptchaWait] = useState<number>(10);
    const [showBrowserPopup, setShowBrowserPopup] = useState(false);
    const [browserWsEndpoint, setBrowserWsEndpoint] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [message, setMessage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [show2fa, setShow2fa] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownRunning, setCountdownRunning] = useState(false);

  // handle countdown for 2FA wait
  useEffect(() => {
    if (!countdownRunning || countdown === null) return;
    if (countdown <= 0) {
      // countdown finished: attempt to check session
      setCountdownRunning(false);
      checkSession();
      return;
    }
    const t = setInterval(() => {
      setCountdown(c => (c !== null ? c - 1 : c));
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownRunning, countdown]);

  const start = async () => {
    setLoading(true); setMessage(null); setShow2fa(false); setSessionId(''); setCountdown(null); setCountdownRunning(false);
    const minWait = 6000; // ensure spinner visible for at least this many ms
    const startTs = Date.now();
    try {
      const base = process.env.NODE_ENV === 'development' ? DEV_BACKEND_URL : getApiBaseUrl();
      const url = `${base.replace(/\/$/, '')}/api/facebook/dev-start`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, fbEmail: email, fbPassword: password, headful })
      });
      const data = await resp.json().catch(() => ({}));
      // ensure minimum spinner time
      const elapsed = Date.now() - startTs;
      if (elapsed < minWait) await new Promise(r => setTimeout(r, minWait - elapsed));
      setMessage({ url, status: resp.status, data });
      if (resp.status === 401) {
        // unauthorized - show message and stop
        setLoading(false);
        return;
      }
      if (data?.status === '2fa_required') {
        setSessionId(data.sessionId || '');
        setShow2fa(true);
        // if headful, show a popup to inform the user the browser was opened
        if (headful) {
          setBrowserWsEndpoint(data.wsEndpoint || null);
          setShowBrowserPopup(true);
        }
        // start 10s countdown; if it reaches 0 and user hasn't supplied code, try checking session for cookies
        setCountdown(10);
        setCountdownRunning(true);
        // if headful mode was requested, begin waiting (blocking) for cookies for up to 300s (5m)
        if (headful) {
          waitForCookies(300);
        }
        // small delay to show 2FA field for UX
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err: any) {
      setMessage({ error: err.message || String(err) });
    } finally { setLoading(false); }
  };
  const submit2fa = async () => {
    if (!sessionId) return setMessage({ error: 'No sessionId set' });
    setLoading(true); setMessage(null);
    try {
      // Per flow: wait the configured seconds after user submits code before invoking server submit
      await new Promise(r => setTimeout(r, Math.max(0, post2faWait) * 1000));
      const base = process.env.NODE_ENV === 'development' ? DEV_BACKEND_URL : getApiBaseUrl();
      const url = `${base.replace(/\/$/, '')}/api/facebook/dev-submit-2fa`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code: (document.getElementById('twofa') as HTMLInputElement).value, userId, waitMs: Math.max(0, post2faWait) * 1000 })
      });
      const data = await resp.json();
      setMessage({ url, status: resp.status, data });
      if (resp.status === 200 && data?.status === 'ok') {
        setShow2fa(false);
        setCountdown(null);
        setCountdownRunning(false);
        // close the browser popup if present
        setShowBrowserPopup(false);
      }
    } catch (err: any) {
      setMessage({ error: err.message || String(err) });
    } finally { setLoading(false); }
  };

  // Check existing session for cookies (called when countdown expires)
  const checkSession = async (waitMs = 0) => {
    if (!sessionId) return setMessage({ error: 'No session available to check' });
    setLoading(true); setMessage(null);
    try {
      const base = process.env.NODE_ENV === 'development' ? DEV_BACKEND_URL : getApiBaseUrl();
      const url = `${base.replace(/\/$/, '')}/api/facebook/dev-check-session`;
      const resp = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId })
      });
      const data = await resp.json().catch(() => ({}));
      setMessage({ url, status: resp.status, data });
      if (data?.status === 'ok') {
        setShow2fa(false);
        setSessionId('');
        setShowBrowserPopup(false);
      }
    } catch (err: any) {
      setMessage({ error: err.message || String(err) });
    } finally { setLoading(false); }
  };

  // Wait for cookies by issuing a blocking request that waits up to waitSeconds seconds.
  // Shows a countdown and allows cancelling.
  const waitForCookies = async (waitSeconds = 120) => {
    if (!sessionId) return setMessage({ error: 'No sessionId available to wait on' });
    setWaitingForCookies(true);
    setWaitCountdown(waitSeconds);
    const controller = new AbortController();
    setWaitAbort(controller);
    // decrement countdown each second
    const interval = setInterval(() => {
      setWaitCountdown(s => (s !== null && s > 0 ? s - 1 : s));
    }, 1000);
    try {
      const base = process.env.NODE_ENV === 'development' ? DEV_BACKEND_URL : getApiBaseUrl();
      const url = `${base.replace(/\/$/, '')}/api/facebook/dev-check-session`;
      const resp = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, waitMs: waitSeconds * 1000, postDetectWaitMs: Math.max(0, postDetectWait) * 1000, postCaptchaWaitMs: Math.max(0, postCaptchaWait) * 1000 }), signal: controller.signal
        });
      const data = await resp.json().catch(() => ({}));
      setMessage({ url, status: resp.status, data });
      if (data?.status === 'ok') {
        setShow2fa(false);
        setSessionId('');
        setShowBrowserPopup(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') setMessage({ error: 'Wait cancelled' }); else setMessage({ error: err.message || String(err) });
    } finally {
      clearInterval(interval);
      setWaitingForCookies(false);
      setWaitCountdown(null);
      setWaitAbort(null);
    }
  };

  const copyWsEndpoint = async () => {
    if (!browserWsEndpoint) return;
    try { await navigator.clipboard.writeText(browserWsEndpoint); setMessage({ info: 'wsEndpoint copied to clipboard' }); } catch (e) { setMessage({ error: 'Failed to copy wsEndpoint' }); }
  };

  const cancelWait = () => {
    if (waitAbort) waitAbort.abort();
  };
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Dev: Facebook Cookie Capture</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Development-only page. Ensure backend is running with NODE_ENV=development.</Typography>

        <TextField helperText="Optional: leave blank to use an anonymous id" label="User ID (optional)" value={userId} onChange={e => setUserId(e.target.value)} fullWidth sx={{ mb: 2 }} />
        <TextField label="Facebook email" value={email} onChange={e => setEmail(e.target.value)} fullWidth sx={{ mb: 2 }} />
        <TextField label="Facebook password" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <input id="headful" type="checkbox" checked={headful} onChange={e => setHeadful(e.target.checked)} />
          <label htmlFor="headful">Open visible browser (headful)</label>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button variant="contained" onClick={start} disabled={loading}>Start (dev-start)</Button>
          <Button variant="outlined" onClick={() => { setSessionId(''); setMessage(null); }}>Reset</Button>
        </Box>

        {sessionId && (
          <Box sx={{ mb: 2 }}>
            <TextField id="twofa" label="2FA code" fullWidth sx={{ mb: 1 }} />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
              <TextField label="Post-2FA wait (s)" type="number" value={post2faWait} onChange={e => setPost2faWait(Number(e.target.value || 0))} size="small" sx={{ width: 140 }} />
              <TextField label="Post-detect wait (s)" type="number" value={postDetectWait} onChange={e => setPostDetectWait(Number(e.target.value || 0))} size="small" sx={{ width: 140 }} />
              <TextField label="Post-captcha wait (s)" type="number" value={postCaptchaWait} onChange={e => setPostCaptchaWait(Number(e.target.value || 0))} size="small" sx={{ width: 140 }} />
              <Typography variant="body2" color="text.secondary">Post-detect wait ensures browser stays open a few seconds after cookies appear</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button variant="contained" onClick={() => { setCountdown(null); setCountdownRunning(false); submit2fa(); }} disabled={loading}>Submit 2FA (dev-submit-2fa)</Button>
              <Button variant="outlined" onClick={() => { setCountdown(null); setCountdownRunning(false); checkSession(); }} disabled={loading}>Check session now</Button>
              {countdownRunning && countdown !== null && (
                <Typography variant="body2" color="text.secondary">Waiting for 2FA: {countdown}s</Typography>
              )}
              {headful && waitingForCookies && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Waiting for cookies: {waitCountdown}s</Typography>
                  <Button variant="outlined" color="error" size="small" onClick={cancelWait}>Cancel</Button>
                </Box>
              )}
              {message?.data?.status === 'captcha_required' && (
                <Box sx={{ mt: 1 }}>
                  <Alert severity="warning">CAPTCHA detected. Please solve the CAPTCHA in the opened browser window (headful), then click <strong>Check session now</strong>.</Alert>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {message && (
          <Alert severity={message.error ? 'error' : 'info'} sx={{ mt: 2 }}>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(message, null, 2)}</pre>
          </Alert>
        )}
        <Dialog open={showBrowserPopup} onClose={() => setShowBrowserPopup(false)}>
          <DialogTitle>Browser opened for capture</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>A visible browser window was opened for the capture. Complete any 2FA or CAPTCHA in that window.</Typography>
            {browserWsEndpoint && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{browserWsEndpoint}</Typography>
                <IconButton size="small" onClick={copyWsEndpoint} aria-label="copy"><ContentCopyIcon fontSize="small" /></IconButton>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowBrowserPopup(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
