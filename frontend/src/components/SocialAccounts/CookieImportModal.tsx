import React, { useState, useEffect } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, TextField, Checkbox, FormControlLabel, Alert } from '@mui/material';
import apiClient from '../../services/apiClient';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function CookieImportModal({ open, onClose, onSaved }: Props) {
  const [step, setStep] = useState<number>(1);
  const [cookieText, setCookieText] = useState<string>('');
  const [parsedCookies, setParsedCookies] = useState<any[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState({
    copied: false,
    temporary: false,
    expiry: false,
    revoke: false,
    terms: false,
  });

  useEffect(() => {
    if (!open) {
      setStep(1);
      setCookieText('');
      setParsedCookies(null);
      setMessage(null);
      setLoading(false);
      setChecked({ copied: false, temporary: false, expiry: false, revoke: false, terms: false });
    }
  }, [open]);

  const parseCookieText = (text: string) => {
    // Try to parse JSON export first
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j)) return j;
    } catch (e) {
      // not JSON — continue
    }
    // Try document.cookie style: name=value; name2=value2
    const parts = text.split(';').map(p => p.trim()).filter(Boolean);
    const result: any[] = [];
    for (const p of parts) {
      const eq = p.indexOf('=');
      if (eq === -1) continue;
      const name = p.slice(0, eq).trim();
      const value = p.slice(eq + 1).trim();
      result.push({ name, value, domain: '.facebook.com', path: '/' });
    }
    return result;
  };

  const handlePasteValidate = async () => {
    setMessage(null);
    try {
      const parsed = parseCookieText(cookieText || '');
      if (!parsed || parsed.length === 0) {
        setMessage('No cookies found in pasted data');
        return;
      }
      // Normalize to objects with name/value
      const normalized = parsed.map((c: any) => ({ name: c.name || c.key || Object.keys(c)[0], value: c.value || c.value || (c.V || ''), domain: c.domain || c.domain || '.facebook.com', path: c.path || '/' }));
      setParsedCookies(normalized);
      // Check required cookies
      const names = normalized.map((c: any) => c.name);
      const ok = names.includes('c_user') && names.includes('xs');
      if (ok) setMessage('✅ Facebook cookies detected');
      else setMessage('Missing c_user and xs — cookies appear incomplete');
      setStep(4); // go to confirmation screen
    } catch (e: any) {
      setMessage('Failed to parse cookies');
    }
  };

  const allMandatoryChecked = () => {
    return checked.copied && checked.temporary && checked.expiry && checked.revoke;
  };

  useEffect(() => {
    // If user has validated cookies and confirms the mandatory boxes, auto-submit
    const doSubmit = async () => {
      if (step !== 4) return;
      if (!parsedCookies) return;
      if (!allMandatoryChecked()) return;
      setLoading(true);
      setMessage('Submitting cookies...');
      try {
        const resp = await apiClient.post('/api/facebook/upload-cookies', { cookies: parsedCookies });
        if (resp && resp.data && resp.data.status === 'ok') {
          setMessage('Cookies saved — Facebook analysis enabled');
          if (onSaved) onSaved();
          setTimeout(() => { setLoading(false); onClose(); }, 1200);
          return;
        }
        setMessage('Failed to save cookies');
      } catch (err: any) {
        setMessage(err?.data?.detail || err?.message || 'Upload failed');
      }
      setLoading(false);
    };
    doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, parsedCookies, step]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {step === 1 && 'Connect Facebook via Cookies (Optional)'}
        {step === 2 && 'Export Cookies from Facebook'}
        {step === 3 && 'Paste Cookies'}
        {step === 4 && 'Confirm Before Continuing'}
      </DialogTitle>
      <DialogContent>
        {step === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography>You stay in control.</Typography>
            <Typography color="text.secondary">We don’t access your Facebook account automatically and we never ask for your password.</Typography>
            <Typography color="text.secondary">You can paste cookies you export yourself using a browser extension (like Cookie-Editor).</Typography>
          </Box>
        )}

        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography>Open facebook.com and log in</Typography>
            <Typography>Click your cookie extension</Typography>
            <Typography>Choose Export → Copy to Clipboard</Typography>
            <Typography>Come back here and paste it</Typography>
            <Typography variant="caption" color="text.secondary">Cookies are sensitive. Treat them like a password.</Typography>
          </Box>
        )}

        {step === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography>Paste the copied cookie data here…</Typography>
            <TextField multiline minRows={6} placeholder="Paste the copied cookie data here…" value={cookieText} onChange={e => setCookieText(e.target.value)} fullWidth />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={handlePasteValidate}>Paste & Validate</Button>
              <Button variant="outlined" onClick={() => { setCookieText(''); setParsedCookies(null); setMessage(null); }}>Clear</Button>
            </Box>
            {message && <Alert severity={message.includes('✅') ? 'success' : 'info'}>{message}</Alert>}
          </Box>
        )}

        {step === 4 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography>Please confirm the following to proceed.</Typography>
            <FormControlLabel control={<Checkbox checked={checked.copied} onChange={e => setChecked(s => ({ ...s, copied: e.target.checked }))} />} label="I copied these cookies myself from my browser" />
            <FormControlLabel control={<Checkbox checked={checked.temporary} onChange={e => setChecked(s => ({ ...s, temporary: e.target.checked }))} />} label="I understand this grants temporary session access" />
            <FormControlLabel control={<Checkbox checked={checked.expiry} onChange={e => setChecked(s => ({ ...s, expiry: e.target.checked }))} />} label="I know cookies may expire or stop working anytime" />
            <FormControlLabel control={<Checkbox checked={checked.revoke} onChange={e => setChecked(s => ({ ...s, revoke: e.target.checked }))} />} label="I can revoke access by logging out of Facebook" />
            <FormControlLabel control={<Checkbox checked={checked.terms} onChange={e => setChecked(s => ({ ...s, terms: e.target.checked }))} />} label="I agree to the Terms & Privacy Policy" />
            <Typography variant="caption" color="text.secondary">When all mandatory boxes are checked we will validate and save the cookies automatically.</Typography>
            {loading && <Typography>Submitting…</Typography>}
            {message && <Alert severity={message.includes('saved') ? 'success' : 'info'}>{message}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {step > 1 && <Button onClick={() => setStep(s => Math.max(1, s - 1))}>Back</Button>}
        {step < 4 && <Button onClick={() => setStep(s => Math.min(4, s + 1))} variant="contained">Next</Button>}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
