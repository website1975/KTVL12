
import React, { useState } from 'react';
import { User } from '../types';
import { findUser, saveUser, findUserByStudentCode } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, Hash, AlertCircle, ShieldCheck, UserCircle, Loader2, Lock } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!studentCode || !studentPassword) return;
    setIsLoading(true);
    try {
      const user = await findUserByStudentCode(studentCode.trim());
      if (user) {
        if (user.password === studentPassword) {
            onLogin(user);
        } else {
            setError('Mật khẩu không chính xác!');
        }
      } else {
        setError('Mã số học sinh không tồn tại!');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      let user = await findUser(username.trim());
      if (!user && username === 'admin' && password === '123') {
          user = {
              id: uuidv4(),
              username: 'admin',
              password: '123',
              role: 'admin',
              fullName: 'Quản Trị Viên',
          };
          await saveUser(user);
      }
      if (user && user.role === 'admin' && user.password === password) {
        onLogin(user);
      } else {
        setError('Sai tài khoản hoặc mật khẩu Admin.');
      }
    } catch (err) {
      setError('Lỗi kết nối.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-200 p-4 font-sans antialiased">
      <div className="bg-white border-2 border-gray-800 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 w-full max-w-sm rounded-none">
        
        <div className="flex items-center gap-3 mb-6 border-b-2 border-gray-800 pb-4">
          <div className="bg-gray-800 p-2 rounded-none">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight leading-none">
              {isAdminMode ? 'ADMIN LOGIN' : 'STUDENT LOGIN'}
            </h2>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              {isAdminMode ? 'Hệ thống quản trị' : 'Phòng thi trực tuyến'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-2 rounded-none">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-4">
          {!isAdminMode ? (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1 ml-1 tracking-wider">Mã số học sinh (MAHS)</label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  placeholder="VD: HS12-001"
                  className="w-full px-4 py-3 bg-white border-2 border-gray-800 rounded-none outline-none focus:bg-blue-50 transition-all font-black text-gray-800 placeholder:text-gray-300 text-sm uppercase" 
                  value={studentCode} 
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1 ml-1 tracking-wider">Mật khẩu</label>
                <input 
                  type="password" 
                  required 
                  placeholder="••••••"
                  className="w-full px-4 py-3 bg-white border-2 border-gray-800 rounded-none outline-none focus:bg-blue-50 transition-all font-black text-gray-800 placeholder:text-gray-300 text-sm" 
                  value={studentPassword} 
                  onChange={(e) => setStudentPassword(e.target.value)} 
                />
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-gray-800 text-white font-black py-4 rounded-none hover:bg-black transition-all uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2 mt-2 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)] active:shadow-none active:translate-x-1 active:translate-y-1">
                {isLoading ? <Loader2 className="animate-spin" size={16}/> : <ShieldCheck size={16}/>}
                {isLoading ? 'XÁC THỰC...' : 'ĐĂNG NHẬP THI'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1 ml-1">Username Admin</label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-4 py-3 bg-white border-2 border-gray-800 rounded-none outline-none focus:bg-gray-50 transition-all font-bold text-gray-800 text-sm" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1 ml-1">Password</label>
                <input 
                  type="password" 
                  required 
                  className="w-full px-4 py-3 bg-white border-2 border-gray-800 rounded-none outline-none focus:bg-gray-50 transition-all font-bold text-gray-800 text-sm" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-black py-4 rounded-none hover:bg-blue-700 transition-all uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2 mt-2 shadow-[4px_4px_0px_0px_rgba(31,41,55,1)] active:shadow-none active:translate-x-1 active:translate-y-1">
                {isLoading ? <Loader2 className="animate-spin" size={16}/> : null}
                {isLoading ? 'ĐANG XỬ LÝ...' : 'VÀO QUẢN TRỊ'}
              </button>
            </form>
          )}
        </div>
        
        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <button 
            onClick={() => { setIsAdminMode(!isAdminMode); setError(''); }} 
            className="text-gray-400 hover:text-blue-600 font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {isAdminMode ? <UserCircle size={14}/> : <Lock size={14}/>}
            {isAdminMode ? 'HỌC SINH ĐĂNG NHẬP' : 'DÀNH CHO GIÁO VIÊN'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
