
import React, { useState, useEffect } from 'react';
import { AuthState, User } from './types';
import { initStorage } from './services/storage';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';
import StudentDashboard from './components/StudentDashboard';
import Layout from './components/Layout';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Initialize dummy data for demo
    initStorage();
    
    // Check local storage for persistent login
    const storedUser = localStorage.getItem('eduquiz_current_user');
    if (storedUser) {
      try {
        setAuth({ user: JSON.parse(storedUser), isAuthenticated: true });
      } catch (e) {
        localStorage.removeItem('eduquiz_current_user');
      }
    }
  }, []);

  const handleLogin = (user: User) => {
    setAuth({ user, isAuthenticated: true });
    localStorage.setItem('eduquiz_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
    localStorage.removeItem('eduquiz_current_user');
  };

  if (!auth.isAuthenticated || !auth.user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <Layout user={auth.user} onLogout={handleLogout}>
      {auth.user.role === 'admin' ? (
        <AdminDashboard />
      ) : (
        <StudentDashboard user={auth.user as User} />
      )}
    </Layout>
  );
};

export default App;
