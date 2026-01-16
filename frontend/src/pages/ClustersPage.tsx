import React, { useEffect } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { useLocation } from 'react-router-dom';
import ALL_CLUSTERS from '../data/clusters';

const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

const ClustersPage: React.FC = () => {
  const location = useLocation();
  const highlight = (location.state as any)?.highlight as string | undefined;

  useEffect(() => {
    if (highlight) {
      const id = `cluster-${slugify(highlight)}`;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight]);

  return (
    <Box>
      <Box sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{
          height: { xs: 140, md: 200 },
          backgroundImage: 'url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1400&auto=format&fit=crop)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          p: { xs: 2, md: 4 }
        }}>
          <Box>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>🎯 All Clusters</Typography>
            <Typography variant="body1" sx={{ color: '#fff', opacity: 0.95, mt: 1, maxWidth: 720 }}>
              A complete list of content themes detected in your child's public posts. Click any cluster to see related content and trends.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        {ALL_CLUSTERS.map((cluster, i) => (
          <Card id={`cluster-${slugify(cluster)}`} key={i}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{cluster}</Typography>
              <Typography variant="caption" color="text.secondary">Sample posts: 5</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default ClustersPage;
