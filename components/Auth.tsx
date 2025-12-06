import React, { useState } from 'react';
import { User, Role, Grade } from '../types';
import { findUser, saveUser } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, UserPlus, LogIn, GraduationCap, School } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState<Grade>('10');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(username, password);
  };

  const login = (u: string, p: string) => {
    setError('');
    const user = findUser(u);
    if (user && user.password === p) {
      onLogin(user);
    } else {
      setError('Sai tên đăng nhập hoặc mật khẩu.');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (findUser(username)) {
      setError('Tên đăng nhập đã tồn tại.');
      return;
    }
    const newUser: User = {
      id: uuidv4(),
      username,
      password,
      role: 'student', // Default registration is student
      fullName,
      grade,
    };
    saveUser(newUser);
    onLogin(newUser);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 p-3 rounded-full">
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {isLogin ? 'Đăng Nhập EduQuiz' : 'Đăng Ký Tài Khoản'}
        </h2>
        <p className="text-center text-gray-500 mb-6">
          {isLogin ? 'Chào mừng bạn quay trở lại!' : 'Tham gia cùng chúng tôi để luyện tập.'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={isLogin ? handleSubmit : handleRegister} className="space-y-4">
          {!isLogin && (
             <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Họ và Tên</label>
             <input
               type="text"
               required
               className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
               value={fullName}
               onChange={(e) => setFullName(e.target.value)}
             />
           </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Khối Lớp</label>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={grade}
                onChange={(e) => setGrade(e.target.value as Grade)}
              >
                <option value="10">Lớp 10</option>
                <option value="11">Lớp 11</option>
                <option value="12">Lớp 12</option>
              </select>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            {isLogin ? 'Đăng Nhập' : 'Đăng Ký'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-sm text-blue-600 hover:underline"
          >
            {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </div>

        {isLogin && (
          <div className="mt-8 pt-6 border-t border-gray-100">
             <p className="text-xs text-gray-400 text-center mb-3">Đăng nhập nhanh (Demo Mode)</p>
             <div className="grid grid-cols-2 gap-3">
               <button 
                onClick={() => login('admin', '123')}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition"
               >
                 <GraduationCap size={16}/> Giáo viên
               </button>
               <button 
                onClick={() => login('hs10', '123')}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition"
               >
                 <School size={16}/> Học sinh
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;