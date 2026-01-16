import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import apiClient, { getApiBaseUrl } from './services/apiClient';
import theme from './theme';
import AuthPage from './components/auth/AuthPage';
import SocialMediaPermissionModal from './components/auth/SocialMediaPermissionModal';
import Dashboard from './components/Dashboard/Dashboard';
import PostsView from './components/Posts/PostsView';
import SettingsView from './components/Settings/SettingsView';
import DataCollectionStatus from './components/DataCollection/DataCollectionStatus';
import SocialAccountsOAuthView from './components/SocialAccounts/SocialAccountsOAuthView';
import AnalysisView from './components/Analysis/AnalysisView';
import ProfileView from './components/Profile/ProfileView';
import Sidebar from './components/Layout/Sidebar';
import Navbar from './components/Layout/Navbar';
import StatisticsPage from './pages/StatisticsPage';
import EngagementPage from './pages/EngagementPage';
import ClustersPage from './pages/ClustersPage';

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
        // Avoid showing modal if user already granted permissions (per-user local flag)
          const userId = user?.id;
          // Check per-user flag first, then fallback to global flag
          if (userId && localStorage.getItem(`permissionsGranted_${userId}`) === 'true') return;
          if (userId && localStorage.getItem('permissionsGranted') === 'true') {
            // promote global flag to per-user to avoid repeat prompting
            localStorage.setItem(`permissionsGranted_${userId}`, 'true');
            return;
          }
        // Check backend consents for this user
        const resp = await apiClient.get<any>('/api/consent');
        const consents = resp.data?.consents || [];
        if (!consents || consents.length === 0) {
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

  const handlePermissionGranted = async (payload: any) => {
    try {
      // payload can be either { platforms: string[], agreedToTerms: boolean } or the older permissions map
      let enabledPlatforms: string[] = [];
      let agreedToTerms = false;
      if (Array.isArray(payload?.platforms)) {
        enabledPlatforms = payload.platforms;
        agreedToTerms = Boolean(payload.agreedToTerms);
      } else if (payload && typeof payload === 'object') {
        // convert map to array
        enabledPlatforms = Object.entries(payload)
          .filter(([_, enabled]) => enabled)
          .map(([platform, _]) => platform);
      }

      // Record consent on backend for authenticated users
      try {
        await apiClient.post('/api/consent', {
          platforms: enabledPlatforms,
          agreedToTerms: agreedToTerms,
          metadata: { grantedBy: (user && user.username) || 'unknown' },
        });
      } catch (e) {
        console.error('Failed to record consent on backend:', e);
      }

      // Set per-user local flag so modal won't reappear
      try {
        if (user?.id) {
          localStorage.setItem(`permissionsGranted_${user.id}`, 'true');
        }
      } catch (e) {
        // ignore
      }

      setShowPermissionModal(false);
      // Redirect to social accounts page for OAuth authentication
      navigate('/social-accounts');
      console.log('Permissions granted for platforms:', enabledPlatforms);
    } catch (error) {
      console.error('Failed to process permissions:', error);
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
              <Route path="/analysis" element={<AnalysisView />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/engagement" element={<EngagementPage />} />
              <Route path="/clusters" element={<ClustersPage />} />
              <Route path="/collection" element={<DataCollectionStatus />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="/profile" element={<ProfileView />} />
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

  // We need Router first, then a child component can use navigation hooks
  return (
    <Router>
      <AuthRedirector isAuthenticated={isAuthenticated} />
    </Router>
  );
};

// Component inside Router so it can use navigation hooks
const AuthRedirector: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const decideRedirect = async () => {
      if (!isAuthenticated) return;
      try {
        // Prefer server-side consent check
        const resp = await apiClient.get<any>('/api/consent');
        const consents = resp.data?.consents || [];
        if (!consents || consents.length === 0) {
          if (location.pathname === '/' || location.pathname.startsWith('/login') || location.pathname.startsWith('/auth')) {
            navigate('/social-accounts');
          }
        } else {
          if (location.pathname === '/' || location.pathname.startsWith('/login') || location.pathname.startsWith('/auth')) {
            navigate('/dashboard');
          }
        }
      } catch (err) {
        if (location.pathname === '/' || location.pathname.startsWith('/login') || location.pathname.startsWith('/auth')) {
          navigate('/social-accounts');
        }
      }
    };

    decideRedirect();
  }, [isAuthenticated, location.pathname, navigate]);

  return isAuthenticated ? <AuthenticatedApp /> : <AuthPage />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
