
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
        setError('Mã định danh không tồn tại hoặc đã bị khóa!');
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
      <div className="bg-white rounded-[3rem] shadow-2xl p-12 w-full max-w-md border border-white relative overflow-hidden">
        {/* Trang trí nền */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-50 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-50 rounded-full blur-3xl"></div>
        
        <div className="flex justify-center mb-10 relative z-10">
          <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-200 rotate-6 hover:rotate-0 transition-transform duration-500">
            <BookOpen className="w-12 h-12 text-white" />
          </div>
        </div>
        
        <div className="text-center mb-10 relative z-10">
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
              {isAdminMode ? 'Quản Trị Viên' : 'Chào mừng bạn'}
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-3">
              {isAdminMode ? 'Hệ thống điều hành EduQuiz' : 'Vui lòng nhập mã định danh'}
            </p>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-red-50 text-red-600 rounded-2xl text-[11px] font-black border border-red-100 flex items-center gap-4 animate-shake">
            <AlertCircle size={20} className="shrink-0" /> {error}
          </div>
        )}

        <div className="relative z-10">
          {!isAdminMode ? (
            <form onSubmit={handleStudentLogin} className="space-y-8">
              <div className="relative group">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-2 tracking-widest">Mã số học sinh</label>
                <div className="relative">
                    <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={24}/>
                    <input 
                      type="text" 
                      required 
                      placeholder="VD: HS12-001"
                      className="w-full pl-16 pr-8 py-6 bg-slate-50 border-2 border-transparent rounded-[2rem] outline-none focus:border-blue-500 focus:bg-white transition-all font-black text-slate-700 placeholder:text-slate-200 text-xl tracking-wider" 
                      value={studentCode} 
                      onChange={(e) => setStudentCode(e.target.value.toUpperCase())} 
                    />
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-3">
                {isLoading ? <Loader2 className="animate-spin" size={20}/> : <ShieldCheck size={20}/>}
                {isLoading ? 'Đang xác thực...' : 'Vào phòng thi'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Tên đăng nhập</label>
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
              <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white font-black py-6 rounded-2xl hover:bg-black transition-all shadow-xl uppercase text-xs tracking-[0.2em]">
                {isLoading ? 'Đang xử lý...' : 'Đăng nhập hệ thống'}
              </button>
            </form>
          )}
        </div>
        
        <div className="mt-12 text-center pt-8 border-t border-slate-50 relative z-10">
          <button 
            onClick={() => { setIsAdminMode(!isAdminMode); setError(''); }} 
            className="text-slate-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-3 mx-auto"
          >
            {isAdminMode ? <UserCircle size={18}/> : <ShieldCheck size={18}/>}
            {isAdminMode ? 'Chế độ Học sinh' : 'Dành cho Giáo viên'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
