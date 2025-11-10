import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate(); 
  const { setToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // Use setToken to save the token from the URL
      setToken(token);
      // Redirect to the main dashboard page
      navigate('/', { replace: true });
    } else { 
      console.error("OAuth callback is missing a token.");
      navigate('/login', { replace: true });
    } 
  }, [searchParams, navigate, setToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="text-white text-center">
        <h1 className="text-2xl font-semibold">Signing in...</h1>
        <p className="text-gray-400">Please wait while we redirect you.</p>
      </div>
    </div>
  );
};

export default LoginCallbackPage;