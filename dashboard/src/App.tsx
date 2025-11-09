import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';
import LoginCallbackPage from './pages/LoginCallbackPage';  

// 1. Create a new instance of QueryClient
const queryClient = new QueryClient();

const App: React.FC = () => {
  const { token } = useAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" />} /> 
        <Route path="/login/callback" element={<LoginCallbackPage />} /> 
        <Route path="/*" element={token ? <DashboardLayout /> : <Navigate to="/login" />} />
      </Routes>
    </QueryClientProvider>
  );
};

export default App;