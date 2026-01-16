import React from 'react';
import { Box, Typography, Card, CardContent, Button } from '@mui/material';

const StatisticsPage: React.FC = () => {
  return (
    <Box>
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          mb: 3,
          boxShadow: '0 12px 40px rgba(3,10,18,0.35)',
        }}
      >
        <Box
          sx={{
            height: { xs: 160, md: 220 },
            backgroundImage: 'url(https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1400&auto=format&fit=crop)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            p: { xs: 2, md: 4 },
          }}
        >
          <Box>
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>📊 Statistics</Typography>
              <Typography variant="body1" sx={{ color: '#fff', opacity: 0.95, mt: 1, maxWidth: 720 }}>
                Keep tabs on your child's public activity with easy-to-read trends, alerts, and summaries — designed to help you spot changes, identify new contacts, and have constructive conversations.
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                  onClick={() => window.scrollTo({ top: 600, behavior: 'smooth' })}
                >
                  See what you'll get
                </Button>
                <Button variant="outlined" sx={{ textTransform: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.12)' }}>
                  How it helps
                </Button>
              </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Weekly Digest</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Summary Email</Typography>
              <Typography variant="caption" color="text.secondary">A quick summary of the week's activity</Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Location Alerts</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Real-time</Typography>
              <Typography variant="caption" color="text.secondary">Notifies you about new posting locations</Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Top Engagers</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Who interacts most</Typography>
              <Typography variant="caption" color="text.secondary">See the top contacts engaging with posts</Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Red Flag Detection</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Safety insights</Typography>
              <Typography variant="caption" color="text.secondary">Highlights unusual activity or content</Typography>
            </CardContent>
          </Card>
      </Box>

        {/* What you'll get section */}
        <Box sx={{ mb: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>What you'll get</Typography>
              <Box component="ul" sx={{ pl: 3, m: 0, color: 'text.secondary' }}>
                <li>Weekly highlights of posting trends and top locations</li>
                <li>Real-time alerts for new locations or sudden spikes</li>
                <li>Visibility into top engagers and interaction levels</li>
                <li>Automatic detection of concerning content or behavior</li>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Button variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>Get started</Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Overview for parents</Typography>
          <Typography variant="body2" color="text.secondary">
            This page gives you a high-level overview of content trends. Use it to quickly understand posting frequency, where posts originate, and seasonal patterns. If you notice a sudden increase in posts from a new location or changes in posting times, consider checking in with your child.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StatisticsPage;
