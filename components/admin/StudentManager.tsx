
import React from 'react';
import { User, Grade } from '../../types';
import { Search, UserPlus, Eye, Trash2 } from 'lucide-react';

interface StudentManagerProps {
    students: User[];
    sSearch: string;
    setSSearch: (val: string) => void;
    sGradeFilter: Grade | 'all';
    setSGradeFilter: (val: Grade | 'all') => void;
    onAdd: () => void;
    onViewDetail: (user: User) => void;
    onDelete: (id: string, name: string) => void;
}

const StudentManager: React.FC<StudentManagerProps> = ({ students, sSearch, setSSearch, sGradeFilter, setSGradeFilter, onAdd, onViewDetail, onDelete }) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center bg-white p-5 rounded-[2.5rem] border shadow-sm">
                <div className="flex-1 flex gap-4 px-5 py-2 items-center bg-slate-50 border rounded-2xl">
                    <Search className="text-slate-300" size={18}/>
                    <input className="bg-transparent outline-none text-xs font-black w-full" placeholder="Tìm tên hoặc MAHS..." value={sSearch} onChange={e => setSSearch(e.target.value)} />
                </div>
                <button onClick={onAdd} className="ml-4 bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black shadow-xl"><UserPlus size={16}/> THÊM MỚI</button>
            </div>
            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                    <thead><tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400"><th className="p-6">Học sinh</th><th className="p-6">Mã số</th><th className="p-6 text-center">Khối</th><th className="p-6 text-center">Hành động</th><th className="p-6 text-center">Xóa</th></tr></thead>
                    <tbody className="divide-y">
                        {students.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-6 font-bold text-slate-800 uppercase">{u.fullName}</td>
                                <td className="p-6 font-black uppercase text-slate-400">{u.studentCode}</td>
                                <td className="p-6 text-center font-bold text-slate-500">{u.grade}</td>
                                <td className="p-6 text-center">
                                    <button onClick={() => onViewDetail(u)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Eye size={16}/></button>
                                </td>
                                <td className="p-6 text-center"><button onClick={() => onDelete(u.id, u.fullName)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StudentManager;
