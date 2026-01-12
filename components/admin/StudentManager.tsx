
import React from 'react';
import { User, Grade, Result } from '../../types';
import { Search, UserPlus, Eye, Trash2, FileSpreadsheet, Key, Edit3, Clock, Medal } from 'lucide-react';

interface StudentManagerProps {
    students: User[];
    results: Result[]; 
    sSearch: string;
    setSSearch: (val: string) => void;
    sGradeFilter: Grade | 'all';
    setSGradeFilter: (val: Grade | 'all') => void;
    onAdd: () => void;
    onImportCsv: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onViewDetail: (user: User) => void;
    onEdit: (user: User) => void;
    onDelete: (id: string, name: string) => void;
    onResetPassword: (user: User) => void;
}

const StudentManager: React.FC<StudentManagerProps> = ({ 
    students, results, sSearch, setSSearch, sGradeFilter, setSGradeFilter, 
    onAdd, onImportCsv, onViewDetail, onEdit, onDelete, onResetPassword 
}) => {
    const filtered = students.filter(u => 
        (sGradeFilter === 'all' || u.grade === sGradeFilter) &&
        (u.fullName.toLowerCase().includes(sSearch.toLowerCase()) || (u.studentCode && u.studentCode.toLowerCase().includes(sSearch.toLowerCase())))
    );

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] border shadow-sm gap-4">
                <div className="flex-1 flex gap-4 px-5 py-2 items-center bg-slate-50 border rounded-2xl w-full">
                    <Search className="text-slate-300" size={18}/>
                    <input className="bg-transparent outline-none text-xs font-black w-full py-2" placeholder="Tìm tên hoặc MAHS..." value={sSearch} onChange={e => setSSearch(e.target.value)} />
                </div>
                
                <div className="flex gap-3 w-full lg:w-auto">
                    <select className="px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" value={sGradeFilter} onChange={e => setSGradeFilter(e.target.value as any)}>
                        <option value="all">TẤT CẢ KHỐI</option>
                        <option value="12">KHỐI 12</option>
                        <option value="11">KHỐI 11</option>
                        <option value="10">KHỐI 10</option>
                    </select>
                    <label className="flex items-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase cursor-pointer hover:bg-emerald-700 shadow-lg transition-all">
                        <FileSpreadsheet size={16}/> NHẬP CSV
                        <input type="file" accept=".csv" className="hidden" onChange={onImportCsv}/>
                    </label>
                    <button onClick={onAdd} className="bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black shadow-xl transition-all">
                        <UserPlus size={16}/> THÊM MỚI
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="p-6">Học sinh</th>
                            <th className="p-6 text-center">Mã số (MAHS)</th>
                            <th className="p-6 text-center">Khối</th>
                            <th className="p-6 text-center">Điểm tích lũy</th>
                            <th className="p-6 text-center">Tổng TG</th>
                            <th className="p-6 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filtered.map(u => {
                            // TÌM KẾT QUẢ ĐỐI SOÁT QUA ID HOẶC STUDENTCODE ĐỂ ĐẢM BẢO CHÍNH XÁC
                            const userResults = results.filter(r => 
                                r.studentId === u.id || 
                                (u.studentCode && r.studentCode === u.studentCode.toUpperCase())
                            );
                            
                            // TÍNH TOÁN TRỰC TIẾP ĐỂ TRÁNH MÂU THUẪN DỮ LIỆU
                            const totalSeconds = userResults.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
                            const calculatedPoints = userResults.reduce((acc, r) => acc + (r.score || 0), 0);

                            return (
                                <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-6">
                                        <p className="font-black text-slate-800 uppercase text-sm leading-tight">{u.fullName}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">User: {u.username}</p>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 text-xs">{u.studentCode || 'N/A'}</span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-lg text-xs">{u.grade || '-'}</span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex items-center justify-center gap-1.5 text-yellow-600 font-black text-sm">
                                            <Medal size={14} className="text-yellow-500"/>
                                            {calculatedPoints.toFixed(2)}
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex items-center justify-center gap-1.5 text-orange-600 font-black text-xs">
                                            <Clock size={12}/> {formatTime(totalSeconds)}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => onViewDetail(u)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Eye size={16}/></button>
                                            <button onClick={() => onEdit(u)} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"><Edit3 size={16}/></button>
                                            <button onClick={() => onResetPassword(u)} className="p-3 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm"><Key size={16}/></button>
                                            <button onClick={() => onDelete(u.id, u.fullName)} className="p-3 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StudentManager;
