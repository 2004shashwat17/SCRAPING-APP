import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import apiClient, { getApiBaseUrl } from './services/apiClient';
import AuthPage from './components/auth/AuthPage';
import SocialMediaPermissionModal from './components/auth/SocialMediaPermissionModal';
import Dashboard from './components/Dashboard/Dashboard';
import PostsView from './components/Posts/PostsView';
import SettingsView from './components/Settings/SettingsView';
import DataCollectionStatus from './components/DataCollection/DataCollectionStatus';
import SocialAccountsOAuthView from './components/SocialAccounts/SocialAccountsOAuthView';
import Sidebar from './components/Layout/Sidebar';
import Navbar from './components/Layout/Navbar';

// OAuth Callback Handler Component
const OAuthCallbackHandler: React.FC = () => {
  React.useEffect(() => {
    // Get the current URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    // Redirect to backend callback URL
    const backendUrl = `${getApiBaseUrl().replace('/api/v1', '')}/api/v1/oauth/twitter/callback?code=${code}&state=${state}`;
    window.location.href = backendUrl;
  }, []);
  
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <CircularProgress size={60} />
    </Box>
  );
};

// Create a dark theme for the OSINT platform
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#f5325c',
      dark: '#9a0036',
    },
    background: {
      default: '#0a0e1a',
      paper: '#151b2d',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1a2332',
          border: '1px solid #2d3748',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Authenticated App Component
const AuthenticatedApp: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showPermissionModal, setShowPermissionModal] = React.useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if user has granted permissions when component loads
  React.useEffect(() => {
    const checkUserPermissions = async () => {
      try {
        const permissions = await apiClient.getPermissions();
        // If user has no enabled platforms, show permission modal
        if (!permissions.enabled_platforms || permissions.enabled_platforms.length === 0) {
          setShowPermissionModal(true);
        }
      } catch (error) {
        console.error('Failed to check permissions:', error);
        // Show permission modal on error to be safe
        setShowPermissionModal(true);
      }
    };

    if (user) {
      checkUserPermissions();
    }
  }, [user]);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handlePermissionGranted = async (permissions: { [key: string]: boolean }) => {
    try {
      // Convert boolean permissions to array of platform names
      const enabledPlatforms = Object.entries(permissions)
        .filter(([_, enabled]) => enabled)
        .map(([platform, _]) => platform);
      
      await apiClient.updatePermissions({ platforms: enabledPlatforms });
      setShowPermissionModal(false);
      
      // Redirect to social accounts page for OAuth authentication
      navigate('/social-accounts');
      
      console.log('Permissions granted for platforms:', enabledPlatforms);
    } catch (error) {
      console.error('Failed to update permissions:', error);
      // Handle error - maybe show a notification
    }
  };

  return (
    <>
      <SocialMediaPermissionModal
        open={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onPermissionGranted={handlePermissionGranted}
      />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            transition: 'margin-left 0.3s',
            marginLeft: sidebarOpen ? 0 : '-240px',
          }}
        >
          <Navbar onMenuClick={handleSidebarToggle} />
          <Box sx={{ flexGrow: 1, p: 3, backgroundColor: 'background.default' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/posts" element={<PostsView />} />
              <Route path="/social-accounts" element={<SocialAccountsOAuthView />} />
              <Route path="/social-accounts-oauth" element={<SocialAccountsOAuthView />} />
              <Route path="/collection" element={<DataCollectionStatus />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="/api/v1/oauth/twitter/callback" element={<OAuthCallbackHandler />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </>
  );
};

// App Router Component
const AppRouter: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Router>
      {isAuthenticated ? <AuthenticatedApp /> : <AuthPage />}
    </Router>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
