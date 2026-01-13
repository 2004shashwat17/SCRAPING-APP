/**
 * Login component for user authentication
 */

import React, { useState } from 'react';
import {
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Link,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
// Removed unused icon imports to satisfy linter
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
  onToggleMode: () => void;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 420,
  width: '100%',
  margin: 'auto',
  background: 'rgba(30, 41, 59, 0.85)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(139, 92, 246, 0.3)',
  borderRadius: theme.spacing(2),
  boxShadow: '0 20px 60px rgba(139, 92, 246, 0.3), 0 0 0 1px rgba(139, 92, 246, 0.1)',
  '& .MuiTextField-root': {
    '& .MuiInputLabel-root': {
      color: 'rgba(203, 213, 225, 0.8)',
      fontWeight: 500,
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: '#a78bfa',
      fontWeight: 600,
    },
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      '& fieldset': {
        borderColor: 'rgba(139, 92, 246, 0.3)',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(139, 92, 246, 0.5)',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#a78bfa',
        borderWidth: 2,
      },
      '& input': {
        color: '#f1f5f9',
        fontWeight: 500,
        '&::placeholder': {
          color: 'rgba(148, 163, 184, 0.6)',
          opacity: 1,
        },
      },
    },
  },
}));

const StyledContainer = styled(Box)({
  minHeight: '100vh',
  width: '100%',
  background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #5b21b6 75%, #6d28d9 100%)',
  backgroundSize: '400% 400%',
  animation: 'gradientShift 15s ease infinite',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  margin: 0,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.2) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  '@keyframes gradientShift': {
    '0%': { backgroundPosition: '0% 50%' },
    '50%': { backgroundPosition: '100% 50%' },
    '100%': { backgroundPosition: '0% 50%' },
  },
});

interface LoginProps {
  onToggleMode: () => void;
}

const Login: React.FC<LoginProps> = ({ onToggleMode }) => {
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData.username, formData.password);
      // After login, always redirect user to social accounts page to connect social auth (Facebook)
      navigate('/social-accounts');
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  return (
    <StyledContainer>
      <StyledPaper elevation={24}>
        <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
            }}
          >
            🛡️
          </Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#e9d5ff', fontWeight: 'bold' }}>
            OSINT Platform
          </Typography>
          <Typography variant="h6" sx={{ color: '#c4b5fd' }}>
            Intelligence Dashboard Login
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            margin="normal"
            required
            disabled={loading}
            autoComplete="username"
            placeholder="Enter your username"
          />
          
          <TextField
            fullWidth
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            margin="normal"
            required
            disabled={loading}
            autoComplete="current-password"
            placeholder="Enter your password"
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : '🔐'}
            sx={{ 
              mt: 3, 
              mb: 2, 
              py: 1.5,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
              fontWeight: 600,
              fontSize: '1rem',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                boxShadow: '0 6px 20px rgba(139, 92, 246, 0.5)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>

          <Divider sx={{ my: 2, borderColor: 'rgba(139, 92, 246, 0.2)' }} />

          <Box textAlign="center">
            <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
              Don't have an account?{' '}
              <Link
                component="button"
                type="button"
                onClick={onToggleMode}
                sx={{ 
                  color: '#a78bfa', 
                  fontWeight: 'bold',
                  '&:hover': {
                    color: '#c4b5fd',
                  }
                }}
              >
                Register here
              </Link>
            </Typography>
          </Box>
        </form>
      </StyledPaper>
    </StyledContainer>
  );
};

export default Login;