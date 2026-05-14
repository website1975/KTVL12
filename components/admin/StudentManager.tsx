
import React, { useState, useEffect } from 'react';
import { User, Grade, Result, Quiz } from '../../types';
import { isDatabaseConnected } from '../../services/storage';
import { Search, UserPlus, Eye, Trash2, FileSpreadsheet, Key, Edit3, Clock, Medal, Info, ChevronDown, CloudCheck, Database, RefreshCw, Loader2 } from 'lucide-react';

interface StudentManagerProps {
    students: User[];
    results: Result[]; 
    quizzes: Quiz[];
    sSearch: string;
    setSSearch: (val: string) => void;
    sGradeFilter: Grade | 'all';
    setSGradeFilter: (val: Grade | 'all') => void;
    onAdd: () => void;
    onRefresh: () => void;
    onImportCsv: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onViewDetail: (user: User) => void;
    onEdit: (user: User) => void;
    onDelete: (id: string, name: string) => void;
    onBulkDelete: (ids: string[]) => void;
    onResetPassword: (user: User) => void;
    totalCount: number;
    onLoadMore: () => void;
    isMoreLoading: boolean;
}

const PAGE_SIZE = 20;

export default function StudentManager({ 
    students, results, quizzes, sSearch, setSSearch, sGradeFilter, setSGradeFilter, 
    onAdd, onRefresh, onImportCsv, onViewDetail, onEdit, onDelete, onBulkDelete, onResetPassword,
    totalCount, onLoadMore, isMoreLoading
}: StudentManagerProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const filtered = students.filter(u => 
        (sGradeFilter === 'all' || u.grade === sGradeFilter) &&
        (u.fullName.toLowerCase().includes(sSearch.toLowerCase()) || (u.studentCode && u.studentCode.toLowerCase().includes(sSearch.toLowerCase())))
    );

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filtered.map(u => u.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleToggleStudent = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        if (selectedIds.length === 0) return;
        if (confirm(`Bạn có chắc muốn xóa vĩnh viễn ${selectedIds.length} học sinh đã chọn? Hành động này sẽ xóa toàn bộ lịch sử điểm số liên quan và không thể hoàn tác.`)) {
            onBulkDelete(selectedIds);
            setSelectedIds([]);
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const handleExportCsv = () => {
        const headers = ['Tên học sinh', 'Mã số (MAHS)', 'Khối', 'Điểm rèn (Tích lũy)', 'Thời gian luyện'];
        const rows = filtered.map(u => {
            const userResults = results.filter(r => 
                r.studentId === u.id || 
                (u.studentCode && r.studentCode && r.studentCode.trim().toUpperCase() === u.studentCode.trim().toUpperCase())
            );
            
            const totalSeconds = userResults.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
            const timePoints = totalSeconds / 2700;

            const bonusPoints = userResults.reduce((acc, r) => {
                const bp = (r as any).bonusPoint;
                if (bp !== undefined && bp !== null) {
                    return acc + Number(bp);
                }
                if (r.score >= 8) return acc + 1;
                return acc;
            }, 0);
            
            const totalAccumulated = timePoints + bonusPoints;

            return [
                u.fullName,
                u.studentCode || 'N/A',
                u.grade || '-',
                totalAccumulated.toFixed(2),
                formatTime(totalSeconds)
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ket_qua_ren_luyen_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] border shadow-sm gap-4">
                <div className="flex-1 flex gap-4 px-5 py-2 items-center bg-slate-50 border rounded-2xl w-full">
                    <Search className="text-slate-300" size={18}/>
                    <input className="bg-transparent outline-none text-xs font-black w-full py-2" placeholder="Tìm tên hoặc MAHS..." value={sSearch} onChange={e => setSSearch(e.target.value)} />
                </div>
                
                <div className="flex flex-col gap-2 w-full lg:w-auto">
                    <div className="flex gap-3">
                        {selectedIds.length > 0 && (
                            <button onClick={handleBulkDelete} className="flex items-center gap-2 px-6 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-black shadow-xl transition-all">
                                <Trash2 size={16}/> XÓA ĐÃ CHỌN ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={onRefresh} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl hover:bg-slate-900 hover:text-white transition-all text-[10px] font-black uppercase">
                            <RefreshCw size={14}/> Làm mới Cloud
                        </button>
                        <select className="px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" value={sGradeFilter} onChange={e => setSGradeFilter(e.target.value as any)}>
                            <option value="all">TẤT CẢ KHỐI</option>
                            <option value="12">KHỐI 12</option>
                            <option value="11">KHỐI 11</option>
                            <option value="10">KHỐI 10</option>
                        </select>
                        <button onClick={handleExportCsv} className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-blue-700 shadow-lg transition-all">
                            <FileSpreadsheet size={16}/> KẾT QUẢ RÈN
                        </button>
                        <label className="flex items-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase cursor-pointer hover:bg-emerald-700 shadow-lg transition-all">
                            <FileSpreadsheet size={16}/> NHẬP CSV
                            <input type="file" accept=".csv" className="hidden" onChange={onImportCsv}/>
                        </label>
                        <button onClick={onAdd} className="bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black shadow-xl transition-all">
                            <UserPlus size={16}/> THÊM MỚI
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="p-6 w-12">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                                    onChange={e => handleSelectAll(e.target.checked)}
                                />
                            </th>
                            <th className="p-6">Học sinh (Cloud ID)</th>
                            <th className="p-6 text-center">Mã số (MAHS)</th>
                            <th className="p-6 text-center">Khối</th>
                            <th className="p-6 text-center">Điểm tích lũy</th>
                            <th className="p-6 text-center">Tổng TG</th>
                            <th className="p-6 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filtered.map(u => {
                            const userResults = results.filter(r => 
                                r.studentId === u.id || 
                                (u.studentCode && r.studentCode && r.studentCode.trim().toUpperCase() === u.studentCode.trim().toUpperCase())
                            );
                            
                            const totalSeconds = userResults.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
                            const timePoints = totalSeconds / 2700;

                            const bonusPoints = userResults.reduce((acc, r) => {
                                const bp = (r as any).bonusPoint;
                                if (bp !== undefined && bp !== null) {
                                    return acc + Number(bp);
                                }
                                if (r.score >= 8) return acc + 1;
                                return acc;
                            }, 0);
                            
                            const totalAccumulated = timePoints + bonusPoints;
                            const isSelected = selectedIds.includes(u.id);

                            return (
                                <tr key={u.id} className={`hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-6">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={isSelected}
                                            onChange={() => handleToggleStudent(u.id)}
                                        />
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg" title="Đã đồng bộ Cloud">
                                                <Database size={14}/>
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase text-sm leading-tight">{u.fullName}</p>
                                                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-0.5 italic">Học sinh hệ thống</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 text-xs">{u.studentCode || 'N/A'}</span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-lg text-xs">{u.grade || '-'}</span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-1.5 text-yellow-600 font-black text-sm">
                                                <Medal size={14} className="text-yellow-500"/>
                                                {totalAccumulated.toFixed(2)}
                                            </div>
                                            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">({timePoints.toFixed(1)} nỗ lực + {bonusPoints} thưởng)</p>
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
                {students.length < totalCount && isDatabaseConnected() && (
                    <div className="p-8 text-center bg-slate-50/50">
                        <button 
                            onClick={onLoadMore}
                            disabled={isMoreLoading}
                            className="inline-flex items-center gap-2 px-8 py-3 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm disabled:opacity-50"
                        >
                            {isMoreLoading ? <Loader2 className="animate-spin" size={14}/> : <ChevronDown size={14}/>} 
                            Tải thêm từ Cloud (Tổng: {totalCount}, Đã tải: {students.length})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
