import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import apiClient, { getApiBaseUrl } from '../services/apiClient';

export default function FacebookSessionViewer() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const prevRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
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
        if (prevRef.current) { try { URL.revokeObjectURL(prevRef.current); } catch (e) {} }
        prevRef.current = obj;
        setScreenshotUrl(obj);
      } catch (e) {
        // ignore
      }
    };

    fetchScreenshot();
    pollRef.current = window.setInterval(fetchScreenshot, 1000);
    return () => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      if (prevRef.current) { try { URL.revokeObjectURL(prevRef.current); } catch (e) {} prevRef.current = null; }
    };
  }, [sessionId]);

  const openDevTools = async () => {
    try {
      const resp = await apiClient.post(`/api/facebook/inspect-token/${sessionId}`);
      const wsUrl = resp.data?.wsUrl;
      if (!wsUrl) return alert('Failed to get DevTools WS URL');
      const devtoolsUrl = `https://chrome-devtools-frontend.appspot.com/serve_file/@f/inspector.html?ws=${encodeURIComponent(wsUrl)}`;
      window.open(devtoolsUrl, '_blank');
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Failed to open DevTools');
    }
  };

  const openVnc = async () => {
    try {
      const resp = await apiClient.post('/api/facebook/vnc-token');
      const url = resp.data?.url;
      if (!url) return alert('noVNC not available');
      window.open(url, '_blank');
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Failed to get VNC token');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Facebook Capture Viewer</Typography>
      {!sessionId && (
        <Typography color="error">Missing sessionId in query params. Add ?sessionId=&lt;id&gt; to the URL.</Typography>
      )}
      {sessionId && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="contained" onClick={openDevTools}>Open DevTools</Button>
            <Button variant="outlined" onClick={openVnc}>Open VNC (if available)</Button>
            <Button variant="text" onClick={() => { if (screenshotUrl) window.open(screenshotUrl); }}>Open image</Button>
          </Box>
          <Box sx={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 1, overflow: 'hidden', maxWidth: 1024 }}>
            {screenshotUrl ? (
              <img src={screenshotUrl} alt="fb-session" style={{ display: 'block', width: '100%', height: 'auto' }} />
            ) : (
              <Typography sx={{ p: 2 }}>Waiting for screenshot...</Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
