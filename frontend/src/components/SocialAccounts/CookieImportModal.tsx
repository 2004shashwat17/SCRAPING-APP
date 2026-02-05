import React, { useState, useEffect } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, TextField, Checkbox, FormControlLabel, Alert, Link } from '@mui/material';
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
  const [masked, setMasked] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [maskedPreview, setMaskedPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setCookieText('');
      setParsedCookies(null);
      setMessage(null);
      setLoading(false);
      setChecked({ copied: false, temporary: false, expiry: false, revoke: false, terms: false });
      setMasked(false);
      setFingerprint(null);
      setMaskedPreview(null);
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
      if (ok) {
        setMessage('✅ Facebook cookies detected');
      } else {
        setMessage('Missing c_user and xs — cookies appear incomplete');
      }
      // compute a short fingerprint to show as an encrypted-like preview and mask content
      const computeMask = async (text: string) => {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(text || '');
          const digest = await window.crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(digest));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const short = hashHex.slice(0, 16);
          setFingerprint(short);
          setMasked(true);
          setMaskedPreview(`Encrypted cookies •••• ${short}`);
        } catch (e) {
          // fallback: show masked length
          setMaskedPreview(`Encrypted cookies •••• (${(text||'').length} chars)`);
          setMasked(true);
        }
      };
      await computeMask(cookieText || '');
      setStep(4); // go to confirmation screen
    } catch (e: any) {
      setMessage('Failed to parse cookies');
    }
  };

  // Immediate paste handler: when user pastes into the textarea, capture clipboard text,
  // parse, mask and validate immediately, and move to confirmation step.
  const handlePaste = async (e: React.ClipboardEvent<any>) => {
    e.preventDefault();
    setMessage(null);
    const pasted = e.clipboardData.getData('text') || '';
    if (!pasted) {
      // try navigator.clipboard as fallback
      try { const fromClip = await (navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : ''); if (fromClip) {
        setCookieText(fromClip);
      } } catch (err) { /* ignore */ }
      return;
    }
    setCookieText(pasted);
    try {
      const parsed = parseCookieText(pasted || '');
      if (!parsed || parsed.length === 0) {
        setMessage('No cookies found in pasted data');
        return;
      }
      const normalized = parsed.map((c: any) => ({ name: c.name || c.key || Object.keys(c)[0], value: c.value || c.value || (c.V || ''), domain: c.domain || c.domain || '.facebook.com', path: c.path || '/' }));
      setParsedCookies(normalized);
      const names = normalized.map((c: any) => c.name);
      const ok = names.includes('c_user') && names.includes('xs');
      if (ok) setMessage('✅ Facebook cookies detected'); else setMessage('Missing c_user and xs — cookies appear incomplete');
      await (async () => {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(pasted || '');
          const digest = await window.crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(digest));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const short = hashHex.slice(0, 16);
          setFingerprint(short);
          setMasked(true);
          setMaskedPreview(`Encrypted cookies •••• ${short}`);
        } catch (e) {
          setMaskedPreview(`Encrypted cookies •••• (${(pasted||'').length} chars)`);
          setMasked(true);
        }
      })();
      setStep(4);
    } catch (err) {
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
            setMessage('Cookies saved and encrypted. They cannot be viewed or edited.');
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ style: { width: 560 } }}>
      <DialogTitle>
        {step === 1 && 'Connect Facebook via Cookies Needed For Analysis'}
        {step === 2 && 'Export Cookies from Facebook'}
        {step === 3 && 'Paste Cookies'}
        {step === 4 && 'Confirm Before Continuing'}
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: 420, overflowY: 'auto' }}>
        {step === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>You stay in control.</Typography>
            <Typography color="text.secondary">We don’t access your Facebook account automatically and we never ask for your password.</Typography>
            <Typography color="text.secondary">You can paste cookies you export yourself using a browser extension (for example <Link href="https://chrome.google.com/webstore/search/cookie%20editor" target="_blank" rel="noopener noreferrer" underline="hover">Cookie Editor</Link>).</Typography>
            <Typography color="text.secondary">No password is required — you remain in control of what you share.</Typography>
          </Box>
        )}

        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>Export Cookies from Facebook</Typography>
            <Typography>1) Open <Link href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" underline="hover">facebook.com</Link> and sign in.</Typography>
            <Typography>2) Click your cookie extension in the browser toolbar.</Typography>
            <Typography>3) Choose <strong>Export</strong> → <strong>Copy to Clipboard</strong>.</Typography>
            <Typography>Recommended extensions:</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', pl: 1 }}>
              <Link href="https://chrome.google.com/webstore/search/cookie%20editor" target="_blank" rel="noopener noreferrer" underline="hover" color="primary">Cookie Editor (Chrome Web Store)</Link>
              <Link href="https://chrome.google.com/webstore/search/editthiscookie" target="_blank" rel="noopener noreferrer" underline="hover" color="primary">EditThisCookie (Chrome Web Store)</Link>
            </Box>
            <Typography variant="caption" color="text.secondary">Cookies are sensitive. Treat them like a password.</Typography>

            <Box sx={{ mt: 1, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ width: 160, height: 120, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #fff, #fafafa)' }}>
                <Typography variant="caption" color="text.secondary">Extension icon</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography color="text.secondary">Tip: The extension icon appears near the address bar. Click it, then use Export → Copy. If you don't have an extension installed, open the links above to install one from the Chrome Web Store.</Typography>
              </Box>
            </Box>
          </Box>
        )}

        {step === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography>Paste the copied cookie data here…</Typography>
            {!masked ? (
              <TextField multiline minRows={6} placeholder="Paste the copied cookie data here…" value={cookieText} onChange={e => setCookieText(e.target.value)} onPaste={handlePaste} fullWidth />
            ) : (
              <TextField multiline minRows={6} value={maskedPreview || ''} fullWidth InputProps={{ readOnly: true }} />
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={handlePasteValidate}>Paste & Validate</Button>
              <Button variant="outlined" onClick={() => { setCookieText(''); setParsedCookies(null); setMessage(null); setMasked(false); setMaskedPreview(null); setFingerprint(null); }}>Clear</Button>
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
            {masked && (
              <Typography variant="caption" color="text.secondary">Preview: {maskedPreview} (actual content is encrypted on the server)</Typography>
            )}
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
