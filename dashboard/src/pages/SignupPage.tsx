import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SignupPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create account.');
      }
      
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);

    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="max-w-md w-full bg-[#1e293b] p-8 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Create Account</h1>
        <p className="text-gray-400 mb-8 text-center">Join to monitor your infrastructure.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="border w-full bg-gray-800 text-white p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="border w-full bg-gray-800 text-white p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" required className="border w-full bg-gray-800 text-white p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-blue-700 transition-colors">Sign Up</button>
        </form>

        {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}
        {success && <p className="mt-4 text-sm text-green-500 text-center">{success}</p>}

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#1e293b] text-gray-400">Or continue with</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* This is an `<a>` tag because it needs to navigate to a different origin (your backend) to start the OAuth flow */}
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/google`}
            className="w-full flex items-center justify-center bg-white text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
            Sign up with Google
          </a>
        <a
            href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/github`}
            className="w-full flex items-center justify-center bg-[#333] text-white font-semibold py-2 px-4 rounded-md hover:bg-[#444] transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            Sign up with GitHub
          </a>
        </div>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-gray-400 hover:text-white">Already have an account? Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;