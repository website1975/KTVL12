
import React, { useState } from 'react';
import { User, Role, Grade } from '../types';
import { findUser, saveUser, findUserByStudentCode } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, Hash, AlertCircle, ShieldCheck, UserCircle, Loader2 } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!studentCode) return;
    setIsLoading(true);
    try {
      const user = await findUserByStudentCode(studentCode);
      if (user) {
        onLogin(user);
      } else {
        setError('Mã số không hợp lệ hoặc tài khoản đã bị khóa!');
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
      let user = await findUser(username);
      // Tài khoản mặc định nếu chưa có admin
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
        setError('Tài khoản hoặc mật khẩu Admin không đúng.');
      }
    } catch (err) {
      setError('Lỗi kết nối.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] p-4 font-sans">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 w-full max-w-md border border-white relative overflow-hidden">
        {/* Decor */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full blur-3xl"></div>
        
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-100 rotate-3">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
        </div>
        
        <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
              {isAdminMode ? 'Hệ thống Quản trị' : 'Đăng nhập Thi'}
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
              {isAdminMode ? 'Dành cho Giáo viên' : 'Nhập mã định danh để bắt đầu'}
            </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-[11px] font-black border border-red-100 flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" /> {error}
          </div>
        )}

        {!isAdminMode ? (
          <form onSubmit={handleStudentLogin} className="space-y-6">
            <div className="relative group">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Mã số học sinh của bạn</label>
              <div className="relative">
                  <Hash className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20}/>
                  <input 
                    type="text" 
                    required 
                    placeholder="VD: HS12-001"
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] outline-none focus:border-blue-500 focus:bg-white transition-all font-black text-slate-700 placeholder:text-slate-200 text-lg" 
                    value={studentCode} 
                    onChange={(e) => setStudentCode(e.target.value.toUpperCase())} 
                  />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="animate-spin" size={18}/> : <ShieldCheck size={18}/>}
              {isLoading ? 'Đang xác thực...' : 'Vào hệ thống thi'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Tài khoản quản trị</label>
              <input 
                type="text" 
                required 
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Mật khẩu</label>
              <input 
                type="password" 
                required 
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-black transition-all shadow-lg uppercase text-xs tracking-widest">
              {isLoading ? 'Đang xử lý...' : 'Đăng nhập Admin'}
            </button>
          </form>
        )}
        
        <div className="mt-10 text-center pt-6 border-t border-slate-50">
          <button 
            onClick={() => { setIsAdminMode(!isAdminMode); setError(''); }} 
            className="text-slate-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {isAdminMode ? <UserCircle size={16}/> : <ShieldCheck size={16}/>}
            {isAdminMode ? 'Chế độ Học sinh' : 'Dành cho Giáo viên'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
