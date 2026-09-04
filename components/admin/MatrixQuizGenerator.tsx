import React, { useState, useMemo, useEffect } from 'react';
import { Grade, Chapter, Question, QuestionType } from '../../types';
import { 
    Grid3X3, Sparkles, Database, LayoutTemplate, Loader2, AlertTriangle, 
    CheckCircle2, CheckSquare, RefreshCw, Zap, Sliders, FileText, ArrowRight, RotateCcw,
    Layers, Plus, Minus, Info, ChevronDown, ChevronUp, Filter, HelpCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateMissingQuestionsForChapter } from '../../services/gemini';

interface MatrixQuizGeneratorProps {
    grade: Grade;
    setGrade: (g: Grade) => void;
    chapters: Chapter[];
    bankQuestions: Question[];
    isBankLoading?: boolean;
    onLoadBank?: () => Promise<void>;
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
const normalizeLevel = (lvl: any): 'B' | 'H' | 'VD' | 'VDC' | '' => {
    if (!lvl) return '';
    const s = String(lvl).trim().toUpperCase();
    if (s === 'B' || s === 'EASY' || s === 'NHẬN BIẾT' || s === 'BIẾT') return 'B';
    if (s === 'H' || s === 'MEDIUM' || s === 'THÔNG HIỂU' || s === 'HIỂU') return 'H';
    if (s === 'VD' || s === 'HARD' || s === 'VẬN DỤNG') return 'VD';
    if (s === 'VDC' || s === 'VHARD' || s === 'VẬN DỤNG CAO') return 'VDC';
    return '';
};

// Chuẩn hóa dạng câu hỏi
export const normalizeQuestionType = (t: any): QuestionType => {
    if (!t) return 'mcq';
    const s = String(t).trim().toLowerCase();
    if (s === 'group-tf' || s === 'tf' || s === 'true_false' || s === 'đúng/sai' || s === 'dung_sai') return 'group-tf';
    if (s === 'short' || s === 'short_answer' || s === 'ngắn' || s === 'trả lời ngắn') return 'short';
    return 'mcq';
};

// Kiểm tra câu hỏi có khớp với chương
const matchQuestionChapter = (q: Question, chId: string, chName: string): boolean => {
    if (q.chapterId && q.chapterId === chId) return true;
    const qCh = (q.chapterName || q.quizCategory || '').toLowerCase().trim();
    const target = chName.toLowerCase().trim();
    if (qCh === target) return true;
    
    // So khớp theo đầu số chương (VD: "Chương 1" khớp "Chương 1: VẬT LÝ NHIỆT")
    const matchPrefix = target.match(/chương\s*(\d+)/i);
    if (matchPrefix) {
        const num = matchPrefix[1];
        if (qCh.startsWith(`chương ${num}:`) || qCh.startsWith(`chương ${num} `) || qCh === `chương ${num}`) {
            return true;
        }
    }
    return false;
};

// Hàm xáo trộn mảng ngẫu nhiên
const shuffleArray = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

export default function MatrixQuizGenerator({
    grade,
    setGrade,
    chapters,
    bankQuestions,
    isBankLoading,
    onLoadBank,
    onGenerateSuccess,
    hasQuestionsInEditor,
    onCancel
}: MatrixQuizGeneratorProps) {
    // Tự động tải ngân hàng nếu chưa có dữ liệu
    useEffect(() => {
        if (bankQuestions.length === 0 && onLoadBank) {
            onLoadBank();
        }
    }, [bankQuestions.length, onLoadBank]);

    const [quizTitle, setQuizTitle] = useState(`ĐỀ KIỂM TRA MA TRẬN VẬT LÝ ${grade}`);
    const [durationMinutes, setDurationMinutes] = useState(50);
    const [target, setTarget] = useState<'editor' | 'bank'>('editor');
    const [editorAction, setEditorAction] = useState<'replace' | 'append'>('replace');
    const [allowAiFallback, setAllowAiFallback] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

    // Bộ lọc hiển thị Loại câu (Xem tất cả hoặc lọc riêng từng loại)
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | QuestionType>('all');
    
    // Thu gọn/mở rộng từng chương
    const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

    // Cập nhật tiêu đề mặc định khi đổi khối
    useEffect(() => {
        setQuizTitle(`ĐỀ KIỂM TRA MA TRẬN VẬT LÝ ${grade}`);
    }, [grade]);

    // Danh sách các chương của khối này
    const displayChapters = useMemo(() => {
        let list = chapters.filter(c => String(c.grade) === String(grade));
        // Lọc bỏ các mục nhãn tổng hợp chung nếu có chương chi tiết
        const detailed = list.filter(c => {
            const name = (c.name || '').toLowerCase();
            return !name.includes('ôn thi tx') && !name.includes('ôn gk') && !name.includes('luyện thi đh');
        });
        if (detailed.length > 0) list = detailed;

        // Nếu bảng chapters chưa có chương nào, trích xuất các chương thực tế từ ngân hàng
        if (list.length === 0) {
            const extractedMap = new Map<string, string>();
            bankQuestions.forEach(q => {
                const qGrade = String(q.quizGrade || (q as any).grade || '12');
                if (qGrade === String(grade) && q.chapterName) {
                    extractedMap.set(q.chapterName, q.chapterId || q.chapterName);
                }
            });
            list = Array.from(extractedMap.entries()).map(([name, id], idx) => ({
                id: id || `ch_${idx}`,
                name: name,
                grade: grade,
                order: idx + 1
            }));
        }

        return list;
    }, [chapters, grade, bankQuestions]);

    // Bảng ma trận số lượng câu mong muốn: key `${chapterId}__${questionType}` -> { b, h, vd, vdc }
    const [matrixRows, setMatrixRows] = useState<Record<string, { b: number; h: number; vd: number; vdc: number }>>({});

    // Thống kê số lượng câu sẵn có trong kho theo từng chương, từng loại câu và từng mức độ
    const bankStats = useMemo(() => {
        const statsByKey: Record<string, { b: number; h: number; vd: number; vdc: number; total: number; questions: Question[] }> = {};
        const chapterTotals: Record<string, number> = {};
        const typeTotals: Record<QuestionType, number> = { 'mcq': 0, 'group-tf': 0, 'short': 0 };

        displayChapters.forEach(ch => {
            chapterTotals[ch.id] = 0;
            QUESTION_TYPES.forEach(t => {
                statsByKey[`${ch.id}__${t.id}`] = { b: 0, h: 0, vd: 0, vdc: 0, total: 0, questions: [] };
            });
        });

        bankQuestions.forEach(q => {
            const qGrade = String(q.quizGrade || (q as any).grade || '12');
            if (qGrade !== String(grade) && qGrade !== 'all') return;

            const qType = normalizeQuestionType(q.type);
            typeTotals[qType] = (typeTotals[qType] || 0) + 1;

            displayChapters.forEach(ch => {
                if (matchQuestionChapter(q, ch.id, ch.name)) {
                    chapterTotals[ch.id] = (chapterTotals[ch.id] || 0) + 1;
                    const key = `${ch.id}__${qType}`;
                    if (statsByKey[key]) {
                        const normLvl = normalizeLevel(q.level);
                        if (normLvl === 'B') statsByKey[key].b++;
                        else if (normLvl === 'H') statsByKey[key].h++;
                        else if (normLvl === 'VD') statsByKey[key].vd++;
                        else if (normLvl === 'VDC') statsByKey[key].vdc++;
                        
                        statsByKey[key].total++;
                        statsByKey[key].questions.push(q);
                    }
                }
            });
        });

        return { statsByKey, chapterTotals, typeTotals };
    }, [displayChapters, bankQuestions, grade]);

    // Cập nhật giá trị ô ma trận
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

    // Áp dụng các mẫu đề có sẵn (Presets)
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
            // Mẫu Chuẩn Bộ GD&ĐT 2018 (28 câu):
            // - Phần I (Trắc nghiệm): 18 câu (12 Biết, 6 Hiểu)
            // - Phần II (Đúng/Sai): 4 câu (2 Hiểu, 2 Vận dụng)
            // - Phần III (Trả lời ngắn): 6 câu (4 Vận dụng, 2 VDC)
            // Phân bổ đều cho các chương:
            displayChapters.forEach((ch, idx) => {
                // Phần I: 18 câu (12B, 6H)
                const mcqB = Math.floor(12 / numChapters) + (idx < (12 % numChapters) ? 1 : 0);
                const mcqH = Math.floor(6 / numChapters) + (idx < (6 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__mcq`] = { b: mcqB, h: mcqH, vd: 0, vdc: 0 };

                // Phần II: 4 câu (2H, 2VD)
                const tfH = Math.floor(2 / numChapters) + (idx < (2 % numChapters) ? 1 : 0);
                const tfVD = Math.floor(2 / numChapters) + (idx < (2 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__group-tf`] = { b: 0, h: tfH, vd: tfVD, vdc: 0 };

                // Phần III: 6 câu (4VD, 2VDC)
                const shortVD = Math.floor(4 / numChapters) + (idx < (4 % numChapters) ? 1 : 0);
                const shortVDC = Math.floor(2 / numChapters) + (idx < (2 % numChapters) ? 1 : 0);
                newRows[`${ch.id}__short`] = { b: 0, h: 0, vd: shortVD, vdc: shortVDC };
            });

            setDurationMinutes(50);
            setStatusMessage({
                type: 'info',
                text: 'Đã nạp Ma trận chuẩn Bộ GD&ĐT 28 câu (Phần I: 18 câu TN, Phần II: 4 câu Đúng/Sai, Phần III: 6 câu Trả lời ngắn).'
            });
        } else if (presetType === 'quiz40') {
            // Mẫu 40 câu trắc nghiệm 4 lựa chọn truyền thống: 16 Biết - 12 Hiểu - 8 VD - 4 VDC
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
            setStatusMessage({
                type: 'info',
                text: 'Đã nạp Ma trận 40 câu trắc nghiệm 4 lựa chọn (16 Biết - 12 Hiểu - 8 VD - 4 VDC).'
            });
        } else if (presetType === 'quiz20') {
            // Mẫu 20 câu kiểm tra nhanh 45 phút:
            // - 12 câu Trắc nghiệm (8 Biết, 4 Hiểu)
            // - 2 câu Đúng/Sai (1 Hiểu, 1 VD)
            // - 6 câu Trả lời ngắn (4 VD, 2 VDC)
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
            setStatusMessage({
                type: 'info',
                text: 'Đã nạp Ma trận 20 câu kết hợp (12 TN, 2 Đúng/Sai, 6 Trả lời ngắn).'
            });
        }

        setMatrixRows(newRows);
    };

    // Tính tổng số câu toàn đề và chi tiết theo từng Loại câu hỏi
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
        return {
            b, h, vd, vdc, total,
            byType,
            chapterSums,
            pctB: total > 0 ? Math.round((b / total) * 100) : 0,
            pctH: total > 0 ? Math.round((h / total) * 100) : 0,
            pctVD: total > 0 ? Math.round((vd / total) * 100) : 0,
            pctVDC: total > 0 ? Math.round((vdc / total) * 100) : 0
        };
    }, [displayChapters, matrixRows]);

    // Xử lý tạo đề thi từ ma trận
    const handleGenerateFromMatrix = async () => {
        setStatusMessage(null);
        if (totals.total === 0) {
            setStatusMessage({ type: 'error', text: 'Vui lòng nhập số câu hỏi trong ma trận (tổng số câu phải lớn hơn 0)!' });
            return;
        }

        setIsGenerating(true);
        setGenerationProgress('Đang chọn lọc câu hỏi ngẫu nhiên từ Ngân hàng...');

        try {
            const finalQuestions: Question[] = [];
            const shortfalls: { chapterName: string; type: QuestionType; level: 'B' | 'H' | 'VD' | 'VDC'; needed: number }[] = [];
            const existingQuestionTexts = new Set<string>();

            // 1. Quét ngân hàng câu hỏi để lấy câu hỏi có sẵn theo đúng: Chương + Loại câu + Mức độ
            displayChapters.forEach(ch => {
                QUESTION_TYPES.forEach(t => {
                    const rowKey = `${ch.id}__${t.id}`;
                    const row = matrixRows[rowKey] || { b: 0, h: 0, vd: 0, vdc: 0 };
                    const cellStats = bankStats.statsByKey[rowKey];
                    const candidatesPool = cellStats?.questions || [];

                    const pickLevel = (levelKey: 'B' | 'H' | 'VD' | 'VDC', requestedCount: number) => {
                        if (requestedCount <= 0) return;
                        
                        const matched = candidatesPool.filter(q => {
                            return normalizeLevel(q.level) === levelKey && !existingQuestionTexts.has((q.text || '').trim());
                        });

                        const shuffled = shuffleArray(matched);
                        const picked = shuffled.slice(0, requestedCount);

                        picked.forEach((q: Question) => {
                            existingQuestionTexts.add((q.text || '').trim());
                            finalQuestions.push({
                                ...q,
                                id: uuidv4(), // Tạo ID mới cho câu trong đề thi
                                type: t.id,
                                chapterName: ch.name,
                                chapterId: ch.id,
                                level: levelKey
                            });
                        });

                        const diff = requestedCount - picked.length;
                        if (diff > 0) {
                            shortfalls.push({
                                chapterName: ch.name,
                                type: t.id,
                                level: levelKey,
                                needed: diff
                            });
                        }
                    };

                    pickLevel('B', row.b);
                    pickLevel('H', row.h);
                    pickLevel('VD', row.vd);
                    pickLevel('VDC', row.vdc);
                });
            });

            // 2. Nếu thiếu câu hỏi và bật tính năng AI bù câu
            if (shortfalls.length > 0 && allowAiFallback) {
                const totalMissing = shortfalls.reduce((acc, s) => acc + s.needed, 0);
                setGenerationProgress(`Ngân hàng thiếu ${totalMissing} câu. AI đang tạo bổ sung đúng dạng câu còn thiếu...`);

                for (const shortfall of shortfalls) {
                    const typeLabel = shortfall.type === 'mcq' ? 'Trắc nghiệm' : shortfall.type === 'group-tf' ? 'Đúng/Sai' : 'Trả lời ngắn';
                    const levelLabel = shortfall.level === 'B' ? 'Nhận biết' : shortfall.level === 'H' ? 'Thông hiểu' : shortfall.level === 'VD' ? 'Vận dụng' : 'VDC';
                    
                    setGenerationProgress(`AI đang soạn bù ${shortfall.needed} câu [${typeLabel} - ${levelLabel}] cho "${shortfall.chapterName}"...`);
                    
                    const aiCreated = await generateMissingQuestionsForChapter(
                        String(grade),
                        shortfall.chapterName,
                        shortfall.level,
                        shortfall.needed,
                        Array.from(existingQuestionTexts),
                        shortfall.type
                    );

                    aiCreated.forEach((q: Question) => {
                        existingQuestionTexts.add((q.text || '').trim());
                        finalQuestions.push(q);
                    });
                }
            }

            // 3. Sắp xếp đề thi theo cấu trúc chính quy GDPT 2018:
            // Thứ tự dạng câu: Phần I (mcq) -> Phần II (group-tf) -> Phần III (short)
            // Trong mỗi phần: Sắp xếp theo mức độ nhận thức (B -> H -> VD -> VDC)
            const typeSortOrder: Record<QuestionType, number> = {
                'mcq': 1,
                'group-tf': 2,
                'short': 3
            };
            const levelSortOrder: Record<string, number> = {
                'B': 1,
                'H': 2,
                'VD': 3,
                'VDC': 4
            };

            finalQuestions.sort((a, b) => {
                const aType = normalizeQuestionType(a.type);
                const bType = normalizeQuestionType(b.type);
                const typeDiff = (typeSortOrder[aType] || 1) - (typeSortOrder[bType] || 1);
                if (typeDiff !== 0) return typeDiff;

                const aLvl = normalizeLevel(a.level);
                const bLvl = normalizeLevel(b.level);
                const lvlDiff = (levelSortOrder[aLvl] || 2) - (levelSortOrder[bLvl] || 2);
                return lvlDiff;
            });

            // 4. Phân bổ điểm số chuẩn thang 10:
            // Nếu khớp cấu trúc chuẩn Bộ GD (18 mcq + 4 tf + 6 short):
            // mcq = 0.25đ; group-tf = 1.0đ; short = 0.25đ -> tổng = 18*0.25 + 4*1.0 + 6*0.25 = 4.5 + 4.0 + 1.5 = 10đ
            const numMcq = finalQuestions.filter(q => normalizeQuestionType(q.type) === 'mcq').length;
            const numTf = finalQuestions.filter(q => normalizeQuestionType(q.type) === 'group-tf').length;
            const numShort = finalQuestions.filter(q => normalizeQuestionType(q.type) === 'short').length;

            const isStandard28 = (numMcq === 18 && numTf === 4 && numShort === 6);

            const balancedQuestions = finalQuestions.map(q => {
                const t = normalizeQuestionType(q.type);
                let pts: number = 0.25;

                if (isStandard28) {
                    if (t === 'group-tf') pts = 1.0;
                    else pts = 0.25;
                } else {
                    // Nếu đề tự tạo khác, gán điểm cơ sở: tf=1.0, mcq=0.25, short=0.25 sau đó chuẩn hóa theo thang 10
                    const rawBase = (t === 'group-tf' ? 1.0 : 0.25);
                    const totalRawWeight = (numMcq * 0.25) + (numTf * 1.0) + (numShort * 0.25);
                    if (totalRawWeight > 0) {
                        pts = Number(((rawBase / totalRawWeight) * 10).toFixed(2));
                    } else {
                        pts = Number((10 / (finalQuestions.length || 1)).toFixed(2));
                    }
                }

                return {
                    ...q,
                    points: pts
                };
            });

            // Hoàn tất
            onGenerateSuccess(balancedQuestions, quizTitle, target, durationMinutes, editorAction);
        } catch (err: any) {
            console.error('Lỗi tạo đề ma trận:', err);
            setStatusMessage({
                type: 'error',
                text: 'Không thể tạo đề theo ma trận: ' + (err.message || 'Lỗi xử lý')
            });
        } finally {
            setIsGenerating(false);
            setGenerationProgress(null);
        }
    };

    // Lọc danh sách các loại câu cần hiển thị trên bảng
    const visibleQuestionTypes = useMemo(() => {
        if (selectedTypeFilter === 'all') return QUESTION_TYPES;
        return QUESTION_TYPES.filter(t => t.id === selectedTypeFilter);
    }, [selectedTypeFilter]);

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* TIÊU ĐỀ & MÔ TẢ */}
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl shadow-md">
                            <Grid3X3 size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                Tạo đề theo Ma trận từ Ngân hàng
                                <span className="text-[10px] bg-purple-100 text-purple-800 font-black px-2.5 py-0.5 rounded-full">
                                    GDPT 2018
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 font-bold">
                                Ma trận tích hợp đầy đủ 3 Loại câu hỏi (Phần I: Trắc nghiệm, Phần II: Đúng/Sai, Phần III: Trả lời ngắn) và 4 Mức độ nhận thức.
                            </p>
                        </div>
                    </div>

                    {/* NÚT ĐỔI KHỐI LỚP & ĐÍCH ĐẾN */}
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
                                title="Đưa đề thi vào màn hình biên tập để xem trước và xuất Word/PDF"
                            >
                                <LayoutTemplate size={13}/> Vào Editor
                            </button>
                            <button 
                                type="button"
                                onClick={() => setTarget('bank')} 
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all ${
                                    target === 'bank' ? 'bg-white text-purple-600 shadow-xs' : 'text-slate-500'
                                }`}
                                title="Lưu thẳng danh sách câu hỏi vào Ngân hàng"
                            >
                                <Database size={13}/> Vào Bank
                            </button>
                        </div>
                    </div>
                </div>

                {/* THÔNG BÁO TRẠNG THÁI */}
                {statusMessage && (
                    <div className={`p-4 rounded-2xl border-2 flex items-center justify-between text-xs font-bold animate-fade-in ${
                        statusMessage.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                        statusMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
                        <div className="flex items-center gap-2">
                            {statusMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                            <span>{statusMessage.text}</span>
                        </div>
                        <button type="button" onClick={() => setStatusMessage(null)} className="text-xs opacity-60 hover:opacity-100">Đóng</button>
                    </div>
                )}

                {/* TIÊU ĐỀ ĐỀ THI & THỜI GIAN LÀM BÀI */}
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

                {/* THANH CÁC MẪU ĐỀ CÓ SẴN (PRESETS) */}
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
                            title="Chuẩn cấu trúc định dạng Bộ GD: 18 Trắc nghiệm + 4 Đúng/Sai + 6 Trả lời ngắn"
                        >
                            <Sparkles size={13} className="text-amber-300 fill-amber-300" />
                            <span>Chuẩn Bộ GD (28 câu)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('quiz40')}
                            className="px-3.5 py-2 bg-white border border-slate-300 hover:border-purple-500 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                            title="40 câu trắc nghiệm 4 lựa chọn (16B - 12H - 8VD - 4VDC)"
                        >
                            Đề 40 câu trắc nghiệm
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('quiz20')}
                            className="px-3.5 py-2 bg-white border border-slate-300 hover:border-purple-500 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                            title="20 câu kiểm tra nhanh 45 phút kết hợp 3 dạng"
                        >
                            Đề 20 câu kiểm tra
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('clear')}
                            className="px-3 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                            title="Đưa toàn bộ số lượng câu về 0"
                        >
                            <RotateCcw size={12} />
                            <span>Xóa trắng</span>
                        </button>
                    </div>
                </div>

                {/* BỘ LỌC HÀNG LOẠI CÂU HỎI TRÊN BẢNG MA TRẬN */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                    <div className="flex items-center gap-2">
                        <Filter size={15} className="text-indigo-600" />
                        <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wider">
                            Hiển thị Loại câu trong Ma trận:
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setSelectedTypeFilter('all')}
                            className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                                selectedTypeFilter === 'all'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white text-slate-600 hover:bg-indigo-100/50 border border-slate-200'
                            }`}
                        >
                            Tất cả 3 loại câu (Phần I, II, III)
                        </button>
                        {QUESTION_TYPES.map(t => {
                            const isSelected = selectedTypeFilter === t.id;
                            const count = totals.byType[t.id].total;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setSelectedTypeFilter(t.id)}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-white text-slate-600 hover:bg-indigo-100/50 border border-slate-200'
                                    }`}
                                >
                                    <span>{t.partLabel}: {t.shortName}</span>
                                    {count > 0 && (
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* BẢNG MA TRẬN THEO CHƯƠNG, HÀNG LOẠI CÂU & 4 MỨC ĐỘ */}
                <div className="overflow-x-auto border-2 border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                                <th className="p-3.5 pl-5 w-[28%]">Chương kiến thức</th>
                                <th className="p-3.5 w-[20%]">Hàng Loại câu hỏi</th>
                                <th className="p-3.5 text-center bg-emerald-700 w-[12%]">
                                    <span>Biết (B)</span>
                                </th>
                                <th className="p-3.5 text-center bg-blue-700 w-[12%]">
                                    <span>Hiểu (H)</span>
                                </th>
                                <th className="p-3.5 text-center bg-amber-700 w-[12%]">
                                    <span>V.Dụng (VD)</span>
                                </th>
                                <th className="p-3.5 text-center bg-red-700 w-[12%]">
                                    <span>VDC</span>
                                </th>
                                <th className="p-3.5 text-center pr-5 bg-slate-800 w-[8%]">Tổng</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {displayChapters.map((ch, chIdx) => {
                                const isCollapsed = !!collapsedChapters[ch.id];
                                const chapterTotalQuestions = totals.chapterSums[ch.id] || 0;
                                const bankTotalForChapter = bankStats.chapterTotals[ch.id] || 0;

                                return (
                                    <React.Fragment key={ch.id}>
                                        {/* DÒNG TIÊU ĐỀ CHƯƠNG */}
                                        <tr className="bg-slate-100/90 border-t-2 border-slate-200">
                                            <td colSpan={2} className="p-3 pl-5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 font-black text-slate-800 text-xs">
                                                        <Layers size={15} className="text-purple-600 shrink-0" />
                                                        <span>{ch.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                                            Kho: <b className="text-purple-700">{bankTotalForChapter}</b> câu
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCollapsedChapters(prev => ({ ...prev, [ch.id]: !prev[ch.id] }))}
                                                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                                                            title={isCollapsed ? "Mở rộng chương này" : "Thu gọn chương này"}
                                                        >
                                                            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td colSpan={4} className="p-3 text-slate-400 text-[10px] font-bold italic">
                                                {isCollapsed ? 'Đã thu gọn các hàng loại câu' : ''}
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

                                        {/* CÁC HÀNG LOẠI CÂU HỎI TRONG CHƯƠNG */}
                                        {!isCollapsed && visibleQuestionTypes.map((t) => {
                                            const rowKey = `${ch.id}__${t.id}`;
                                            const row = matrixRows[rowKey] || { b: 0, h: 0, vd: 0, vdc: 0 };
                                            const cellStats = bankStats.statsByKey[rowKey] || { b: 0, h: 0, vd: 0, vdc: 0, total: 0 };
                                            const rowTotal = row.b + row.h + row.vd + row.vdc;
                                            const TypeIcon = t.icon;

                                            return (
                                                <tr key={rowKey} className="bg-white hover:bg-slate-50/70 transition-colors border-b border-slate-100">
                                                    {/* CỘT CHƯƠNG (Cột rỗng thụt đầu dòng) */}
                                                    <td className="p-2.5 pl-8 text-slate-400 text-[11px] border-r border-slate-100/80">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span className="truncate max-w-[200px]" title={ch.name}>{ch.name}</span>
                                                        </div>
                                                    </td>

                                                    {/* CỘT HÀNG LOẠI CÂU HỎI */}
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
                                                                <div className="text-[9px] text-slate-400 font-normal">
                                                                    Kho: <b className="text-indigo-600 font-bold">{cellStats.total}</b> câu
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* CỘT NHẬN BIẾT */}
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
                                                        <div className={`text-[9px] font-bold mt-1 ${cellStats.b >= row.b && cellStats.b > 0 ? 'text-emerald-600' : cellStats.b === 0 ? 'text-slate-400' : 'text-amber-600'}`}>
                                                            Kho: {cellStats.b}
                                                        </div>
                                                    </td>

                                                    {/* CỘT THÔNG HIỂU */}
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
                                                        <div className={`text-[9px] font-bold mt-1 ${cellStats.h >= row.h && cellStats.h > 0 ? 'text-blue-600' : cellStats.h === 0 ? 'text-slate-400' : 'text-amber-600'}`}>
                                                            Kho: {cellStats.h}
                                                        </div>
                                                    </td>

                                                    {/* CỘT VẬN DỤNG */}
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
                                                        <div className={`text-[9px] font-bold mt-1 ${cellStats.vd >= row.vd && cellStats.vd > 0 ? 'text-amber-600' : cellStats.vd === 0 ? 'text-slate-400' : 'text-amber-600'}`}>
                                                            Kho: {cellStats.vd}
                                                        </div>
                                                    </td>

                                                    {/* CỘT VẬN DỤNG CAO */}
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
                                                        <div className={`text-[9px] font-bold mt-1 ${cellStats.vdc >= row.vdc && cellStats.vdc > 0 ? 'text-red-600' : cellStats.vdc === 0 ? 'text-slate-400' : 'text-amber-600'}`}>
                                                            Kho: {cellStats.vdc}
                                                        </div>
                                                    </td>

                                                    {/* TỔNG HÀNG LOẠI CÂU */}
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

                        {/* TỔNG KẾT THEO TỪNG LOẠI CÂU & TOÀN ĐỀ */}
                        <tfoot className="border-t-2 border-slate-300 font-black text-xs">
                            {/* Dòng tổng hợp Phần I: Trắc nghiệm */}
                            <tr className="bg-indigo-50/60 text-indigo-900 border-b border-indigo-100">
                                <td colSpan={2} className="p-2.5 pl-5 uppercase flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-indigo-600" />
                                    <span>Tổng Phần I: Trắc nghiệm 4 lựa chọn ({totals.byType.mcq.total} câu)</span>
                                </td>
                                <td className="p-2 text-center text-emerald-800">{totals.byType.mcq.b} câu</td>
                                <td className="p-2 text-center text-blue-800">{totals.byType.mcq.h} câu</td>
                                <td className="p-2 text-center text-amber-800">{totals.byType.mcq.vd} câu</td>
                                <td className="p-2 text-center text-red-800">{totals.byType.mcq.vdc} câu</td>
                                <td className="p-2 pr-5 text-center font-black text-indigo-700">{totals.byType.mcq.total} câu</td>
                            </tr>

                            {/* Dòng tổng hợp Phần II: Đúng / Sai */}
                            <tr className="bg-emerald-50/60 text-emerald-900 border-b border-emerald-100">
                                <td colSpan={2} className="p-2.5 pl-5 uppercase flex items-center gap-2">
                                    <CheckSquare size={14} className="text-emerald-600" />
                                    <span>Tổng Phần II: Trắc nghiệm Đúng / Sai ({totals.byType['group-tf'].total} câu)</span>
                                </td>
                                <td className="p-2 text-center text-emerald-800">{totals.byType['group-tf'].b} câu</td>
                                <td className="p-2 text-center text-blue-800">{totals.byType['group-tf'].h} câu</td>
                                <td className="p-2 text-center text-amber-800">{totals.byType['group-tf'].vd} câu</td>
                                <td className="p-2 text-center text-red-800">{totals.byType['group-tf'].vdc} câu</td>
                                <td className="p-2 pr-5 text-center font-black text-emerald-700">{totals.byType['group-tf'].total} câu</td>
                            </tr>

                            {/* Dòng tổng hợp Phần III: Trả lời ngắn */}
                            <tr className="bg-amber-50/60 text-amber-900 border-b border-amber-200">
                                <td colSpan={2} className="p-2.5 pl-5 uppercase flex items-center gap-2">
                                    <FileText size={14} className="text-amber-600" />
                                    <span>Tổng Phần III: Trả lời ngắn ({totals.byType.short.total} câu)</span>
                                </td>
                                <td className="p-2 text-center text-emerald-800">{totals.byType.short.b} câu</td>
                                <td className="p-2 text-center text-blue-800">{totals.byType.short.h} câu</td>
                                <td className="p-2 text-center text-amber-800">{totals.byType.short.vd} câu</td>
                                <td className="p-2 text-center text-red-800">{totals.byType.short.vdc} câu</td>
                                <td className="p-2 pr-5 text-center font-black text-amber-700">{totals.byType.short.total} câu</td>
                            </tr>

                            {/* DÒNG TỔNG CỘNG TOÀN ĐỀ */}
                            <tr className="bg-slate-900 text-white font-black text-xs">
                                <td colSpan={2} className="p-3.5 pl-5 uppercase tracking-wider text-amber-300">
                                    TỔNG CỘNG TOÀN ĐỀ ({totals.total} CÂU)
                                </td>
                                <td className="p-3 text-center bg-emerald-900 text-emerald-200">
                                    <div>{totals.b} câu</div>
                                    <div className="text-[10px] font-bold text-emerald-300">({totals.pctB}%)</div>
                                </td>
                                <td className="p-3 text-center bg-blue-900 text-blue-200">
                                    <div>{totals.h} câu</div>
                                    <div className="text-[10px] font-bold text-blue-300">({totals.pctH}%)</div>
                                </td>
                                <td className="p-3 text-center bg-amber-900 text-amber-200">
                                    <div>{totals.vd} câu</div>
                                    <div className="text-[10px] font-bold text-amber-300">({totals.pctVD}%)</div>
                                </td>
                                <td className="p-3 text-center bg-red-900 text-red-200">
                                    <div>{totals.vdc} câu</div>
                                    <div className="text-[10px] font-bold text-red-300">({totals.pctVDC}%)</div>
                                </td>
                                <td className="p-3 pr-5 text-center text-amber-300 bg-slate-950 text-sm">
                                    {totals.total} câu
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* TÙY CHỌN BÙ CÂU HỎI BẰNG AI & THÔNG TIN */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={allowAiFallback}
                            onChange={e => setAllowAiFallback(e.target.checked)}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-xs font-bold text-purple-950">
                            Tự động dùng AI tạo bổ sung đúng Loại câu và Mức độ nếu Ngân hàng bị thiếu câu
                        </span>
                    </label>

                    {hasQuestionsInEditor && target === 'editor' && (
                        <div className="flex flex-wrap items-center justify-center gap-2 p-2 px-3 bg-purple-50/90 border border-purple-200 rounded-2xl">
                            <span className="text-[11px] font-bold text-purple-900">
                                Editor đang có câu hỏi sẵn:
                            </span>
                            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-purple-200 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => setEditorAction('replace')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                        editorAction === 'replace'
                                            ? 'bg-purple-600 text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    Tạo đề mới (Làm trống đề cũ)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditorAction('append')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                        editorAction === 'append'
                                            ? 'bg-purple-600 text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    Chèn thêm vào đề hiện có
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* TIẾN TRÌNH KHI ĐANG TẠO */}
                {isGenerating && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3 text-blue-800 text-xs font-bold animate-pulse">
                        <Loader2 className="animate-spin text-blue-600 shrink-0" size={18} />
                        <span>{generationProgress || 'Hệ thống đang chọn lọc và ghép đề theo ma trận...'}</span>
                    </div>
                )}

                {/* NÚT BẮT ĐẦU TẠO ĐỀ */}
                <div className="flex items-center gap-3 pt-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isGenerating}
                            className="py-4 px-6 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
                        >
                            Hủy
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleGenerateFromMatrix}
                        disabled={isGenerating || totals.total === 0}
                        className="flex-1 py-5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-xl shadow-purple-200 flex items-center justify-center gap-3 disabled:opacity-50 transition-all active:scale-[0.99]"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                <span>Đang xử lý ma trận...</span>
                            </>
                        ) : (
                            <>
                                <Zap size={18} />
                                <span>TẠO ĐỀ THEO MA TRẬN ({totals.total} CÂU HỎI)</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
