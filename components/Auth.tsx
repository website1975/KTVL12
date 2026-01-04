
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
        setError('Mã số học sinh không tồn tại trong hệ thống!');
      }
    } catch (err) {
      console.error(err);
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
      
      // Tạo tài khoản admin mặc định nếu lần đầu sử dụng
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
      console.error(err);
      setError('Lỗi kết nối.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] p-4 font-sans">
      <div className="bg-white rounded-[3rem] shadow-2xl p-10 md:p-14 w-full max-w-md border border-white relative overflow-hidden">
        {/* Trang trí nền */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>
        
        <div className="flex justify-center mb-10 relative z-10">
          <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-200 rotate-6 hover:rotate-0 transition-transform duration-500">
            <BookOpen className="w-12 h-12 text-white" />
          </div>
        </div>
        
        <div className="text-center mb-10 relative z-10">
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight leading-none">
              {isAdminMode ? 'Hệ thống Quản trị' : 'Phòng thi Online'}
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-4 block">
              {isAdminMode ? 'Dành cho giáo viên & quản trị' : 'Đăng nhập để bắt đầu làm bài'}
            </p>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-red-50 text-red-600 rounded-2xl text-[11px] font-black border border-red-100 flex items-center gap-4 animate-shake">
            <AlertCircle size={20} className="shrink-0" /> {error}
          </div>
        )}

        <div className="relative z-10">
          {!isAdminMode ? (
            <form onSubmit={handleStudentLogin} className="space-y-6">
              <div className="relative group">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-2 tracking-widest">Mã số học sinh (MSHS)</label>
                <div className="relative">
                    <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20}/>
                    <input 
                      type="text" 
                      required 
                      autoFocus
                      placeholder="VD: HS12-001"
                      className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all font-black text-slate-700 placeholder:text-slate-200 text-lg uppercase tracking-wider" 
                      value={studentCode} 
                      onChange={(e) => setStudentCode(e.target.value.toUpperCase())} 
                    />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-2 tracking-widest">Mật khẩu</label>
                <div className="relative">
                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20}/>
                    <input 
                      type="password" 
                      required 
                      placeholder="••••••"
                      className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all font-black text-slate-700 placeholder:text-slate-200 text-lg" 
                      value={studentPassword} 
                      onChange={(e) => setStudentPassword(e.target.value)} 
                    />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-3 active:scale-95 mt-4">
                {isLoading ? <Loader2 className="animate-spin" size={20}/> : <ShieldCheck size={20}/>}
                {isLoading ? 'Đang xác thực...' : 'Đăng nhập thi'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Tên đăng nhập Admin</label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Mật khẩu</label>
                <input 
                  type="password" 
                  required 
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white font-black py-6 rounded-2xl hover:bg-black transition-all shadow-xl uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95">
                {isLoading ? <Loader2 className="animate-spin" size={20}/> : null}
                {isLoading ? 'Đang xử lý...' : 'Đăng nhập Quản trị'}
              </button>
            </form>
          )}
        </div>
        
        <div className="mt-12 text-center pt-8 border-t border-slate-50 relative z-10">
          <button 
            onClick={() => { setIsAdminMode(!isAdminMode); setError(''); }} 
            className="text-slate-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-3 mx-auto py-2 px-4 rounded-full hover:bg-blue-50"
          >
            {isAdminMode ? <UserCircle size={18}/> : <ShieldCheck size={18}/>}
            {isAdminMode ? 'Quay lại chế độ Học sinh' : 'Dành cho Giáo viên'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
