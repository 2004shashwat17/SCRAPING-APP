/**
 * Registration component for new user signup
 */

import React, { useState } from 'react';
import {
  Container,
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
import { Shield, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 400,
  width: '100%',
  margin: 'auto',
  marginTop: theme.spacing(8),
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  '& .MuiTextField-root': {
    '& .MuiInputLabel-root': {
      color: 'rgba(0, 0, 0, 0.7)',
      fontWeight: 500,
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: '#1976d2',
      fontWeight: 600,
    },
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      '& fieldset': {
        borderColor: 'rgba(0, 0, 0, 0.3)',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(0, 0, 0, 0.5)',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1976d2',
      },
      '& input': {
        color: '#000000',
        fontWeight: 500,
        '&::placeholder': {
          color: 'rgba(0, 0, 0, 0.6)',
          opacity: 1,
        },
      },
    },
  },
}));

const StyledContainer = styled(Container)({
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

interface RegisterProps {
  onToggleMode: () => void;
}

interface FormData {
  username: string;
  email: string;
  full_name: string;
  password: string;
  confirmPassword: string;
}

interface ValidationErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const Register: React.FC<RegisterProps> = ({ onToggleMode }) => {
  const { register, loading, error, clearError } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    full_name: '',
    password: '',
    confirmPassword: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    clearError();
    
    // Clear validation error for this field
    if (validationErrors[name as keyof ValidationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.includes('@')) {
      errors.email = 'Please enter a valid email address';
    }

    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const { confirmPassword, ...userData } = formData;
      await register(userData);
      // Navigation will be handled by the parent component checking auth state
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  return (
    <StyledContainer>
      <StyledPaper elevation={10}>
        <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            🛡️
          </Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
            OSINT Platform
          </Typography>
          <Typography variant="h6" color="textSecondary">
            Create Your Account
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
            error={!!validationErrors.username}
            helperText={validationErrors.username}
            autoComplete="username"
            placeholder="Enter your username"
          />
          
          <TextField
            fullWidth
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            margin="normal"
            required
            disabled={loading}
            error={!!validationErrors.email}
            helperText={validationErrors.email}
            autoComplete="email"
            placeholder="Enter your email address"
          />

          <TextField
            fullWidth
            label="Full Name (Optional)"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            margin="normal"
            disabled={loading}
            autoComplete="name"
            placeholder="Enter your full name"
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
            error={!!validationErrors.password}
            helperText={validationErrors.password}
            autoComplete="new-password"
            placeholder="Enter your password"
          />

          <TextField
            fullWidth
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            margin="normal"
            required
            disabled={loading}
            error={!!validationErrors.confirmPassword}
            helperText={validationErrors.confirmPassword}
            autoComplete="new-password"
            placeholder="Confirm your password"
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : '👤'}
            sx={{ 
              mt: 3, 
              mb: 2, 
              py: 1.5,
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)',
              }
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>

          <Divider sx={{ my: 2 }} />

          <Box textAlign="center">
            <Typography variant="body2" color="textSecondary">
              Already have an account?{' '}
              <Link
                component="button"
                type="button"
                onClick={onToggleMode}
                sx={{ color: '#1976d2', fontWeight: 'bold' }}
              >
                Sign in here
              </Link>
            </Typography>
          </Box>
        </form>
      </StyledPaper>
    </StyledContainer>
  );
};

export default Register;