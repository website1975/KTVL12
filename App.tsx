
import React, { useState, useEffect } from 'react';
import { AuthState, User } from './types';
import { initStorage, findUserByStudentCode, isDatabaseConnected } from './services/storage';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';
import StudentDashboard from './components/StudentDashboard';
import Layout from './components/Layout';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    initStorage();
    checkPersistentLogin();
  }, []);

  const checkPersistentLogin = async () => {
    const storedUser = localStorage.getItem('eduquiz_current_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        
        // Nếu có mạng, kiểm tra xem user này còn tồn tại trong DB không
        if (isDatabaseConnected() && parsedUser.studentCode) {
            const dbUser = await findUserByStudentCode(parsedUser.studentCode);
            if (!dbUser) {
                // Tài khoản đã bị xóa khỏi DB -> Ép đăng xuất
                console.warn("Tài khoản không tồn tại trên hệ thống. Đang đăng xuất...");
                handleLogout();
                setIsChecking(false);
                return;
            }
            // Cập nhật dữ liệu mới nhất từ DB vào local
            setAuth({ user: dbUser, isAuthenticated: true });
            localStorage.setItem('eduquiz_current_user', JSON.stringify(dbUser));
        } else {
            setAuth({ user: parsedUser, isAuthenticated: true });
        }
      } catch (e) {
        handleLogout();
      }
    }
    setIsChecking(false);
  };

  const handleLogin = (user: User) => {
    setAuth({ user, isAuthenticated: true });
    localStorage.setItem('eduquiz_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
    localStorage.removeItem('eduquiz_current_user');
    // Xóa thêm các cache rác để đảm bảo sạch sẽ
    localStorage.removeItem('eduquiz_users_offline'); 
  };

  if (isChecking) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đang xác thực hệ thống...</p>
              </div>
          </div>
      );
  }

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
