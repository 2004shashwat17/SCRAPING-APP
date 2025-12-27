import React from 'react';
import { Typography, Box } from '@mui/material';

const SettingsView: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Platform configuration and settings interface coming soon...
      </Typography>
    </Box>
  );
};

export default SettingsView;