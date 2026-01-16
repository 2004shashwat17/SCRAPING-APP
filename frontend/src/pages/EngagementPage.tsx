import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const EngagementPage: React.FC = () => {
  return (
    <Box>
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          mb: 3,
          boxShadow: '0 12px 40px rgba(3,10,18,0.35)',
          backgroundImage: 'url(https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=1400&auto=format&fit=crop)'
        }}
      >
        <Box sx={{ height: { xs: 140, md: 200 }, display: 'flex', alignItems: 'center', p: { xs: 2, md: 4 } }}>
          <Box>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>👥 Overall Engagement</Typography>
            <Typography variant="body1" sx={{ color: '#fff', opacity: 0.95, mt: 1, maxWidth: 720 }}>
              See who interacts most with your child's posts — helps you understand their closest online contacts and potential influencers.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Top Engager</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Vibhor</Typography>
            <Typography variant="caption" color="text.secondary">14 interactions</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Second</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Ravi Saxena</Typography>
            <Typography variant="caption" color="text.secondary">11 interactions</Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Overview for parents</Typography>
          <Typography variant="body2" color="text.secondary">
            Quick insight into who engages most with your child's public posts. Use this to spot new contacts or unusual interaction patterns and discuss them with your child when needed.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EngagementPage;
