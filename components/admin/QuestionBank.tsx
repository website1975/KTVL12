
import React, { useState, useMemo, useEffect } from 'react';
import { Question, QuestionType, Grade, Chapter, QuestionLevel } from '../../types';
import { Database, Search, CheckCircle2, CheckSquare, Square, X, BookOpen, Bookmark, Image as ImageIcon, Eye, MousePointer, Maximize2, Layers, FolderTree, Zap } from 'lucide-react';
import LatexText from '../LatexText';
import { v4 as uuidv4 } from 'uuid';

interface QuestionBankProps {
    questions: Question[];
    chapters: Chapter[];
    bGradeFilter: Grade | 'all';
    setBGradeFilter: (val: Grade | 'all') => void;
    bChapterFilter: string;
    setBChapterFilter: (val: string) => void;
    bTypeFilter: QuestionType | 'all';
    setBTypeFilter: (val: QuestionType | 'all') => void;
    bSearch: string;
    setBSearch: (val: string) => void;
    onAddMultiple: (qs: Question[]) => void;
    onOpenMatrixGenerator?: () => void;
}

const PAGE_SIZE = 40;

const stripLabel = (text: string): string => {
    if (!text) return "";
    let cleaned = text.trim();
    const labelRegex = /^(\*?[A-Za-z0-9][\.\)\/\-:\s]\s*)/g;
    while (labelRegex.test(cleaned)) {
        cleaned = cleaned.replace(labelRegex, "").trim();
    }
    return cleaned;
};

const isCorrectMCQ = (q: Question, opt: string, idx: number) => {
    if (!q.correctAnswer) return false;
    const ans = q.correctAnswer.trim();
    const letter = String.fromCharCode(65 + idx); // 'A', 'B', 'C', 'D'
    if (ans.toUpperCase() === letter || ans.toUpperCase() === `${letter}.` || ans.toUpperCase() === `${letter})`) {
        return true;
    }
    if (ans === opt.trim()) return true;
    if (stripLabel(ans) === stripLabel(opt)) return true;
    if (ans.startsWith(`${letter}.`) || ans.startsWith(`${letter})`) || ans.startsWith(`${letter}:`)) {
        return true;
    }
    return false;
};

// Lấy key duy nhất cho mỗi câu hỏi để tránh xung đột khi câu thiếu ID hoặc trùng ID
const getQKey = (q: Question, idx?: number): string => {
    if (q.id && typeof q.id === 'string' && q.id.trim()) return q.id.trim();
    if (q.bankOriginId && typeof q.bankOriginId === 'string' && q.bankOriginId.trim()) return q.bankOriginId.trim();
    return `q_${q.quizTitle || ''}_${q.type || ''}_${(q.text || '').slice(0, 30)}_${idx ?? ''}`;
};

// Trích xuất link ảnh từ nhiều nguồn có thể có (imageUrl, image, img, markdown, html, subQuestions)
const getQuestionImageUrl = (q: any): string | null => {
    if (!q) return null;
    if (typeof q.imageUrl === 'string' && q.imageUrl.trim()) return q.imageUrl.trim();
    if (typeof q.image === 'string' && q.image.trim()) return q.image.trim();
    if (typeof q.img === 'string' && q.img.trim()) return q.img.trim();
    if (Array.isArray(q.images) && q.images.length > 0 && typeof q.images[0] === 'string' && q.images[0].trim()) return q.images[0].trim();
    if (q.text && typeof q.text === 'string') {
        const mdMatch = q.text.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
        if (mdMatch) return mdMatch[1];
        const htmlMatch = q.text.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
        if (htmlMatch) return htmlMatch[1];
    }
    if (Array.isArray(q.subQuestions)) {
        for (const sq of q.subQuestions) {
            if (sq?.imageUrl && typeof sq.imageUrl === 'string' && sq.imageUrl.trim()) return sq.imageUrl.trim();
            if (sq?.image && typeof sq.image === 'string' && sq.image.trim()) return sq.image.trim();
        }
    }
    return null;
};

export default function QuestionBank({ 
    questions, chapters, bGradeFilter, setBGradeFilter, bChapterFilter, setBChapterFilter, bTypeFilter, setBTypeFilter, bSearch, setBSearch, onAddMultiple, onOpenMatrixGenerator 
}: QuestionBankProps) {
    // Sử dụng Map<string, Question> để lưu TOÀN BỘ đối tượng câu hỏi đã chọn từ mọi mức độ (Biết, Hiểu, Vận dụng...)
    const [selectedMap, setSelectedMap] = useState<Map<string, Question>>(new Map());
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [bLevelFilter, setBLevelFilter] = useState<QuestionLevel | 'all'>('all');
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [alwaysShowOptions, setAlwaysShowOptions] = useState(false);
    const [onlyShowSelected, setOnlyShowSelected] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const filteredQuestions = useMemo(() => {
        return questions.filter((q, idx) => {
            const qKey = getQKey(q, idx);
            // Nếu bật chế độ chỉ xem câu đã chọn
            if (onlyShowSelected && !selectedMap.has(qKey)) {
                return false;
            }

            // Lọc khối - Bình thường hóa chuỗi
            const qGradeRaw = (q.quizGrade || 'all').toString().trim();
            const matchGrade = bGradeFilter === 'all' || qGradeRaw === bGradeFilter;

            // Lọc chương: hỗ trợ cả chapterName, quizCategory và chapterId
            const qChapter = (q.chapterName || q.quizCategory || '').toString().trim().toLowerCase();
            const qChapterId = (q.chapterId || '').toString().trim().toLowerCase();
            const filterVal = bChapterFilter.trim().toLowerCase();
            const matchChapter = bChapterFilter === 'all' || qChapter === filterVal || (qChapterId !== '' && qChapterId === filterVal);
            
            // Lọc dạng - Xử lý cả 'group_tf' và 'group-tf'
            let qTypeRaw = (q.type || 'mcq').toString().trim().toLowerCase().replace('_', '-');
            const targetType = bTypeFilter.toString().trim().toLowerCase().replace('_', '-');
            const matchType = bTypeFilter === 'all' || qTypeRaw === targetType;
            
            // Lọc mức độ nhận thức (B, H, VD, VDC)
            let matchLevel = true;
            if (bLevelFilter !== 'all') {
                if (q.level) {
                    matchLevel = q.level === bLevelFilter;
                } else if (q.subQuestions && q.subQuestions.length > 0) {
                    matchLevel = q.subQuestions.some(sq => sq.level === bLevelFilter);
                } else {
                    matchLevel = false;
                }
            }

            // Tìm kiếm
            const matchSearch = !bSearch || 
                              q.text.toLowerCase().includes(bSearch.toLowerCase()) ||
                              (q.quizTitle && q.quizTitle.toLowerCase().includes(bSearch.toLowerCase()));
            
            return matchGrade && matchChapter && matchType && matchLevel && matchSearch;
        });
    }, [questions, bGradeFilter, bChapterFilter, bTypeFilter, bLevelFilter, bSearch, onlyShowSelected, selectedMap]);

    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [bGradeFilter, bChapterFilter, bTypeFilter, bLevelFilter, bSearch, onlyShowSelected]);

    // Thống kê chi tiết các câu đã chọn theo từng mức độ nhận thức (tính từ selectedMap lưu trữ độc lập)
    const selectedStats = useMemo(() => {
        const selectedList = Array.from(selectedMap.values());
        const countB = selectedList.filter(q => q.level === 'B').length;
        const countH = selectedList.filter(q => q.level === 'H').length;
        const countVD = selectedList.filter(q => q.level === 'VD').length;
        const countVDC = selectedList.filter(q => q.level === 'VDC').length;
        return {
            total: selectedList.length,
            B: countB,
            H: countH,
            VD: countVD,
            VDC: countVDC,
            other: selectedList.length - (countB + countH + countVD + countVDC)
        };
    }, [selectedMap]);

    const toggleSelect = (q: Question, idx?: number) => {
        const key = getQKey(q, idx);
        const next = new Map(selectedMap);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.set(key, q);
        }
        setSelectedMap(next);
    };

    // Kiểm tra xem tất cả các câu trong danh sách lọc hiện tại đã chọn chưa
    const allFilteredSelected = filteredQuestions.length > 0 && filteredQuestions.every((q, idx) => selectedMap.has(getQKey(q, idx)));

    const handleToggleSelectFiltered = () => {
        const next = new Map(selectedMap);
        if (allFilteredSelected) {
            // Bỏ chọn các câu trong bộ lọc hiện tại, GIỮ NGUYÊN các câu đã chọn từ bộ lọc khác
            filteredQuestions.forEach((q, idx) => next.delete(getQKey(q, idx)));
        } else {
            // Thêm tất cả các câu trong bộ lọc hiện tại vào danh sách chọn
            filteredQuestions.forEach((q, idx) => next.set(getQKey(q, idx), q));
        }
        setSelectedMap(next);
    };

    const handleClearAllSelected = () => {
        setSelectedMap(new Map());
    };

    // Thêm các câu đã chọn: Lấy từ selectedMap để không bao giờ bị mất câu khi đổi bộ lọc level hay dạng
    const handleAddSelected = () => {
        const selectedQuestions = Array.from(selectedMap.values()).map(q => ({ 
            ...q, 
            id: uuidv4(),
            bankOriginId: q.bankOriginId || q.id || uuidv4() // Lưu vết ID gốc trong Ngân hàng
        }));
            
        if (selectedQuestions.length === 0) {
            return alert("Vui lòng chọn ít nhất một câu hỏi!");
        }

        onAddMultiple(selectedQuestions);
        setSelectedMap(new Map());
    };

    const visibleQuestions = useMemo(() => filteredQuestions.slice(0, visibleCount), [filteredQuestions, visibleCount]);

    return (
        <div className="space-y-4 animate-fade-in w-full max-w-full pb-10">
            {/* Thanh công cụ và bộ lọc */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-30 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none focus:border-blue-500" value={bGradeFilter} onChange={e => { setBGradeFilter(e.target.value as any); setBChapterFilter('all'); }}>
                            <option value="all">Khối: Tất cả</option>
                            <option value="12">Khối 12</option>
                            <option value="11">Khối 11</option>
                            <option value="10">Khối 10</option>
                        </select>
                        <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none max-w-[150px] focus:border-blue-500" value={bChapterFilter} onChange={e => setBChapterFilter(e.target.value)}>
                            <option value="all">Chương: Tất cả</option>
                            {chapters.filter(c => bGradeFilter === 'all' || String(c.grade) === String(bGradeFilter)).map(c => (
                                <option key={c.id} value={c.name}>{c.name || (c as any).title || "Chương chưa đặt tên"}</option>
                            ))}
                        </select>
                        <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none focus:border-blue-500" value={bTypeFilter} onChange={e => setBTypeFilter(e.target.value as any)}>
                            <option value="all">Dạng: Tất cả</option>
                            <option value="mcq">P.I (MCQ - 4 Lựa chọn)</option>
                            <option value="group-tf">P.II (Đúng/Sai)</option>
                            <option value="short">P.III (Trả lời ngắn)</option>
                        </select>
                        <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none focus:border-blue-500" value={bLevelFilter} onChange={e => setBLevelFilter(e.target.value as any)}>
                            <option value="all">Mức độ: Tất cả</option>
                            <option value="B">🟢 [B] Biết</option>
                            <option value="H">🔵 [H] Hiểu</option>
                            <option value="VD">🟠 [VD] Vận dụng</option>
                            <option value="VDC">🔴 [VDC] Vận dụng cao</option>
                        </select>
                        <button 
                            onClick={() => { setBGradeFilter('all'); setBChapterFilter('all'); setBTypeFilter('all'); setBLevelFilter('all'); setBSearch(''); setOnlyShowSelected(false); }}
                            className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase transition-colors"
                        >
                            Xóa lọc
                        </button>
                    </div>

                    {/* Nút bật/tắt chế độ xem đáp án */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setAlwaysShowOptions(false)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                                !alwaysShowOptions ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Rê chuột vào câu hỏi để xem 4 lựa chọn"
                        >
                            <MousePointer size={12}/>
                            <span>Rê chuột xem đáp án</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAlwaysShowOptions(true)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                                alwaysShowOptions ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Luôn mở hiển thị 4 lựa chọn"
                        >
                            <Eye size={12}/>
                            <span>Luôn hiện 4 đáp án</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
                    <div className="flex-1 flex items-center bg-slate-50 border rounded-xl px-3 focus-within:border-blue-500 focus-within:bg-white transition-all">
                        <Search size={14} className="text-slate-400 mr-2 shrink-0"/>
                        <input className="bg-transparent py-2 text-xs font-medium outline-none w-full text-slate-800 placeholder:text-slate-400" placeholder="Tìm kiếm nội dung câu hỏi hoặc tên đề thi..." value={bSearch} onChange={e => setBSearch(e.target.value)} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {onOpenMatrixGenerator && (
                            <button
                                type="button"
                                onClick={onOpenMatrixGenerator}
                                className="flex items-center gap-1.5 text-[9px] font-black uppercase text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all"
                                title="Tạo đề thi tự động từ Ngân hàng theo Ma trận chương và mức độ"
                            >
                                <Zap size={13} className="text-amber-300 fill-amber-300" />
                                <span>⚡ Tạo đề theo Ma trận</span>
                            </button>
                        )}

                        {/* Nút lọc riêng các câu đã chọn */}
                        {selectedMap.size > 0 && (
                            <button
                                type="button"
                                onClick={() => setOnlyShowSelected(!onlyShowSelected)}
                                className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 transition-all border ${
                                    onlyShowSelected 
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm' 
                                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                            >
                                <Layers size={13}/>
                                <span>{onlyShowSelected ? 'Hiện tất cả câu' : `Đã chọn (${selectedMap.size})`}</span>
                            </button>
                        )}

                        <button 
                            onClick={handleToggleSelectFiltered} 
                            className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-600 hover:text-blue-600 bg-slate-50 border px-3 py-1.5 rounded-xl transition-colors"
                        >
                            {allFilteredSelected ? <CheckSquare size={14} className="text-blue-600"/> : <Square size={14}/>}
                            <span>{allFilteredSelected ? `Bỏ chọn (${filteredQuestions.length})` : `Chọn tất cả (${filteredQuestions.length})`}</span>
                        </button>

                        <button 
                            onClick={handleAddSelected} 
                            disabled={selectedMap.size === 0} 
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                                selectedMap.size > 0 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95' 
                                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            }`}
                        >
                            <span>+ THÊM {selectedMap.size} CÂU VÀO ĐỀ</span>
                        </button>
                    </div>
                </div>

                {/* Thanh thống kê các câu đã chọn từ nhiều mức độ */}
                {selectedMap.size > 0 && (
                    <div className="bg-blue-50/80 border border-blue-200/80 px-3 py-2 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2 font-bold text-slate-700">
                            <span className="text-blue-900 font-black flex items-center gap-1">
                                <CheckCircle2 size={15} className="text-blue-600"/> Đã chọn tổng cộng: {selectedStats.total} câu
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md font-black text-[10px]">
                                [B] Biết: {selectedStats.B}
                            </span>
                            <span className="text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md font-black text-[10px]">
                                [H] Hiểu: {selectedStats.H}
                            </span>
                            <span className="text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md font-black text-[10px]">
                                [VD] Vận dụng: {selectedStats.VD}
                            </span>
                            {selectedStats.VDC > 0 && (
                                <span className="text-red-700 bg-red-100/70 px-2 py-0.5 rounded-md font-black text-[10px]">
                                    [VDC] Vận dụng cao: {selectedStats.VDC}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleClearAllSelected}
                            className="text-[9px] font-black uppercase text-red-600 hover:text-red-800 hover:underline px-2 py-0.5"
                        >
                            Bỏ chọn tất cả ({selectedMap.size})
                        </button>
                    </div>
                )}
            </div>

            {/* Danh sách câu hỏi */}
            <div className="grid grid-cols-1 gap-2.5">
                {visibleQuestions.map((bq, idx) => {
                    const qKey = getQKey(bq, idx);
                    const isSelected = selectedMap.has(qKey);
                    const isHovered = hoveredKey === qKey;
                    const showOptions = alwaysShowOptions || isHovered;
                    const hasOptions = bq.type === 'mcq' && bq.options && bq.options.length > 0;
                    const imgUrl = getQuestionImageUrl(bq);

                    return (
                        <div 
                            key={qKey} 
                            onClick={() => toggleSelect(bq, idx)} 
                            onMouseEnter={() => setHoveredKey(qKey)}
                            onMouseMove={() => { if (hoveredKey !== qKey) setHoveredKey(qKey); }}
                            onMouseLeave={() => { if (hoveredKey === qKey) setHoveredKey(null); }}
                            className={`group relative bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
                                isSelected 
                                    ? 'border-blue-500 bg-blue-50/25 shadow-sm' 
                                    : 'border-slate-200/90 hover:border-blue-300 hover:shadow-xs'
                            }`}
                        >
                            <div className="flex items-start gap-3.5">
                                <div className={`mt-0.5 shrink-0 transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-300 group-hover:text-blue-400'}`}>
                                    <CheckCircle2 size={24}/>
                                </div>

                                <div className="flex-1 min-w-0">
                                    {/* Nhãn tag phân loại */}
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded text-white ${
                                            bq.type === 'mcq' ? 'bg-blue-600' : bq.type.includes('tf') ? 'bg-purple-600' : 'bg-orange-600'
                                        }`}>
                                            {bq.type === 'mcq' ? 'P.I (MCQ)' : bq.type.includes('tf') ? 'P.II (Đ/S)' : 'P.III (TLN)'}
                                        </span>
                                        {bq.level && (
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded text-white ${
                                                bq.level === 'B' ? 'bg-emerald-600' : bq.level === 'H' ? 'bg-blue-600' : bq.level === 'VD' ? 'bg-amber-600' : 'bg-red-600'
                                            }`}>
                                                [{bq.level}] {bq.level === 'B' ? 'Biết' : bq.level === 'H' ? 'Hiểu' : bq.level === 'VD' ? 'V.Dụng' : 'VDC'}
                                            </span>
                                        )}
                                        <span className="text-[8px] text-slate-500 font-bold uppercase bg-slate-100 px-2 py-0.5 rounded">
                                            Khối {bq.quizGrade || 'all'}
                                        </span>
                                        {(bq.chapterName || bq.quizCategory) && (
                                            <span className="flex items-center gap-1 text-[8px] text-purple-600 font-bold uppercase bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                                <FolderTree size={9} />
                                                {bq.chapterName || bq.quizCategory}
                                            </span>
                                        )}
                                        {bq.quizTitle && (
                                            <span className="flex items-center gap-1 text-[8px] text-blue-500 font-black uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                <BookOpen size={10}/> {bq.quizTitle}
                                            </span>
                                        )}
                                        {bq.context && (
                                            <span className="flex items-center gap-1 text-[8px] text-amber-700 font-black uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                <Bookmark size={10}/> Có lời dẫn
                                            </span>
                                        )}
                                        {imgUrl && (
                                            <span className="flex items-center gap-1 text-[8px] text-emerald-700 font-black uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                <ImageIcon size={10}/> Có hình ảnh
                                            </span>
                                        )}
                                    </div>

                                    {/* Lời dẫn nếu có */}
                                    {bq.context && (
                                        <div className="text-xs text-amber-900 italic bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 mb-2 font-medium leading-relaxed">
                                            <LatexText text={bq.context}/>
                                        </div>
                                    )}

                                    {/* Đề bài câu hỏi */}
                                    <div className="text-slate-800 text-sm font-bold leading-relaxed overflow-x-auto">
                                        <LatexText text={bq.text}/>
                                    </div>

                                    {/* 1/ HIỂN THỊ HÌNH ẢNH ĐÍNH KÈM (Hỗ trợ nhiều nguồn: imageUrl, image, img, markdown, html...) */}
                                    {imgUrl && (
                                        <div className="mt-3 mb-2 flex items-start gap-2">
                                            <div 
                                                className="relative group/img inline-block bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs max-w-sm hover:border-blue-400 transition-all cursor-zoom-in"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewImage(imgUrl);
                                                }}
                                                title="Nhấn để xem hình ảnh kích thước lớn"
                                            >
                                                <img 
                                                    src={imgUrl} 
                                                    alt="Hình đính kèm câu hỏi" 
                                                    className="max-h-56 max-w-full rounded-lg object-contain block bg-slate-50"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        // Fallback nếu link ảnh lỗi
                                                        (e.target as HTMLElement).style.display = 'none';
                                                    }}
                                                />
                                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 rounded-xl transition-opacity flex items-center justify-center gap-1.5 text-white text-[10px] font-bold pointer-events-none">
                                                    <Maximize2 size={14}/>
                                                    <span>Phóng to ảnh</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 2/ CHỨC NĂNG MOUSE MOVE: KHI DI CHUYỂN VÀO HIỂN THỊ 4 LỰA CHỌN (MCQ) - CÒN TLN THÌ KHÔNG CẦN */}
                                    {hasOptions && (
                                        <>
                                            {/* Gợi ý khi chưa di chuyển chuột vào */}
                                            {!showOptions && (
                                                <div className="mt-2 text-[10px] font-semibold text-slate-400 flex items-center gap-1 select-none">
                                                    <MousePointer size={11} className="text-blue-500"/>
                                                    <span>Rê chuột vào câu hỏi để hiển thị 4 lựa chọn A, B, C, D</span>
                                                </div>
                                            )}

                                            {/* Khối 4 lựa chọn hiển thị khi hover hoặc khi bật luôn hiện */}
                                            {showOptions && (
                                                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2 animate-fade-in">
                                                    {bq.options!.map((opt, optIdx) => {
                                                        const isCorrect = isCorrectMCQ(bq, opt, optIdx);
                                                        const letter = String.fromCharCode(65 + optIdx);
                                                        return (
                                                            <div 
                                                                key={optIdx} 
                                                                className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border transition-all ${
                                                                    isCorrect 
                                                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-medium shadow-xs ring-1 ring-emerald-300' 
                                                                        : 'bg-slate-50/80 border-slate-200 text-slate-700'
                                                                }`}
                                                            >
                                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                                                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                                                }`}>
                                                                    {letter}
                                                                </span>
                                                                <div className="flex-1 min-w-0 leading-relaxed overflow-x-auto">
                                                                    <LatexText text={opt} />
                                                                </div>
                                                                {isCorrect && (
                                                                    <span className="text-[9px] font-black text-emerald-700 shrink-0 uppercase tracking-wider bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-300">
                                                                        Đáp án đúng
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Hiển thị chi tiết phần Đúng/Sai khi hover */}
                                    {bq.type === 'group-tf' && bq.subQuestions && bq.subQuestions.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-100">
                                            {/* Nếu hover thì hiển thị chi tiết các ý a, b, c, d */}
                                            {showOptions ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1 animate-fade-in">
                                                    {bq.subQuestions.map((sq, sqi) => {
                                                        const label = String.fromCharCode(97 + sqi);
                                                        const isTrue = sq.correctAnswer === 'True';
                                                        return (
                                                            <div key={sqi} className="p-2 rounded-xl text-xs bg-slate-50 border border-slate-200 flex items-start gap-2">
                                                                <span className="font-black text-slate-600 text-xs shrink-0">{label})</span>
                                                                <div className="flex-1 min-w-0 leading-relaxed overflow-x-auto">
                                                                    <LatexText text={sq.text}/>
                                                                </div>
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                                                    isTrue ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                                                                }`}>
                                                                    {isTrue ? 'ĐÚNG' : 'SAI'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                /* Rút gọn khi chưa hover */
                                                <div className="flex flex-wrap gap-2">
                                                    {bq.subQuestions.map((sq, sqi) => (
                                                        <span key={sqi} className="text-[9px] font-bold text-slate-600 flex items-center gap-1">
                                                            <span>{String.fromCharCode(97 + sqi)})</span>
                                                            {sq.level && (
                                                                <span className={`text-[8px] font-black px-1.5 py-0.2 rounded text-white ${
                                                                    sq.level === 'B' ? 'bg-emerald-600' : sq.level === 'H' ? 'bg-blue-600' : sq.level === 'VD' ? 'bg-amber-600' : 'bg-red-600'
                                                                }`}>
                                                                    {sq.level}
                                                                </span>
                                                            )}
                                                        </span>
                                                    ))}
                                                    <span className="text-[9px] text-slate-400 italic ml-1">
                                                        (Rê chuột để xem 4 ý Đúng/Sai)
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {visibleQuestions.length === 0 && (
                    <div className="py-20 text-center space-y-4 bg-white rounded-2xl border border-slate-100">
                        <X className="mx-auto text-slate-300" size={48}/>
                        <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Không tìm thấy câu hỏi nào phù hợp</p>
                        {onlyShowSelected && (
                            <button
                                onClick={() => setOnlyShowSelected(false)}
                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
                            >
                                Hiển thị lại tất cả câu hỏi
                            </button>
                        )}
                    </div>
                )}

                {visibleCount < filteredQuestions.length && (
                    <div className="py-6 text-center">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setVisibleCount(prev => prev + PAGE_SIZE); }} 
                            className="px-10 py-3 bg-white border-2 border-slate-200 rounded-full text-[10px] font-black uppercase text-slate-600 shadow-sm hover:bg-slate-900 hover:text-white transition-all"
                        >
                            Tải thêm câu hỏi ({filteredQuestions.length - visibleCount} câu còn lại)
                        </button>
                    </div>
                )}
            </div>

            {/* Modal phóng to hình ảnh đính kèm */}
            {previewImage && (
                <div 
                    className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setPreviewImage(null)}
                >
                    <div 
                        className="bg-white rounded-3xl p-4 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-scale-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                                <ImageIcon size={16} className="text-blue-600"/>
                                <span>Hình ảnh minh họa câu hỏi</span>
                            </h4>
                            <button 
                                onClick={() => setPreviewImage(null)} 
                                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X size={18}/>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50 rounded-2xl mt-3">
                            <img 
                                src={previewImage} 
                                alt="Hình ảnh chi tiết" 
                                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-xs"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

