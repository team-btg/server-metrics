import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage'; // Create this page
import DashboardLayout from './pages/DashboardLayout'; // Create this layout

const App: React.FC = () => {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" />} />
      {/* Add /register route here */}
      <Route path="/*" element={token ? <DashboardLayout /> : <Navigate to="/login" />} />
    </Routes>
  );
};

export default App;