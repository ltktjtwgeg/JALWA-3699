import React, { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import { useAuth } from '../../App';
import { useNavigate } from 'react-router-dom';

export default function AdminPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Auto-login if session exists in memory for this tab
  useEffect(() => {
    const session = sessionStorage.getItem('admin_session');
    if (session === 'active') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('admin_session', 'active');
  };

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLoginSuccess} />;
  }

  return <AdminDashboard />;
}
