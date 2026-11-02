import React, { useState, useMemo, useEffect } from 'react';
import { Grade, Chapter, Question, QuestionType } from '@/types';
import { 
    Grid3X3, Sparkles, Database, LayoutTemplate, Loader2, AlertTriangle, 
    CheckCircle2, CheckSquare, FileText, Sliders, RotateCcw,
    Layers, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateMissingQuestionsForChapter } from '@/services/gemini';

interface MatrixQuizGeneratorProps {
    grade: Grade;
    setGrade: (g: Grade) => void;
    chapters: Chapter[];
    onGenerateSuccess: (
        createdQuestions: Question[], 
        quizTitle: string, 
        target: 'editor' | 'bank', 
        durationMinutes: number,
        editorAction?: 'replace' | 'append'
    ) => void;
    hasQuestionsInEditor?: boolean;
    onCancel?: () => void;
}

export interface QuestionTypeConfig {
    id: QuestionType;
    partLabel: string;
    name: string;
    shortName: string;
    color: string;
    badgeBg: string;
    accentBorder: string;
    icon: any;
    desc: string;
    defaultPoints: number;
}

export const QUESTION_TYPES: QuestionTypeConfig[] = [
    {
        id: 'mcq',
        partLabel: 'Phần I',
        name: 'Trắc nghiệm 4 lựa chọn',
        shortName: 'Trắc nghiệm',
        color: 'text-indigo-700',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        accentBorder: 'border-l-indigo-500',
        icon: CheckCircle2,
        desc: 'Chọn 1 trong 4 phương án A, B, C, D (0.25đ / câu)',
        defaultPoints: 0.25
    },
    {
        id: 'group-tf',
        partLabel: 'Phần II',
        name: 'Trắc nghiệm Đúng / Sai',
        shortName: 'Đúng / Sai',
        color: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        accentBorder: 'border-l-emerald-500',
        icon: CheckSquare,
        desc: 'Gồm 4 ý a, b, c, d xét Đúng hoặc Sai (1.0đ / câu)',
        defaultPoints: 1.0
    },
    {
        id: 'short',
        partLabel: 'Phần III',
        name: 'Trắc nghiệm Trả lời ngắn',
        shortName: 'Trả lời ngắn',
        color: 'text-amber-700',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        accentBorder: 'border-l-amber-500',
        icon: FileText,
        desc: 'Học sinh tự điền kết quả số / chữ (0.25đ / câu)',
        defaultPoints: 0.25
    }
];

// Chuẩn hóa mức độ nhận thức
export const normalizeLevel = (lvl: any): 'B' | 'H' | 'VD' | 'VDC' | '' => {
    if (!lvl) return '';
    const s = String(lvl).trim().toUpperCase();
    if (s === 'B' || s === 'EASY' || s === 'NHẬN BIẾT' || s === 'BIẾT') return 'B';
    if (s === 'H' || s === 'MEDIUM' || s === 'THÔNG HIỂU' || s === 'HIỂU') return 'H';
    if (s === 'VD' || s === 'HARD' || s === 'VẬN DỤNG') return 'VD';
    if (s === 'VDC' || s === 'VHARD' || s === 'VẬN DỤNG CAO') return 'VDC';
    return '';
};

// Nhận diện mức độ thực tế của câu hỏi
export const getEffectiveQuestionLevel = (q: Question): 'B' | 'H' | 'VD' | 'VDC' => {
    const raw = normalizeLevel(q.level);
    if (raw) return raw;
    const text = ((q.text || '') + ' ' + (q.solution || '')).toLowerCase();
    const type = normalizeQuestionType(q.type);
    const hasNumbers = /\d+([,.]\d+)?\s*(m|cm|mm|kg|g|s|hz|v|a|w|j|n|t|wb|k|°c|pa|atm|mol|mev|ev|u)\b/i.test(text);
    const hasEquations = /(\$|\=|\+|\-|\*|\/|\^|\_)/.test(text);
    const isCalculation = hasNumbers && hasEquations;

    if (type === 'short' || type === 'group-tf') {
        return isCalculation ? 'VD' : 'H';
    }
    if (isCalculation) return 'VD';
    if (/khái niệm|định nghĩa|công thức nào sau đây|ký hiệu/i.test(text)) return 'B';
    return 'H';
};

// Chuẩn hóa dạng câu hỏi
export const normalizeQuestionType = (t: any): QuestionType => {
    if (!t) return 'mcq';
    const s = String(t).trim().toLowerCase();
    if (s === 'group-tf' || s === 'tf' || s === 'true_false' || s === 'đúng/sai' || s === 'dung_sai') return 'group-tf';
    if (s === 'short' || s === 'short_answer' || s === 'ngắn' || s === 'trả lời ngắn') return 'short';
    return 'mcq';
};

// Hàm xác định số thứ tự chương từ tên chương
export const getChapterNumberFromName = (name: string, grade: Grade): number => {
    if (!name) return 0;
    const clean = name.toLowerCase().trim();
    const normalized = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    const m = clean.match(/ch[uư][oơ]ng\s*(\d+)/i);
    if (m && m[1]) return parseInt(m[1], 10);

    if (String(grade) === '12') {
        if (/nhiet/i.test(normalized)) return 1;
        if (/khi/i.test(normalized)) return 2;
        if (/\btu\b|tu\s*truong/i.test(normalized)) return 3;
        if (/hat\s*nhan|phong\s*xa/i.test(normalized)) return 4;
    } else if (String(grade) === '11') {
        if (/dao\s*dong/i.test(normalized)) return 1;
        if (/song/i.test(normalized)) return 2;
        if (/dien\s*truong/i.test(normalized)) return 3;
        if (/dong\s*dien/i.test(normalized)) return 4;
    } else if (String(grade) === '10') {
        if (/chuyen\s*dong/i.test(normalized)) return 1;
        if (/\bluc\b|newton/i.test(normalized)) return 2;
        if (/nang\s*luong/i.test(normalized)) return 3;
        if (/dong\s*luong/i.test(normalized)) return 4;
        if (/tron|bien\s*dang/i.test(normalized)) return 5;
    }
    return 0;
};

// Kiểm tra tên chương có phải là nhãn thi cử không phải chương
export const isExamOrNonChapterName = (rawName: string): boolean => {
    if (!rawName) return true;
    const name = rawName.toLowerCase().trim();
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    const examRegex = /(kttx|ktgk|ktck|ktdk|kttk|kt15p|kt45p|ltdh|on\s*thi|luyen\s*thi|thi\s*thu|de\s*thi|kiem\s*tra|giua\s*ky|cuoi\s*ky|thpt)/i;
    if (examRegex.test(normalized)) {
        if (/chuong\s*\d+/i.test(normalized)) return false;
        return true;
    }
    return false;
};

// Kiểm tra câu hỏi khớp với chương
export const matchQuestionChapter = (
    q: Question, 
    chId: string, 
    chName: string, 
    grade: Grade, 
    allChapters: { id: string; name: string }[]
): boolean => {
    if (q.chapterId && q.chapterId === chId) return true;
    const targetNum = getChapterNumberFromName(chName, grade);
    const qCh = (q.chapterName || '').trim();
    if (qCh && !isExamOrNonChapterName(qCh)) {
        const qNum = getChapterNumberFromName(qCh, grade);
        if (qNum > 0 && targetNum > 0 && qNum === targetNum) return true;
        if (qCh.toLowerCase() === chName.toLowerCase().trim()) return true;
    }
    return false;
};

export const STANDARD_CHAPTERS: Record<Grade, { id: string; name: string; grade: Grade; order: number }[]> = {
    '12': [
        { id: 'ch_12_1', name: 'Chương 1: Vật lí nhiệt', grade: '12', order: 1 },
        { id: 'ch_12_2', name: 'Chương 2: Khí lí tưởng', grade: '12', order: 2 },
        { id: 'ch_12_3', name: 'Chương 3: Từ trường', grade: '12', order: 3 },
        { id: 'ch_12_4', name: 'Chương 4: Hạt nhân nguyên tử', grade: '12', order: 4 },
    ],
    '11': [
        { id: 'ch_11_1', name: 'Chương 1: Dao động', grade: '11', order: 1 },
        { id: 'ch_11_2', name: 'Chương 2: Sóng', grade: '11', order: 2 },
        { id: 'ch_11_3', name: 'Chương 3: Điện trường', grade: '11', order: 3 },
        { id: 'ch_11_4', name: 'Chương 4: Dòng điện không đổi', grade: '11', order: 4 },
    ],
    '10': [
        { id: 'ch_10_1', name: 'Chương 1: Mở đầu & Mô tả chuyển động', grade: '10', order: 1 },
        { id: 'ch_10_2', name: 'Chương 2: Lực và chuyển động (Động lực học)', grade: '10', order: 2 },
        { id: 'ch_10_3', name: 'Chương 3: Năng lượng, công, công suất', grade: '10', order: 3 },
        { id: 'ch_10_4', name: 'Chương 4: Động lượng', grade: '10', order: 4 },
        { id: 'ch_10_5', name: 'Chương 5: Chuyển động tròn & Biến dạng', grade: '10', order: 5 },
    ],
    'all': []
};

export default function MatrixQuizGenerator({
    grade,
    setGrade,
    chapters,
    onGenerateSuccess,
    hasQuestionsInEditor,
    onCancel
}: MatrixQuizGeneratorProps) {
    const [quizTitle, setQuizTitle] = useState(`ĐỀ MA TRẬN AI VẬT LÝ ${grade}`);
    const [durationMinutes, setDurationMinutes] = useState(50);
    const [target, setTarget] = useState<'editor' | 'bank'>('editor');
    const [editorAction, setEditorAction] = useState<'replace' | 'append'>('replace');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success' | 'info' | 'warning'; text: string } | null>(null);

    const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | QuestionType>('all');
    const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setQuizTitle(`ĐỀ MA TRẬN AI VẬT LÝ ${grade}`);
    }, [grade]);

    const displayChapters = useMemo(() => {
        return STANDARD_CHAPTERS[grade] || [];
    }, [grade]);

    const [matrixRows, setMatrixRows] = useState<Record<string, { b: number; h: number; vd: number; vdc: number }>>({});

    const handleCellChange = (chId: string, qType: QuestionType, field: 'b' | 'h' | 'vd' | 'vdc', val: number) => {
        const safeVal = Math.max(0, isNaN(val) ? 0 : val);
        const key = `${chId}__${qType}`;
        setMatrixRows(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { b: 0, h: 0, vd: 0, vdc: 0 }),
                [field]: safeVal
            }
        }));
    };

    const applyPreset = (presetType: 'gdpt2018' | 'quiz40' | 'quiz20' | 'clear') => {
        if (displayChapters.length === 0) return;
        const newRows: Record<string, { b: number; h: number; vd: number; vdc: number }> = {};

        if (presetType === 'clear') {
            displayChapters.forEach(ch => {
                QUESTION_TYPES.forEach(t => {
                    newRows[`${ch.id}__${t.id}`] = { b: 0, h: 0, vd: 0, vdc: 0 };
                });
            });
            setMatrixRows(newRows);
            return;
        }

        const numChapters = displayChapters.length;

        if (presetType === 'gdpt2018') {
            displayChapters.forEach((ch, idx) => {
                const mcqB = Math.floor(12 / numChapters) + (idx < (12 % numChapters) ? 1 : 0);
                const mcqH = Math.floor(6 / numChapters) + (idx < (6 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__mcq`] = { b: mcqB, h: mcqH, vd: 0, vdc: 0 };

                const tfH = Math.floor(2 / numChapters) + (idx < (2 % numChapters) ? 1 : 0);
                const tfVD = Math.floor(2 / numChapters) + (idx < (2 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__group-tf`] = { b: 0, h: tfH, vd: tfVD, vdc: 0 };

                const shortVD = Math.floor(4 / numChapters) + (idx < (4 % numChapters) ? 1 : 0);
                const shortVDC = Math.floor(2 / numChapters) + (idx < (2 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__short`] = { b: 0, h: 0, vd: shortVD, vdc: shortVDC };
            });
            setDurationMinutes(50);
            setStatusMessage({ type: 'info', text: 'Đã nạp mẫu ma trận chuẩn Bộ GD&ĐT 28 câu (AI sẽ tự động soạn mới hoàn toàn).' });
        } else if (presetType === 'quiz40') {
            displayChapters.forEach((ch, idx) => {
                const b = Math.floor(16 / numChapters) + (idx < (16 % numChapters) ? 1 : 0);
                const h = Math.floor(12 / numChapters) + (idx < (12 % numChapters) ? 1 : 0);
                const vd = Math.floor(8 / numChapters) + (idx < (8 % numChapters) ? 1 : 0);
                const vdc = Math.floor(4 / numChapters) + (idx < (4 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__mcq`] = { b, h, vd, vdc };
                newRows[`${ch.id}__group-tf`] = { b: 0, h: 0, vd: 0, vdc: 0 };
                newRows[`${ch.id}__short`] = { b: 0, h: 0, vd: 0, vdc: 0 };
            });
            setDurationMinutes(50);
            setStatusMessage({ type: 'info', text: 'Đã nạp mẫu ma trận 40 câu trắc nghiệm AI.' });
        } else if (presetType === 'quiz20') {
            displayChapters.forEach((ch, idx) => {
                const mcqB = Math.floor(8 / numChapters) + (idx < (8 % numChapters) ? 1 : 0);
                const mcqH = Math.floor(4 / numChapters) + (idx < (4 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__mcq`] = { b: mcqB, h: mcqH, vd: 0, vdc: 0 };

                const tfH = Math.floor(1 / numChapters) + (idx < (1 % numChapters) ? 1 : 0);
                const tfVD = Math.floor(1 / numChapters) + (idx < (1 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__group-tf`] = { b: 0, h: tfH, vd: tfVD, vdc: 0 };

                const shortVD = Math.floor(4 / numChapters) + (idx < (4 % numChapters) ? 1 : 0);
                const shortVDC = Math.floor(2 / numChapters) + (idx < (2 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__short`] = { b: 0, h: 0, vd: shortVD, vdc: shortVDC };
            });
            setDurationMinutes(45);
            setStatusMessage({ type: 'info', text: 'Đã nạp mẫu ma trận 20 câu AI.' });
        }
        setMatrixRows(newRows);
    };

    const totals = useMemo(() => {
        let b = 0, h = 0, vd = 0, vdc = 0;
        const byType: Record<QuestionType, { b: number; h: number; vd: number; vdc: number; total: number }> = {
            'mcq': { b: 0, h: 0, vd: 0, vdc: 0, total: 0 },
            'group-tf': { b: 0, h: 0, vd: 0, vdc: 0, total: 0 },
            'short': { b: 0, h: 0, vd: 0, vdc: 0, total: 0 }
        };
        const chapterSums: Record<string, number> = {};

        displayChapters.forEach(ch => {
            chapterSums[ch.id] = 0;
            QUESTION_TYPES.forEach(t => {
                const row = matrixRows[`${ch.id}__${t.id}`] || { b: 0, h: 0, vd: 0, vdc: 0 };
                const rowTotal = row.b + row.h + row.vd + row.vdc;

                b += row.b;
                h += row.h;
                vd += row.vd;
                vdc += row.vdc;

                chapterSums[ch.id] += rowTotal;

                byType[t.id].b += row.b;
                byType[t.id].h += row.h;
                byType[t.id].vd += row.vd;
                byType[t.id].vdc += row.vdc;
                byType[t.id].total += rowTotal;
            });
        });

        const total = b + h + vd + vdc;
        return { b, h, vd, vdc, total, byType, chapterSums };
    }, [displayChapters, matrixRows]);

    const handleGenerateFromMatrix = async () => {
        setStatusMessage(null);
        if (totals.total === 0) {
            setStatusMessage({ type: 'error', text: 'Vui lòng nhập số lượng câu hỏi trong ma trận (tổng số câu phải lớn hơn 0)!' });
            return;
        }

        setIsGenerating(true);
        setGenerationProgress('AI đang khởi tạo quá trình soạn đề theo ma trận...');

        try {
            const finalQuestions: Question[] = [];
            const existingTexts: string[] = [];

            for (const ch of displayChapters) {
                for (const t of QUESTION_TYPES) {
                    const rowKey = `${ch.id}__${t.id}`;
                    const row = matrixRows[rowKey] || { b: 0, h: 0, vd: 0, vdc: 0 };

                    const levels: { key: 'B' | 'H' | 'VD' | 'VDC'; count: number }[] = [
                        { key: 'B', count: row.b },
                        { key: 'H', count: row.h },
                        { key: 'VD', count: row.vd },
                        { key: 'VDC', count: row.vdc }
                    ];

                    for (const lvl of levels) {
                        if (lvl.count > 0) {
                            const levelName = lvl.key === 'B' ? 'Nhận biết' : lvl.key === 'H' ? 'Thông hiểu' : lvl.key === 'VD' ? 'Vận dụng' : 'Vận dụng cao';
                            const typeName = t.id === 'mcq' ? 'Trắc nghiệm 4 lựa chọn' : t.id === 'group-tf' ? 'Đúng/Sai' : 'Trả lời ngắn';
                            setGenerationProgress(`AI đang soạn ${lvl.count} câu [${typeName} - ${levelName}] cho "${ch.name}"...`);

                            const generated = await generateMissingQuestionsForChapter(
                                String(grade),
                                ch.name,
                                lvl.key,
                                lvl.count,
                                existingTexts,
                                t.id
                            );

                            generated.forEach((q: Question) => {
                                if (q.text) existingTexts.push(q.text);
                                finalQuestions.push({
                                    ...q,
                                    id: uuidv4(),
                                    type: t.id,
                                    chapterName: ch.name,
                                    chapterId: ch.id,
                                    level: lvl.key
                                });
                            });
                        }
                    }
                }
            }

            if (finalQuestions.length === 0) {
                setStatusMessage({ type: 'error', text: 'Không thể tạo đề bằng AI. Vui lòng thử lại!' });
                return;
            }

            const balancedQuestions = finalQuestions.map(q => ({
                ...q,
                points: Number((10 / finalQuestions.length).toFixed(2))
            }));

            setIsGenerating(false);
            setGenerationProgress(null);
            onGenerateSuccess(balancedQuestions, quizTitle, target, durationMinutes, editorAction);
        } catch (err: any) {
            console.error('Lỗi tạo đề ma trận AI:', err);
            setIsGenerating(false);
            setGenerationProgress(null);
            setStatusMessage({ type: 'error', text: 'Lỗi khi AI soạn đề: ' + (err.message || 'Lỗi không xác định') });
        }
    };

    const visibleQuestionTypes = useMemo(() => {
        if (selectedTypeFilter === 'all') return QUESTION_TYPES;
        return QUESTION_TYPES.filter(t => t.id === selectedTypeFilter);
    }, [selectedTypeFilter]);

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl shadow-md">
                            <Grid3X3 size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                Tạo đề theo Ma trận bằng AI
                                <span className="text-[10px] bg-purple-100 text-purple-800 font-black px-2.5 py-0.5 rounded-full">
                                    GDPT 2018
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 font-bold">
                                Soạn mới hoàn toàn bằng AI theo cấu trúc chương, số câu và mức độ nhận thức (Không phụ thuộc ngân hàng có sẵn).
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-50 border-2 border-slate-100 p-1 rounded-2xl">
                            {(['12', '11', '10'] as Grade[]).map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => setGrade(g)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                                        grade === g ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    Khối {g}
                                </button>
                            ))}
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            <button 
                                type="button"
                                onClick={() => setTarget('editor')} 
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all ${
                                    target === 'editor' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                                }`}
                            >
                                <LayoutTemplate size={13}/> Vào Editor
                            </button>
                            <button 
                                type="button"
                                onClick={() => setTarget('bank')} 
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all ${
                                    target === 'bank' ? 'bg-white text-purple-600 shadow-xs' : 'text-slate-500'
                                }`}
                            >
                                <Database size={13}/> Vào Bank
                            </button>
                        </div>
                    </div>
                </div>

                {statusMessage && (
                    <div className={`p-4 rounded-2xl border-2 flex items-center justify-between text-xs font-bold animate-fade-in ${
                        statusMessage.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                        statusMessage.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                        'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} />
                            <span>{statusMessage.text}</span>
                        </div>
                        <button type="button" onClick={() => setStatusMessage(null)} className="text-xs opacity-60 hover:opacity-100">Đóng</button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tiêu đề đề thi</label>
                        <input
                            type="text"
                            value={quizTitle}
                            onChange={e => setQuizTitle(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-400 focus:bg-white transition-all"
                            placeholder="Nhập tên đề thi..."
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Thời gian làm bài (Phút)</label>
                        <select
                            value={durationMinutes}
                            onChange={e => setDurationMinutes(Number(e.target.value))}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-400 focus:bg-white transition-all"
                        >
                            <option value={15}>15 phút (Kiểm tra 15p)</option>
                            <option value={45}>45 phút (Kiểm tra 1 tiết)</option>
                            <option value={50}>50 phút (Chuẩn Bộ GD&ĐT)</option>
                            <option value={90}>90 phút (Học kỳ / Khảo sát)</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-purple-600" />
                        <span className="text-xs font-black uppercase text-slate-700">Mẫu ma trận nhanh:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => applyPreset('gdpt2018')}
                            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                        >
                            <Sparkles size={13} className="text-amber-300 fill-amber-300" />
                            <span>Chuẩn Bộ GD (28 câu)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('quiz40')}
                            className="px-3.5 py-2 bg-white border border-slate-300 hover:border-purple-500 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                        >
                            Đề 40 câu trắc nghiệm
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('quiz20')}
                            className="px-3.5 py-2 bg-white border border-slate-300 hover:border-purple-500 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                        >
                            Đề 20 câu kiểm tra
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('clear')}
                            className="px-3 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        >
                            <RotateCcw size={12} />
                            <span>Xóa trắng</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border-2 border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                                <th className="p-3.5 pl-5 w-[30%]">Chương kiến thức</th>
                                <th className="p-3.5 w-[22%]">Hàng Loại câu hỏi</th>
                                <th className="p-3.5 text-center bg-emerald-700 w-[11%]">Biết (B)</th>
                                <th className="p-3.5 text-center bg-blue-700 w-[11%]">Hiểu (H)</th>
                                <th className="p-3.5 text-center bg-amber-700 w-[11%]">V.Dụng (VD)</th>
                                <th className="p-3.5 text-center bg-red-700 w-[11%]">VDC</th>
                                <th className="p-3.5 text-center pr-5 bg-slate-800 w-[8%]">Tổng</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {displayChapters.map((ch) => {
                                const isCollapsed = !!collapsedChapters[ch.id];
                                const chapterTotalQuestions = totals.chapterSums[ch.id] || 0;

                                return (
                                    <React.Fragment key={ch.id}>
                                        <tr className="bg-slate-100/90 border-t-2 border-slate-200">
                                            <td colSpan={2} className="p-3 pl-5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 font-black text-slate-800 text-xs">
                                                        <Layers size={15} className="text-purple-600 shrink-0" />
                                                        <span>{ch.name}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCollapsedChapters(prev => ({ ...prev, [ch.id]: !prev[ch.id] }))}
                                                        className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                                                    >
                                                        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td colSpan={4} className="p-3 text-slate-400 text-[10px] font-bold italic">
                                                {isCollapsed ? 'Đã thu gọn' : ''}
                                            </td>
                                            <td className="p-3 pr-5 text-center font-black text-slate-800">
                                                {chapterTotalQuestions > 0 ? (
                                                    <span className="bg-purple-600 text-white text-[11px] px-2.5 py-0.5 rounded-full font-black">
                                                        {chapterTotalQuestions} câu
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">0</span>
                                                )}
                                            </td>
                                        </tr>

                                        {!isCollapsed && QUESTION_TYPES.map((t) => {
                                            const rowKey = `${ch.id}__${t.id}`;
                                            const row = matrixRows[rowKey] || { b: 0, h: 0, vd: 0, vdc: 0 };
                                            const rowTotal = row.b + row.h + row.vd + row.vdc;
                                            const TypeIcon = t.icon;

                                            return (
                                                <tr key={rowKey} className="bg-white hover:bg-slate-50/70 transition-colors border-b border-slate-100">
                                                    <td className="p-2.5 pl-8 text-slate-400 text-[11px] border-r border-slate-100/80">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span className="truncate max-w-[200px]" title={ch.name}>{ch.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-2.5 font-bold border-r border-slate-100/80">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1.5 rounded-lg ${t.badgeBg}`}>
                                                                <TypeIcon size={14} />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-black uppercase text-slate-500">{t.partLabel}</span>
                                                                    <span className="text-xs font-black text-slate-800">{t.shortName}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            value={row.b || ''}
                                                            placeholder="0"
                                                            onChange={e => handleCellChange(ch.id, t.id, 'b', parseInt(e.target.value))}
                                                            className="w-16 mx-auto text-center font-black p-2 bg-emerald-50/70 border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-emerald-800"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            value={row.h || ''}
                                                            placeholder="0"
                                                            onChange={e => handleCellChange(ch.id, t.id, 'h', parseInt(e.target.value))}
                                                            className="w-16 mx-auto text-center font-black p-2 bg-blue-50/70 border border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-blue-800"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            value={row.vd || ''}
                                                            placeholder="0"
                                                            onChange={e => handleCellChange(ch.id, t.id, 'vd', parseInt(e.target.value))}
                                                            className="w-16 mx-auto text-center font-black p-2 bg-amber-50/70 border border-amber-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white text-amber-800"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            value={row.vdc || ''}
                                                            placeholder="0"
                                                            onChange={e => handleCellChange(ch.id, t.id, 'vdc', parseInt(e.target.value))}
                                                            className="w-16 mx-auto text-center font-black p-2 bg-red-50/70 border border-red-200 rounded-xl outline-none focus:border-red-500 focus:bg-white text-red-800"
                                                        />
                                                    </td>
                                                    <td className="p-2 pr-5 text-center font-black text-slate-800 text-sm">
                                                        {rowTotal > 0 ? (
                                                            <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-lg text-xs font-black">
                                                                {rowTotal}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">0</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-300 font-black text-xs">
                            <tr className="bg-indigo-50/60 text-indigo-900 border-b border-indigo-100">
                                <td colSpan={2} className="p-2.5 pl-5 uppercase">
                                    Tổng cộng toàn bộ đề thi ({totals.total} câu)
                                </td>
                                <td className="p-2 text-center text-emerald-800">{totals.b} câu</td>
                                <td className="p-2 text-center text-blue-800">{totals.h} câu</td>
                                <td className="p-2 text-center text-amber-800">{totals.vd} câu</td>
                                <td className="p-2 text-center text-red-800">{totals.vdc} câu</td>
                                <td className="p-2 pr-5 text-center font-black text-indigo-700 text-sm">{totals.total} câu</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {isGenerating && (
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-3xl p-6 text-left space-y-3 shadow-lg animate-fade-in">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-md animate-pulse">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase text-purple-900 tracking-wider">
                                    AI đang tiến hành soạn đề theo ma trận
                                </h4>
                                <p className="text-[11px] font-bold text-purple-700 mt-0.5">
                                    {generationProgress || "Đang xử lý tạo câu hỏi mới..."}
                                </p>
                            </div>
                        </div>
                        <div className="w-full bg-purple-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-purple-600 h-2.5 rounded-full animate-pulse w-3/4" />
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleGenerateFromMatrix}
                    disabled={isGenerating || totals.total === 0}
                    className="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-[2.5rem] text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                    <span>{isGenerating ? (generationProgress || 'AI đang soạn đề...') : `Bắt đầu tạo đề với AI (${totals.total} câu)`}</span>
                </button>
            </div>
        </div>
    );
}
