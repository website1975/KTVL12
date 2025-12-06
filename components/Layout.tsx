import React from 'react';
import { User } from '../types';
import { LogOut, GraduationCap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <span className="font-bold text-xl text-gray-900">EduQuiz VN</span>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                  <p className="text-xs text-gray-500 uppercase">{user.role === 'admin' ? 'Giáo Viên' : `Lớp ${user.grade}`}</p>
                </div>
                <button 
                  onClick={onLogout}
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition"
                  title="Đăng xuất"
                >
                  <LogOut size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-1 w-full">
        {children}
      </main>
      <footer className="bg-white border-t mt-auto py-6">
         <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
            © 2024 EduQuiz VN. Hệ thống thi trắc nghiệm thông minh.
         </div>
      </footer>
    </div>
  );
};

export default Layout;