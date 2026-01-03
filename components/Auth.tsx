
import React, { useState } from 'react';
import { User, Role, Grade } from '../types';
import { findUser, saveUser, getUsers, findUserByStudentCode } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, UserPlus, LogIn, Hash, AlertCircle } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [grade, setGrade] = useState<Grade>('12');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };

  const login = async (u: string, p: string) => {
    setError('');
    setIsLoading(true);
    try {
      let user = await findUser(u);
      
      if (!user && u === 'admin' && p === '123') {
          user = {
              id: uuidv4(),
              username: 'admin',
              password: '123',
              role: 'admin',
              fullName: 'Giáo Viên (Admin)',
          };
          await saveUser(user);
      }

      if (user && user.password === p) {
        onLogin(user);
      } else {
        setError('Sai tên đăng nhập hoặc mật khẩu.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối Server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim()) { setError('Vui lòng nhập Mã số học sinh.'); return; }
    
    setError('');
    setIsLoading(true);
    try {
      const existingUser = await findUser(username);
      if (existingUser) {
        setError('Tên đăng nhập này đã có người sử dụng.');
        return;
      }

      const codeExists = await findUserByStudentCode(studentCode.trim());
      if (codeExists) {
        setError(`Mã HS ${studentCode.toUpperCase()} đã được đăng ký tài khoản (${codeExists.username}).`);
        return;
      }

      const newUser: User = {
        id: uuidv4(),
        username: username.trim().toLowerCase(),
        password: password.trim(),
        role: 'student',
        fullName: fullName.trim(),
        studentCode: studentCode.trim().toUpperCase(),
        grade,
      };

      await saveUser(newUser);
      alert(`Đăng ký thành công!`);
      onLogin(newUser);

    } catch (err) {
      console.error(err);
      setError('Lỗi đăng ký. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl p-10 w-full max-w-md border-8 border-white/20 animate-fade-in-up">
        <div className="flex justify-center mb-8">
          <div className="bg-blue-100 p-5 rounded-[2rem] shadow-inner text-blue-600">
            <BookOpen className="w-10 h-10" />
          </div>
        </div>
        
        <h2 className="text-2xl font-black text-center text-slate-800 mb-1 uppercase tracking-tight">
          {isLogin ? 'Đăng Nhập' : 'Đăng Ký Học Sinh'}
        </h2>
        <p className="text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-10">
          EduQuiz VN - THPT PRO
        </p>

        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-2xl text-[11px] font-bold border border-red-100 flex items-center gap-2 animate-bounce">
            <AlertCircle size={16}/> {error}
          </div>
        )}

        <form onSubmit={isLogin ? handleSubmit : handleRegister} className="space-y-5">
          {!isLogin && (
             <div className="space-y-5 animate-fade-in">
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">Mã số học sinh</label>
                 <div className="relative">
                    <Hash className="absolute left-4 top-4 text-slate-300" size={16}/>
                    <input type="text" required placeholder="VD: 24001" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none text-sm font-black" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
                 </div>
               </div>
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">Họ và Tên</label>
                 <input type="text" required placeholder="Nguyễn Văn A" className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none text-sm font-black" value={fullName} onChange={(e) => setFullName(e.target.value)} />
               </div>
             </div>
          )}
          
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">Tên đăng nhập</label>
            <input type="text" required placeholder="huan123" className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none text-sm font-black" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">Mật khẩu</label>
            <input type="password" required placeholder="******" className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none text-sm font-black" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {!isLogin && (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">Khối lớp</label>
              <select className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none text-sm font-black" value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
                <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
              </select>
            </div>
          )}

          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl transition-all shadow-2xl shadow-blue-200 flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 disabled:opacity-70 text-[11px] uppercase tracking-widest mt-6">
            {isLoading ? 'Đang xử lý...' : (isLogin ? 'Đăng Nhập' : 'Hoàn Tất Đăng Ký')}
          </button>
        </form>
        
        <div className="mt-10 text-center border-t border-slate-50 pt-8">
          <p className="text-[10px] font-black text-slate-300 uppercase mb-4 tracking-widest">{isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}</p>
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-blue-600 font-black text-[11px] uppercase tracking-widest hover:underline">
            {isLogin ? '👉 Đăng ký mới' : '👈 Trở lại Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
