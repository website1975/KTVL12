
import React, { useState } from 'react';
import { User, Role, Grade } from '../types';
import { findUser, saveUser } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, UserPlus, LogIn } from 'lucide-react';

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
      
      // --- LOGIC TỰ ĐỘNG KHỞI TẠO ADMIN (Safety Net) ---
      // Chỉ giữ lại cho Admin để tránh trường hợp mất Database không vào được.
      if (!user && u === 'admin' && p === '123') {
          console.log("Khởi tạo tài khoản Admin lần đầu...");
          user = {
              id: uuidv4(),
              username: 'admin',
              password: '123',
              role: 'admin',
              fullName: 'Giáo Viên (Admin)',
          };
          await saveUser(user);
      }
      // Đã xóa logic tự tạo Học sinh Demo (hs10)
      // ------------------------------------------

      if (user && user.password === p) {
        onLogin(user);
      } else {
        setError('Sai tên đăng nhập hoặc mật khẩu.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối Server. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // 1. Kiểm tra tên đăng nhập tồn tại chưa
      const existingUser = await findUser(username);
      if (existingUser) {
        setError('Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác.');
        return;
      }

      // 2. Tạo user mới
      const newUser: User = {
        id: uuidv4(),
        username,
        password,
        role: 'student', // Mặc định đăng ký là Học sinh
        fullName,
        grade,
      };

      // 3. Lưu vào DB
      await saveUser(newUser);
      
      // 4. Đăng nhập luôn
      alert(`Đăng ký thành công! Chào mừng ${fullName}.`);
      onLogin(newUser);

    } catch (err) {
      console.error(err);
      setError('Lỗi đăng ký. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
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
          {isLogin ? 'Đăng Nhập EduQuiz' : 'Đăng Ký Học Sinh Mới'}
        </h2>
        <p className="text-center text-gray-500 mb-6">
          {isLogin ? 'Nhập thông tin để vào hệ thống' : 'Tạo tài khoản để bắt đầu luyện thi'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2 animate-pulse">
            <span className="font-bold">!</span> {error}
          </div>
        )}

        <form onSubmit={isLogin ? handleSubmit : handleRegister} className="space-y-4">
          {!isLogin && (
             <div className="animate-fade-in-up">
               <label className="block text-sm font-medium text-gray-700 mb-1">Họ và Tên Học Sinh</label>
               <input
                 type="text"
                 required
                 placeholder="Ví dụ: Nguyễn Văn A"
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
              placeholder="Viết liền không dấu (vd: huan123)"
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
              placeholder="******"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div className="animate-fade-in-up">
              <label className="block text-sm font-medium text-gray-700 mb-1">Đang học Khối lớp</label>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
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
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-blue-200"
          >
            {isLoading ? 'Đang xử lý...' : (
               <>
                 {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                 {isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản Mới'}
               </>
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center border-t pt-4">
          <p className="text-sm text-gray-600 mb-2">{isLogin ? 'Bạn chưa có tài khoản?' : 'Bạn đã có tài khoản?'}</p>
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-blue-600 font-bold hover:underline"
          >
            {isLogin ? '👉 Đăng ký thành viên mới tại đây' : '👈 Quay lại Đăng nhập'}
          </button>
        </div>

        {/* Đã xóa phần nút bấm Demo theo yêu cầu */}
      </div>
    </div>
  );
};

export default Auth;
