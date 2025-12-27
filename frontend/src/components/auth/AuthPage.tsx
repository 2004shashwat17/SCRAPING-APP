/**
 * Authentication page that handles both login and registration
 */

import React, { useState } from 'react';
import Login from './Login';
import Register from './Register';

const AuthPage: React.FC = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);

  const toggleMode = (): void => {
    setIsLoginMode(!isLoginMode);
  };

  return isLoginMode ? (
    <Login onToggleMode={toggleMode} />
  ) : (
    <Register onToggleMode={toggleMode} />
  );
};

export default AuthPage;