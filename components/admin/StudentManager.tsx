
import React, { useState, useEffect } from 'react';
import { User, Grade, Result, Quiz, ClassRoom } from '../../types';
import { isDatabaseConnected } from '../../services/storage';
import { 
  Search, UserPlus, Eye, Trash2, FileSpreadsheet, Key, Edit3, Clock, 
  Medal, Info, ChevronDown, CloudCheck, Database, RefreshCw, Loader2, 
  GraduationCap, Check, X 
} from 'lucide-react';

interface StudentManagerProps {
    students: User[];
    results: Result[]; 
    quizzes: Quiz[];
    classes?: ClassRoom[];
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
    onBulkAssignClass?: (studentIds: string[], classInfo: any) => Promise<void>;
    onResetPassword: (user: User) => void;
    totalCount: number;
    onLoadMore: () => void;
    isMoreLoading: boolean;
}

const PAGE_SIZE = 20;

export default function StudentManager({ 
    students, results, quizzes, classes = [], sSearch, setSSearch, sGradeFilter, setSGradeFilter, 
    onAdd, onRefresh, onImportCsv, onViewDetail, onEdit, onDelete, onBulkDelete, onBulkAssignClass, onResetPassword,
    totalCount, onLoadMore, isMoreLoading
}: StudentManagerProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [deleteBulkConfirm, setDeleteBulkConfirm] = useState(false);
    const [sClassFilter, setSClassFilter] = useState<string>('all');
    const [isBulkClassModalOpen, setIsBulkClassModalOpen] = useState(false);
    const [targetClassId, setTargetClassId] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);

    const filtered = students.filter(u => {
        const matchGrade = sGradeFilter === 'all' || u.grade === sGradeFilter;
        const matchSearch = u.fullName.toLowerCase().includes(sSearch.toLowerCase()) || 
                            (u.studentCode && u.studentCode.toLowerCase().includes(sSearch.toLowerCase())) ||
                            (u.className && u.className.toLowerCase().includes(sSearch.toLowerCase()));
        const matchClass = sClassFilter === 'all' || 
                           (sClassFilter === 'unassigned' && !u.classId && !u.className) ||
                           u.classId === sClassFilter ||
                           u.className === sClassFilter;
        return matchGrade && matchSearch && matchClass;
    });

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
        setDeleteBulkConfirm(true);
    };

    const confirmBulkDelete = () => {
        onBulkDelete(selectedIds);
        setSelectedIds([]);
        setDeleteBulkConfirm(false);
    };

    const handleConfirmBulkAssignClass = async () => {
        if (!onBulkAssignClass || selectedIds.length === 0) return;
        setIsAssigning(true);
        try {
            if (!targetClassId) {
                // Bỏ phân lớp
                await onBulkAssignClass(selectedIds, null);
            } else {
                const found = classes.find(c => c.id === targetClassId);
                if (found) {
                    await onBulkAssignClass(selectedIds, {
                        classId: found.id,
                        className: found.name,
                        academicYear: found.academicYear,
                        grade: found.grade
                    });
                }
            }
            setIsBulkClassModalOpen(false);
            setSelectedIds([]);
            setTargetClassId('');
        } catch (e) {
            alert("Lỗi gán lớp hàng loạt.");
        } finally {
            setIsAssigning(false);
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const handleExportCsv = () => {
        const headers = ['Tên học sinh', 'Mã số (MAHS)', 'Khối', 'Lớp', 'Niên khóa', 'Điểm rèn (Tích lũy)', 'Thời gian luyện'];
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
                `"${u.fullName.replace(/"/g, '""')}"`,
                `"${(u.studentCode || 'N/A').replace(/"/g, '""')}"`,
                `"${u.grade || '-'}"`,
                `"${(u.className || 'Chưa phân lớp').replace(/"/g, '""')}"`,
                `"${(u.academicYear || '-').replace(/"/g, '""')}"`,
                totalAccumulated.toFixed(2),
                `"${formatTime(totalSeconds)}"`
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `danh_sach_hoc_sinh_lop_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white p-5 rounded-[2.5rem] border shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    <div className="flex-1 min-w-[280px] flex gap-2.5 px-4 py-2 items-center bg-slate-50 border-2 border-slate-200 rounded-2xl focus-within:border-blue-500 focus-within:bg-white transition-all">
                        <Search className="text-slate-400 shrink-0" size={16}/>
                        <input 
                            className="bg-transparent outline-none text-xs font-bold w-full placeholder:text-slate-400 text-slate-800" 
                            placeholder="Tìm tên học sinh, MAHS hoặc lớp..." 
                            value={sSearch} 
                            onChange={e => setSSearch(e.target.value)} 
                        />
                        {sSearch && (
                            <button 
                                onClick={() => setSSearch('')}
                                className="text-slate-400 hover:text-slate-600 text-xs font-black p-1"
                                title="Xóa tìm kiếm"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {selectedIds.length > 0 && (
                            <>
                                <button 
                                    onClick={() => {
                                        setTargetClassId('');
                                        setIsBulkClassModalOpen(true);
                                    }} 
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 shadow-xs transition-all whitespace-nowrap"
                                >
                                    <GraduationCap size={13}/> Gán lớp ({selectedIds.length})
                                </button>
                                <button 
                                    onClick={handleBulkDelete} 
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-black shadow-xs transition-all whitespace-nowrap"
                                >
                                    <Trash2 size={13}/> Xóa ({selectedIds.length})
                                </button>
                            </>
                        )}
                        <button 
                            onClick={onRefresh} 
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-900 hover:text-white transition-all text-[10px] font-black uppercase whitespace-nowrap"
                            title="Tải lại danh sách"
                        >
                            <RefreshCw size={12}/> Làm mới
                        </button>
                        
                        {/* Lọc theo Khối */}
                        <select 
                            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none text-slate-700 cursor-pointer hover:border-slate-300 transition-colors" 
                            value={sGradeFilter} 
                            onChange={e => setSGradeFilter(e.target.value as any)}
                        >
                            <option value="all">TẤT CẢ KHỐI</option>
                            <option value="12">KHỐI 12</option>
                            <option value="11">KHỐI 11</option>
                            <option value="10">KHỐI 10</option>
                        </select>

                        {/* Lọc theo Lớp học */}
                        <select 
                            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none text-slate-700 cursor-pointer hover:border-slate-300 transition-colors max-w-[140px] truncate" 
                            value={sClassFilter} 
                            onChange={e => setSClassFilter(e.target.value)}
                        >
                            <option value="all">TẤT CẢ LỚP</option>
                            <option value="unassigned">CHƯA PHÂN LỚP</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.academicYear})
                                </option>
                            ))}
                        </select>

                        <button 
                            onClick={handleExportCsv} 
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 shadow-xs transition-all whitespace-nowrap"
                        >
                            <FileSpreadsheet size={12}/> Xuất CSV
                        </button>
                        <label 
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer hover:bg-emerald-700 shadow-xs transition-all whitespace-nowrap"
                        >
                            <FileSpreadsheet size={12}/> Nhập CSV
                            <input type="file" accept=".csv" className="hidden" onChange={onImportCsv}/>
                        </label>
                        <button 
                            onClick={onAdd} 
                            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-black shadow-xs transition-all whitespace-nowrap"
                        >
                            <UserPlus size={12}/> Thêm mới
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
                            <th className="p-6 text-center">Lớp & Niên khóa</th>
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
                                        {u.className ? (
                                            <div className="inline-flex flex-col items-center">
                                                <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg text-xs uppercase">
                                                    {u.className}
                                                </span>
                                                {u.academicYear && (
                                                    <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                        {u.academicYear}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-xs italic">Chưa phân lớp</span>
                                        )}
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
                                            <button onClick={() => onViewDetail(u)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Chi tiết"><Eye size={16}/></button>
                                            <button onClick={() => onEdit(u)} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm" title="Sửa"><Edit3 size={16}/></button>
                                            <button onClick={() => onResetPassword(u)} className="p-3 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm" title="Đổi mật khẩu"><Key size={16}/></button>
                                            <button onClick={() => onDelete(u.id, u.fullName)} className="p-3 text-slate-200 hover:text-red-500 transition-colors" title="Xóa"><Trash2 size={16}/></button>
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

            {/* MODAL BULK GÁN LỚP */}
            {isBulkClassModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
                    <div className="bg-white max-w-md w-full rounded-[2.5rem] border shadow-2xl p-8 overflow-hidden animate-scale-up space-y-6">
                        <div className="flex items-center gap-3 border-b pb-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                <GraduationCap size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase">
                                    Gán {selectedIds.length} học sinh vào Lớp
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold">
                                    Tài khoản & điểm số của học sinh vẫn giữ nguyên
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                                Chọn Lớp học & Niên khóa đích:
                            </label>
                            <select
                                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-xs outline-none focus:border-indigo-500"
                                value={targetClassId}
                                onChange={e => setTargetClassId(e.target.value)}
                            >
                                <option value="">-- Bỏ phân lớp (Trở về Chưa phân lớp) --</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} • Niên khóa {c.academicYear} (Khối {c.grade})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setIsBulkClassModalOpen(false)}
                                className="px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirmBulkAssignClass}
                                disabled={isAssigning}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                <Check size={16} /> {isAssigning ? 'Đang cập nhật...' : 'Xác nhận gán'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteBulkConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
                    <div className="bg-white max-w-md w-full rounded-3xl border shadow-2xl p-6 overflow-hidden animate-scale-up">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="p-3 bg-red-50 text-red-600 rounded-2xl shrink-0">
                                <Trash2 size={24} className="text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1 leading-tight">Xóa vĩnh viễn học sinh</h3>
                                <p className="text-xs text-slate-500 font-bold leading-relaxed break-words">
                                    Bạn có chắc muốn xóa vĩnh viễn <strong className="text-slate-800">{selectedIds.length} học sinh</strong> đã chọn? Hành động này sẽ xóa toàn bộ lịch sử điểm số liên quan và <strong className="text-red-600">không thể hoàn tác</strong>.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setDeleteBulkConfirm(false)} className="px-5 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase transition-all">
                                Hủy
                            </button>
                            <button onClick={confirmBulkDelete} className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl text-[10px] font-black uppercase transition-all shadow-md shadow-red-100">
                                Xác nhận xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
