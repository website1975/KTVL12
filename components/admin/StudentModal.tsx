
import React from 'react';
import { X, UserPlus, Save, Loader2, GraduationCap } from 'lucide-react';
import { User, Grade, ClassRoom } from '../../types';

interface StudentModalProps {
    isOpen: boolean;
    student: User | null;
    form: { 
        fullName: string; 
        studentCode: string; 
        grade: Grade; 
        password: string;
        classId?: string;
        className?: string;
        academicYear?: string;
    };
    setForm: (form: any) => void;
    classes?: ClassRoom[];
    onClose: () => void;
    onSave: () => void;
    isSaving?: boolean;
    isDuplicate?: boolean;
}

export default function StudentModal({ 
    isOpen, 
    student, 
    form, 
    setForm, 
    classes = [], 
    onClose, 
    onSave, 
    isSaving, 
    isDuplicate 
}: StudentModalProps) {
    if (!isOpen) return null;

    const handleClassChange = (selectedClassId: string) => {
        if (!selectedClassId) {
            setForm({
                ...form,
                classId: '',
                className: '',
                academicYear: ''
            });
            return;
        }
        const found = classes.find(c => c.id === selectedClassId);
        if (found) {
            setForm({
                ...form,
                classId: found.id,
                className: found.name,
                academicYear: found.academicYear,
                grade: found.grade
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[3rem] w-full max-w-md flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl"><UserPlus size={24}/></div>
                        <h3 className="text-lg font-black uppercase tracking-tight">{student ? 'SỬA HỌC SINH' : 'THÊM HỌC SINH'}</h3>
                    </div>
                    <button onClick={onClose} disabled={isSaving} className="p-3 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-30"><X/></button>
                </div>
                <div className="p-10 space-y-5">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-blue-500 uppercase">1. Mã học sinh (MAHS)</label>
                            {isDuplicate && <span className="text-[9px] font-black text-red-500 uppercase animate-pulse">Mã đã tồn tại!</span>}
                        </div>
                        <input 
                            disabled={isSaving} 
                            className={`w-full p-4 bg-slate-50 border-2 ${isDuplicate ? 'border-red-500 bg-red-50' : 'border-slate-100 focus:border-blue-500'} rounded-2xl font-black uppercase outline-none disabled:opacity-50 transition-all`} 
                            value={form.studentCode} 
                            onChange={e => setForm({...form, studentCode: e.target.value})} 
                            placeholder="VÍ DỤ: HS001" 
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">2. Họ và tên</label>
                        <input disabled={isSaving} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none disabled:opacity-50" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="Nhập tên..." />
                    </div>

                    {/* Lớp học & Niên khóa */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1">
                            <GraduationCap size={13} /> 3. Lớp học & Niên khóa
                        </label>
                        <select 
                            disabled={isSaving}
                            className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-black disabled:opacity-50 outline-none focus:border-indigo-500"
                            value={form.classId || ''}
                            onChange={e => handleClassChange(e.target.value)}
                        >
                            <option value="">-- Chưa phân lớp --</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} • Niên khóa {c.academicYear} (Khối {c.grade})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">4. Khối</label>
                            <select disabled={isSaving} className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-black disabled:opacity-50" value={form.grade} onChange={e => setForm({...form, grade: e.target.value as Grade})}>
                                <option value="12">Khối 12</option>
                                <option value="11">Khối 11</option>
                                <option value="10">Khối 10</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">5. Mật khẩu</label>
                            <input disabled={isSaving} type="password" title="password" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold disabled:opacity-50" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                        </div>
                    </div>

                    <button 
                        onClick={onSave} 
                        disabled={isSaving}
                        className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl mt-4 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                        {isSaving ? 'ĐANG LƯU VÀO CLOUD...' : 'LƯU THÔNG TIN'}
                    </button>
                    {isSaving && (
                        <p className="text-[10px] text-center font-black text-blue-600 uppercase animate-pulse">Vui lòng không tắt trình duyệt...</p>
                    )}
                </div>
            </div>
        </div>
    );
}
