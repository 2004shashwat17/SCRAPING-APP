import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, CircularProgress, FormControlLabel, Checkbox, Alert } from '@mui/material';
import apiClient, { getApiBaseUrl } from '../../services/apiClient';

type Props = {
  open: boolean;
  onClose: () => void;
  onStatusChange?: (status: 'idle' | 'pending' | 'success' | 'error') => void;
};

export default function FacebookCaptureModal({ open, onClose, onStatusChange }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [headful, setHeadful] = useState(false);
  const [post2faWait, setPost2faWait] = useState<number>(30);
  const [postDetectWait, setPostDetectWait] = useState<number>(10);
  const [postCaptchaWait, setPostCaptchaWait] = useState<number>(10);
  const [sessionId, setSessionId] = useState('');
  const [stage, setStage] = useState<'form'|'2fa'|'pending'|'success'|'error'|'headful'>('form');
  const [message, setMessage] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const prevObjectUrlRef = useRef<string | null>(null);

  const start = async () => {
    setStage('pending'); setMessage('Starting login...');
    if (onStatusChange) onStatusChange('pending');
    try {
      // Ensure user has a token (must be signed in)
      if (!localStorage.getItem('access_token')) {
        setStage('error'); setMessage('You must be signed in to enable Facebook Analysis. Please sign in and try again.');
        if (onStatusChange) onStatusChange('error');
        return;
      }
      // If headful/manual mode is requested, open a headful browser session
      // on the server for the user to complete login manually.
      let resp;
      if (headful) {
        // call open-headful regardless of whether credentials were provided
        resp = await apiClient.post('/api/facebook/open-headful', {});
        setMessage(resp.data?.message || 'Headful browser opened. Complete login manually.');
        if (onStatusChange) onStatusChange('pending');
        // Keep modal open and show headful controls (inspect URL, open DevTools)
        setSessionId(resp.data?.sessionId || '');
        setStage('headful');
        return;
      } else {
        resp = await apiClient.post('/api/facebook/start', { fbEmail: email, fbPassword: password, headful });
      }
      if (resp.data.status === '2fa_required') {
        setSessionId(resp.data.sessionId);
        setStage('2fa');
        setMessage(resp.data.message || '2FA required. Enter code.');
        if (onStatusChange) onStatusChange('pending');
        // headful mode now opens the real browser directly; no in-app popup
      } else if (resp.data.status === 'captcha_required') {
        setStage('2fa');
        setMessage(resp.data.message || 'CAPTCHA detected; solve it in the opened browser window.');
      } else {
        setStage('success'); setMessage('Connected — cookies saved in MongoDB');
        if (onStatusChange) onStatusChange('success');
      }
    } catch (err: any) {
      // Better error messages by inspecting status
      const status = err && err.status;
      if (status === 401) {
        setStage('error'); setMessage('Not authenticated. Please sign in before enabling Facebook capture.');
      } else if (status === 404) {
        setStage('error'); setMessage(`Server endpoint not found (404). Tried ${err?.url || 'unknown URL'}. Check backend URL or ensure backend is running.`);
      } else {
        setStage('error'); setMessage(err?.data?.detail || err.message || 'Failed');
      }
      if (onStatusChange) onStatusChange('error');
    }
  };

  const openDevTools = async () => {
    if (!sessionId) return setMessage('No session');
    try {
      const resp = await apiClient.post(`/api/facebook/inspect-token/${sessionId}`);
      const wsUrl = resp.data?.wsUrl;
      if (!wsUrl) return setMessage('Failed to get inspect URL');
      // Attempt to open the hosted DevTools frontend with the ws target
      const devtoolsUrl = `https://chrome-devtools-frontend.appspot.com/serve_file/@f/inspector.html?ws=${encodeURIComponent(wsUrl)}`;
      // Open new window/tab
      window.open(devtoolsUrl, '_blank');
      // Also copy to clipboard for manual use
      try { await navigator.clipboard.writeText(wsUrl); setMessage('Inspect URL copied to clipboard'); } catch (e) { /* ignore */ }
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err.message || 'Failed to get inspect token');
    }
  };

  const copyInspectUrl = async () => {
    if (!sessionId) return setMessage('No session');
    try {
      const resp = await apiClient.post(`/api/facebook/inspect-token/${sessionId}`);
      const wsUrl = resp.data?.wsUrl;
      if (!wsUrl) return setMessage('Failed to get inspect URL');
      await navigator.clipboard.writeText(wsUrl);
      setMessage('Inspect URL copied to clipboard');
    } catch (err: any) { setMessage(err?.response?.data?.error || err.message || 'Failed to get inspect token'); }
  };

  const closeSession = async () => {
    if (!sessionId) return setMessage('No session');
    try {
      await apiClient.delete(`/api/facebook/session/${sessionId}`);
      setStage('form'); setSessionId(''); setMessage('Session closed');
      // stop polling when closed
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      if (prevObjectUrlRef.current) { URL.revokeObjectURL(prevObjectUrlRef.current); prevObjectUrlRef.current = null; setScreenshotUrl(null); }
    } catch (err: any) { setMessage(err?.response?.data?.error || err.message || 'Failed to close session'); }
  };

  const submit2fa = async (code: string) => {
    setStage('pending'); setMessage('Submitting 2FA...');
    if (onStatusChange) onStatusChange('pending');
    try {
      const resp = await apiClient.post('/api/facebook/submit-2fa', { sessionId, code, waitMs: Math.max(0, post2faWait) * 1000 });
      if (resp.data.status === 'ok') {
        setStage('success'); setMessage('Connected — cookies saved in MongoDB');
        if (onStatusChange) onStatusChange('success');
      } else {
        setStage('2fa'); setMessage(resp.data.message || '2FA failed');
        if (onStatusChange) onStatusChange('error');
      }
    } catch (err: any) {
      setStage('error'); setMessage(err?.response?.data?.error || err.message || 'Failed');
      if (onStatusChange) onStatusChange('error');
    }
  };

  const checkSession = async () => {
    if (!sessionId) return setMessage('No capture session available');
    setStage('pending'); setMessage('Checking session...');
    try {
      const resp = await apiClient.post('/api/facebook/check-session', { sessionId, waitMs: 0, postDetectWaitMs: Math.max(0, postDetectWait) * 1000, postCaptchaWaitMs: Math.max(0, postCaptchaWait) * 1000 });
      if (resp.data.status === 'ok') {
        setStage('success'); setMessage('Connected — cookies saved');
        if (onStatusChange) onStatusChange('success');
      } else if (resp.data.status === 'captcha_required') {
        setStage('2fa'); setMessage(resp.data.message || 'CAPTCHA present — solve in browser');
      } else {
        setStage('error'); setMessage(resp.data.message || 'No session yet');
      }
    } catch (err: any) { setStage('error'); setMessage(err?.response?.data?.error || err.message || 'Failed'); }
  };

  // browser popup removed; no ws copy helper needed

  // Poll for screenshots when in headful stage
  useEffect(() => {
    // start polling when entering headful stage with a sessionId
    if (stage === 'headful' && sessionId) {
      const fetchScreenshot = async () => {
        try {
          const base = getApiBaseUrl().replace(/\/$/, '').replace(/\/api(\/v1)?$/, '');
          const token = localStorage.getItem('access_token');
          const url = `${base}/api/facebook/session-screenshot/${encodeURIComponent(sessionId)}`;
          const headers: Record<string,string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const resp = await fetch(url, { headers, cache: 'no-store' });
          if (!resp.ok) return; // ignore transient
          const blob = await resp.blob();
          const obj = URL.createObjectURL(blob);
          // revoke previous
          if (prevObjectUrlRef.current) {
            try { URL.revokeObjectURL(prevObjectUrlRef.current); } catch (e) { /* ignore */ }
          }
          prevObjectUrlRef.current = obj;
          setScreenshotUrl(obj);
        } catch (e) {
          // ignore transient errors while polling
        }
      };
      // immediate fetch + interval
      fetchScreenshot();
      pollRef.current = window.setInterval(fetchScreenshot, 1000);
      return () => {
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        if (prevObjectUrlRef.current) { try { URL.revokeObjectURL(prevObjectUrlRef.current); } catch (e) {} prevObjectUrlRef.current = null; }
        setScreenshotUrl(null);
      };
    }
    // if leaving headful stage, cleanup
    if (stage !== 'headful') {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      if (prevObjectUrlRef.current) { try { URL.revokeObjectURL(prevObjectUrlRef.current); } catch (e) {} prevObjectUrlRef.current = null; }
      setScreenshotUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, sessionId]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Enable Facebook Analysis</DialogTitle>
      <DialogContent>
        {stage === 'form' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2">Enter your Facebook credentials to let the server log in and save cookies for analysis. We will not store your password long-term.</Typography>
            <TextField label="Facebook email" value={email} onChange={e => setEmail(e.target.value)} fullWidth />
            <TextField label="Facebook password" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth />
            <FormControlLabel control={<Checkbox checked={headful} onChange={e => setHeadful(e.target.checked)} />} label="Open visible browser (headful)" />
          </Box>
        )}

        {stage === '2fa' && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2">{message}</Typography>
            <TextField id="twofa" label="2FA code" fullWidth sx={{ mt: 2 }} />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
              <Button variant="contained" onClick={() => submit2fa((document.getElementById('twofa') as HTMLInputElement).value)}>Submit code</Button>
              <Button variant="outlined" onClick={checkSession}>Check session now</Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
              <TextField label="Post-2FA wait (s)" type="number" value={post2faWait} onChange={e => setPost2faWait(Number(e.target.value||0))} size="small" sx={{ width: 140 }} />
              <TextField label="Post-detect wait (s)" type="number" value={postDetectWait} onChange={e => setPostDetectWait(Number(e.target.value||0))} size="small" sx={{ width: 140 }} />
              <TextField label="Post-captcha wait (s)" type="number" value={postCaptchaWait} onChange={e => setPostCaptchaWait(Number(e.target.value||0))} size="small" sx={{ width: 140 }} />
            </Box>
          </Box>
        )}

        {stage === 'pending' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <CircularProgress size={20} />
            <Typography>{message}</Typography>
          </Box>
        )}

        {stage === 'headful' && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography>Headful browser opened on the server. Use the buttons below to inspect or close the session.</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={openDevTools}>Open DevTools</Button>
              <Button variant="outlined" onClick={copyInspectUrl}>Copy Inspect URL</Button>
              <Button variant="text" color="error" onClick={closeSession}>Close Session</Button>
            </Box>
            <Typography variant="caption">Tip: If the DevTools front-end link fails, paste the Inspect URL into chrome://inspect → Configure…</Typography>
            {screenshotUrl ? (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">Live screenshot (updates every second):</Typography>
                <Box sx={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 1, overflow: 'hidden', maxWidth: '100%' }}>
                  <img src={screenshotUrl} alt="fb-screenshot" style={{ display: 'block', width: '100%', height: 'auto' }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => { if (screenshotUrl) window.open(screenshotUrl); }}>Open image in new tab</Button>
                  <Button size="small" onClick={() => { if (screenshotUrl) { const a = document.createElement('a'); a.href = screenshotUrl; a.download = `screenshot_${sessionId}.png`; document.body.appendChild(a); a.click(); a.remove(); } }}>Download</Button>
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">Waiting for screenshot...</Typography>
            )}
          </Box>
        )}

        {stage === 'success' && (
          <Typography sx={{ mt: 2 }} color="success.main">{message}</Typography>
        )}

        {stage === 'error' && (
          <Typography sx={{ mt: 2 }} color="error.main">{message}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        {stage === 'form' && <Button variant="contained" onClick={start}>Start</Button>}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      {/* in-app browser popup removed: headful sessions open a real browser window server-side */}
    </Dialog>
  );
}
