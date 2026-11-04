import React, { useState, useMemo } from 'react';
import { Lesson, Chapter, Grade } from '../../types';
import { 
  BookOpen, Plus, ExternalLink, Trash2, Edit3, Search, Copy, Check, 
  Sparkles, Layers, Link as LinkIcon, RefreshCw, X, Lightbulb, CheckCircle2,
  FolderTree, AlertCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LessonViewerModal from '../LessonViewerModal';
import LatexText from '../LatexText';
import { getChapterNumberFromName } from './MatrixQuizGenerator';

// Chuẩn hóa tên chương để so khớp mềm dẻo không phân biệt:
// - Viết hoa / viết thường
// - Dấu gạch ngang, dấu hai chấm, khoảng trắng thừa
// - Chính tả "lí" (i ngắn) vs "lý" (y dài) phổ biến trong tiếng Việt (Vật lí / Vật lý, Khí lí / Khí lý)
export const normalizeChapterText = (str?: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFC')
    .replace(/lý/g, 'lí')
    .replace(/ký/g, 'kí')
    .replace(/[.:,\-_/\\()[\]{}|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const matchLessonToChapterFilter = (
  lesson: { grade: Grade; chapterId?: string; chapterName?: string },
  filterVal: string,
  allChapters: Chapter[]
): boolean => {
  if (!filterVal || filterVal === 'all') return true;

  const lessonChId = lesson.chapterId || '';
  const lessonChName = lesson.chapterName || '';

  // 1. Khớp chính xác ID hoặc Name
  if (lessonChId === filterVal || lessonChName === filterVal) return true;

  // 2. Tra cứu đối tượng Chapter trong danh sách hệ thống theo ID hoặc Name
  const targetChapter = allChapters.find(
    c => c.id === filterVal || c.name === filterVal || (c as any).title === filterVal
  );

  if (targetChapter) {
    if (lessonChId && lessonChId === targetChapter.id) return true;
    const targetNorm = normalizeChapterText(targetChapter.name || (targetChapter as any).title);
    const lessonNorm = normalizeChapterText(lessonChName);
    if (targetNorm && lessonNorm) {
      if (targetNorm === lessonNorm) return true;
      if (targetNorm.includes(lessonNorm) || lessonNorm.includes(targetNorm)) return true;
    }
  }

  // 3. Khớp chuỗi đã chuẩn hóa (khắc phục lí / lý, hoa / thường, dấu câu)
  const filterNorm = normalizeChapterText(filterVal);
  const lessonNorm = normalizeChapterText(lessonChName);
  if (filterNorm && lessonNorm) {
    if (filterNorm === lessonNorm) return true;
    if (filterNorm.includes(lessonNorm) || lessonNorm.includes(filterNorm)) return true;
  }

  // 4. Khớp theo số thứ tự chương (VD: "Chương 1: vật lý nhiệt" và "Chương 1: Vật lí nhiệt")
  const getChapterNum = (text: string) => {
    const m = text.match(/chương\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  };
  const numFilter = getChapterNum(filterVal);
  const numLesson = getChapterNum(lessonChName);
  if (numFilter !== null && numLesson !== null && numFilter === numLesson) {
    return true;
  }

  // 5. Khớp theo chủ đề từ khóa chuẩn Vật lí
  try {
    const numF = getChapterNumberFromName(filterVal, lesson.grade);
    const numL = getChapterNumberFromName(lessonChName, lesson.grade);
    if (numF > 0 && numL > 0 && numF === numL) {
      return true;
    }
  } catch (e) {}

  return false;
};

interface LessonManagerProps {
  lessons: Lesson[];
  chapters: Chapter[];
  onSaveLesson: (lesson: Lesson) => Promise<void> | void;
  onSaveBatchLessons?: (lessons: Lesson[]) => Promise<void> | void;
  onDeleteLesson: (id: string) => Promise<void> | void;
  isLoading?: boolean;
}

// Danh mục bài học mẫu chuẩn Vercel để giáo viên nạp nhanh khi cần
const SAMPLE_VERCEL_LESSONS: Omit<Lesson, 'id'>[] = [
  {
    grade: '10',
    chapterId: 'ch_10_c1',
    chapterName: 'Chương 1: Mở đầu & Động học',
    title: 'Bài 1: Làm quen với Vật lí',
    url: 'https://hethonghoctap-nhc.vercel.app/student?subject=10&node=g10-1780405969901',
    defaultKeyConcept: '1/ Đối tượng nghiên cứu của Vật lí:\n- Các dạng vận động của vật chất và năng lượng.\n2/ Công thức sai số:\n- Sai số tuyệt đối: $\\Delta A = |\\bar{A} - A_i|$\n- Sai số tỉ đối: $\\delta A = \\frac{\\Delta A}{\\bar{A}} \\times 100\\%$'
  },
  {
    grade: '10',
    chapterId: 'ch_10_c2',
    chapterName: 'Chương 2: Động lực học',
    title: 'Bài 13: Tổng hợp và phân tích lực. Cân bằng lực',
    url: 'https://hethonghoctap-nhc.vercel.app/student?subject=10&node=g10-1780405969910',
    defaultKeyConcept: '1/ Công thức độ lớn hợp lực của hai lực đồng quy $\\vec{F}_1, \\vec{F}_2$:\n$$F = \\sqrt{F_1^2 + F_2^2 + 2F_1F_2\\cos\\alpha}$$\n- Cùng chiều ($\\alpha = 0^\\circ$): $F_{\\max} = F_1 + F_2$\n- Ngược chiều ($\\alpha = 180^\\circ$): $F_{\\min} = |F_1 - F_2|$\n- Vuông góc ($\\alpha = 90^\\circ$): $F = \\sqrt{F_1^2 + F_2^2}$'
  },
  {
    grade: '10',
    chapterId: 'ch_10_c2',
    chapterName: 'Chương 2: Động lực học',
    title: 'Bài 14: Định luật 1 Newton & Quán tính',
    url: 'https://hethonghoctap-nhc.vercel.app/student?subject=10&node=g10-1780405969911',
    defaultKeyConcept: '1/ Định luật I Newton (Quán tính):\nNếu một vật không chịu tác dụng của lực nào hoặc chịu tác dụng của các lực có hợp lực bằng không:\n$$\\Sigma \\vec{F} = \\vec{0} \\Rightarrow \\vec{a} = \\vec{0}$$\n- Vật đang đứng yên tiếp tục đứng yên; vật đang chuyển động sẽ tiếp tục chuyển động thẳng đều.'
  },
  {
    grade: '11',
    chapterId: 'ch_11_c1',
    chapterName: 'Chương 1: Dao động',
    title: 'Bài 1: Mô tả dao động điều hòa',
    url: 'https://hethonghoctap-nhc.vercel.app/student?subject=11&node=g11-dao-dong-dieu-hoa',
    defaultKeyConcept: '1/ Phương trình dao động điều hòa:\n- Li độ: $x = A\\cos(\\omega t + \\varphi)$\n- Vận tốc: $v = -\\omega A\\sin(\\omega t + \\varphi)$\n- Gia tốc: $a = -\\omega^2 x$\n- Chu kì: $T = \\frac{2\\pi}{\\omega}$, tần số: $f = \\frac{1}{T}$'
  },
  {
    grade: '12',
    chapterId: 'ch_12_c1',
    chapterName: 'Chương 1: Vật lí nhiệt',
    title: 'Bài 1: Cấu trúc của chất. Sự chuyển thể',
    url: 'https://hethonghoctap-nhc.vercel.app/student?subject=12&node=g12-vat-li-nhiet-b1',
    defaultKeyConcept: '1/ Mô hình động học phân tử về cấu tạo chất:\n- Các chất được cấu tạo từ các hạt riêng biệt là phân tử.\n- Các phân tử chuyển động hỗn loạn không ngừng.\n2/ Công thức nhiệt lượng:\n- Thay đổi nhiệt độ: $Q = m \\cdot c \\cdot \\Delta T$\n- Nhiệt nóng chảy: $Q = \\lambda \\cdot m$\n- Nhiệt hóa hơi: $Q = L \\cdot m$'
  }
];

export default function LessonManager({
  lessons,
  chapters,
  onSaveLesson,
  onSaveBatchLessons,
  onDeleteLesson,
  isLoading = false
}: LessonManagerProps) {
  const [selectedGrade, setSelectedGrade] = useState<Grade | 'all'>('10');
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal thêm / chỉnh sửa bài học
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [formGrade, setFormGrade] = useState<Grade>('10');
  const [formChapterId, setFormChapterId] = useState('');
  const [formChapterName, setFormChapterName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDefaultKeyConcept, setFormDefaultKeyConcept] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal xem thử bài học trong iframe
  const [previewLesson, setPreviewLesson] = useState<{ url: string; title?: string } | null>(null);

  // Lọc danh sách chương theo khối đang chọn trong modal
  const chaptersForFormGrade = useMemo(() => {
    return chapters.filter(c => String(c.grade) === String(formGrade));
  }, [chapters, formGrade]);

  // Tự động gán chương mặc định khi đổi khối trong form
  const handleFormGradeChange = (g: Grade) => {
    setFormGrade(g);
    const matched = chapters.filter(c => String(c.grade) === String(g));
    if (matched.length > 0) {
      setFormChapterId(matched[0].id);
      setFormChapterName(matched[0].name || (matched[0] as any).title || '');
    } else {
      setFormChapterId('');
      setFormChapterName('');
    }
  };

  const handleOpenAddModal = (defaultChapter?: Chapter) => {
    setEditingLessonId(null);
    const g = defaultChapter ? defaultChapter.grade : (selectedGrade !== 'all' ? selectedGrade : '10');
    setFormGrade(g);
    if (defaultChapter) {
      setFormChapterId(defaultChapter.id);
      setFormChapterName(defaultChapter.name || (defaultChapter as any).title || '');
    } else {
      const matched = chapters.filter(c => String(c.grade) === String(g));
      if (matched.length > 0) {
        setFormChapterId(matched[0].id);
        setFormChapterName(matched[0].name || (matched[0] as any).title || '');
      } else {
        setFormChapterId('');
        setFormChapterName('');
      }
    }
    setFormTitle('');
    setFormUrl('');
    setFormDefaultKeyConcept('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setFormGrade(lesson.grade);
    setFormChapterId(lesson.chapterId);
    setFormChapterName(lesson.chapterName);
    setFormTitle(lesson.title);
    setFormUrl(lesson.url);
    setFormDefaultKeyConcept(lesson.defaultKeyConcept || '');
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Vui lòng nhập tên bài học.");
      return;
    }
    if (!formUrl.trim()) {
      alert("Vui lòng nhập đường dẫn liên kết bài học.");
      return;
    }

    let chapterName = formChapterName;
    if (formChapterId) {
      const foundCh = chapters.find(c => c.id === formChapterId);
      if (foundCh) {
        chapterName = foundCh.name || (foundCh as any).title || formChapterName;
      }
    }
    if (!chapterName) {
      chapterName = `Chương Khối ${formGrade}`;
    }

    setIsSaving(true);
    try {
      const payload: Lesson = {
        id: editingLessonId || uuidv4(),
        grade: formGrade,
        chapterId: formChapterId || `ch_${formGrade}_gen`,
        chapterName,
        title: formTitle.trim(),
        url: formUrl.trim(),
        defaultKeyConcept: formDefaultKeyConcept.trim() || undefined
      };

      await onSaveLesson(payload);
      setIsModalOpen(false);
      setEditingLessonId(null);
    } catch (err: any) {
      alert("Lỗi khi lưu bài học: " + (err?.message || "Không xác định"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedSamples = async () => {
    if (!window.confirm("Bạn có muốn nạp nhanh 5 bài học mẫu chuẩn Vercel (Khối 10, 11, 12)? Các bài học này có đầy đủ link và công thức cốt lõi sẵn sàng.")) {
      return;
    }

    const newLessons: Lesson[] = SAMPLE_VERCEL_LESSONS.map(s => {
      // Tìm chương khớp tên mềm dẻo nếu có
      const matchedCh = chapters.find(c => {
        if (String(c.grade) !== String(s.grade)) return false;
        return matchLessonToChapterFilter(s, c.name, chapters);
      });
      return {
        ...s,
        id: uuidv4(),
        chapterId: matchedCh ? matchedCh.id : s.chapterId,
        chapterName: matchedCh ? (matchedCh.name || (matchedCh as any).title) : s.chapterName
      };
    });

    if (onSaveBatchLessons) {
      await onSaveBatchLessons(newLessons);
    } else {
      for (const item of newLessons) {
        await onSaveLesson(item);
      }
    }
    alert("Đã nạp thành công 5 bài học mẫu!");
  };

  const handleCopyUrl = (url: string, id: string) => {
    try {
      navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      alert("Không thể sao chép URL: " + url);
    }
  };

  // Lọc bài học theo Khối, Chương, và Từ khóa (so khớp mềm dẻo lí/lý, hoa/thường, ID/Tên)
  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      const matchGrade = selectedGrade === 'all' || String(l.grade) === String(selectedGrade);
      const matchChapter = matchLessonToChapterFilter(l, selectedChapterFilter, chapters);
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || (l.defaultKeyConcept && l.defaultKeyConcept.toLowerCase().includes(q));
      return matchGrade && matchChapter && matchSearch;
    });
  }, [lessons, selectedGrade, selectedChapterFilter, searchQuery, chapters]);

  // Gom nhóm bài học theo Khối & Chương để hiển thị theo cây khoa học
  const groupedLessons = useMemo(() => {
    const map = new Map<string, { grade: Grade; chapterName: string; chapterId: string; items: Lesson[] }>();

    filteredLessons.forEach(l => {
      // Tìm tên chương chuẩn từ chapters nếu có để gom nhóm đồng nhất
      const sysChapter = chapters.find(c => String(c.grade) === String(l.grade) && matchLessonToChapterFilter(l, c.name, chapters));
      const groupDisplayName = sysChapter ? (sysChapter.name || (sysChapter as any).title) : l.chapterName;
      const key = `${l.grade}___${normalizeChapterText(groupDisplayName)}`;

      if (!map.has(key)) {
        map.set(key, {
          grade: l.grade,
          chapterName: groupDisplayName,
          chapterId: sysChapter ? sysChapter.id : l.chapterId,
          items: []
        });
      }
      map.get(key)!.items.push(l);
    });

    const groups = Array.from(map.values());
    // Sắp xếp bài học trong từng chương theo thứ tự Bài 1, Bài 2, Bài 3...
    groups.forEach(g => {
      g.items.sort((a, b) => {
        const numA = (a.title.match(/bài\s*(\d+)/i) || a.title.match(/^(\d+)/))?.[1];
        const numB = (b.title.match(/bài\s*(\d+)/i) || b.title.match(/^(\d+)/))?.[1];
        if (numA && numB) return parseInt(numA, 10) - parseInt(numB, 10);
        return a.title.localeCompare(b.title, undefined, { numeric: true });
      });
    });

    // Sắp xếp các chương theo Khối và Chương 1, Chương 2, Chương 3...
    groups.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, undefined, { numeric: true });
      const numChA = (a.chapterName.match(/chương\s*(\d+)/i))?.[1];
      const numChB = (b.chapterName.match(/chương\s*(\d+)/i))?.[1];
      if (numChA && numChB) return parseInt(numChA, 10) - parseInt(numChB, 10);
      return a.chapterName.localeCompare(b.chapterName, undefined, { numeric: true });
    });

    return groups;
  }, [filteredLessons, chapters]);

  // Danh sách các chương để đưa vào dropdown bộ lọc:
  // Hợp nhất giữa bảng chapters của hệ thống và các chapterName thực tế đang có trong lessons
  const filterChapterOptions = useMemo(() => {
    type ChapterOption = {
      id: string;
      name: string;
      lessonCount: number;
    };

    const gradeLessons = lessons.filter(l => selectedGrade === 'all' || String(l.grade) === String(selectedGrade));
    const gradeChapters = chapters.filter(c => selectedGrade === 'all' || String(c.grade) === String(selectedGrade));

    const options: ChapterOption[] = [];
    const addedNorms = new Set<string>();

    // 1. Thêm các chương từ danh mục chapters
    gradeChapters.forEach(c => {
      const name = c.name || (c as any).title || "Chương chưa đặt tên";
      const norm = normalizeChapterText(name);
      // Đếm số bài học thực tế thuộc chương này trong khối đang chọn
      const count = gradeLessons.filter(l => matchLessonToChapterFilter(l, name, chapters) || (l.chapterId && l.chapterId === c.id)).length;
      options.push({
        id: c.id,
        name: name,
        lessonCount: count
      });
      if (norm) addedNorms.add(norm);
    });

    // 2. Bổ sung các chương có bài học trong lessons mà chưa có trong danh mục chapters
    gradeLessons.forEach(l => {
      if (!l.chapterName) return;
      const norm = normalizeChapterText(l.chapterName);
      if (!norm || addedNorms.has(norm)) return;

      const exists = options.some(opt => {
        const optNorm = normalizeChapterText(opt.name);
        return optNorm === norm || (optNorm && norm && (optNorm.includes(norm) || norm.includes(optNorm)));
      });

      if (!exists) {
        const count = gradeLessons.filter(item => matchLessonToChapterFilter(item, l.chapterName, chapters)).length;
        options.push({
          id: l.chapterId || l.chapterName,
          name: l.chapterName,
          lessonCount: count
        });
        addedNorms.add(norm);
      }
    });

    return options;
  }, [chapters, lessons, selectedGrade]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-blue-200 border border-white/10">
              <BookOpen size={13} className="text-blue-300" />
              <span>HỆ THỐNG LIÊN KẾT BÀI HỌC SGK / VERCEL</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white">
              QUẢN LÝ BÀI HỌC & ĐƯỜNG DẪN ÔN TẬP
            </h1>
            <p className="text-xs text-blue-100/80 leading-relaxed font-medium">
              Bổ sung tên bài học thuộc từng chương và gán đường dẫn web bài học. Khi tạo đề thi, chỉ cần chọn tên bài học tương ứng, hệ thống sẽ tự động gán đường dẫn vào câu hỏi mà không cần copy paste nhiều lần!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSeedSamples}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2 backdrop-blur-sm active:scale-95"
              title="Nạp nhanh 5 bài học mẫu chuẩn Vercel để dùng thử"
            >
              <Sparkles size={14} className="text-amber-300" />
              <span>Nạp mẫu Vercel</span>
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              className="px-6 py-3.5 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 active:scale-95"
            >
              <Plus size={16} />
              <span>Thêm bài học mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Chọn khối */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
              {(['10', '11', '12', 'all'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => {
                    setSelectedGrade(g);
                    setSelectedChapterFilter('all');
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                    selectedGrade === g
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {g === 'all' ? 'Tất cả khối' : `Khối ${g}`}
                </button>
              ))}
            </div>

            {/* Lọc chương */}
            <select
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all max-w-xs cursor-pointer shadow-2xs"
              value={selectedChapterFilter}
              onChange={e => setSelectedChapterFilter(e.target.value)}
            >
              <option value="all">📂 Tất cả chương học</option>
              {filterChapterOptions.map(opt => (
                <option key={opt.id || opt.name} value={opt.name}>
                  {opt.name} {opt.lessonCount > 0 ? `(${opt.lessonCount} bài)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Ô tìm kiếm */}
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 transition-all"
              placeholder="Tìm theo tên bài học hoặc đường dẫn..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1 pt-1 border-t border-slate-100">
          <span>
            Đang hiển thị <strong>{filteredLessons.length}</strong> bài học (Tổng số trong CSDL: {lessons.length})
          </span>
          <span className="text-blue-600 uppercase text-[9px] font-black">
            Liên kết với Ngân hàng & Trình soạn đề tự động
          </span>
        </div>
      </div>

      {/* Main List */}
      {groupedLessons.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <BookOpen size={28} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-black uppercase text-slate-800 tracking-tight">
              Chưa có bài học nào trong mục này
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Bạn có thể thêm bài học mới hoặc nhấn nút nạp nhanh dữ liệu mẫu chuẩn Vercel để thử nghiệm tính năng ngay lập tức.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={handleSeedSamples}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase shadow-xs transition-all active:scale-95 flex items-center gap-2"
            >
              <Sparkles size={14} />
              <span>Nạp 5 bài học mẫu chuẩn</span>
            </button>
            <button
              onClick={() => handleOpenAddModal()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-xs transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus size={14} />
              <span>Thêm bài học mới</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedLessons.map(group => (
            <div key={`${group.grade}___${group.chapterName}`} className="space-y-3">
              {/* Group chapter title */}
              <div className="flex items-center justify-between px-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider">
                    Khối {group.grade}
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-800 font-black text-sm uppercase">
                    <FolderTree size={16} className="text-blue-600" />
                    <span>{group.chapterName}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {group.items.length} bài học
                  </span>
                </div>

                <button
                  onClick={() => {
                    const ch = chapters.find(c => c.id === group.chapterId || matchLessonToChapterFilter({ grade: group.grade, chapterName: group.chapterName }, c.name, chapters));
                    handleOpenAddModal(ch || { id: group.chapterId, grade: group.grade, name: group.chapterName, order: 0 });
                  }}
                  className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Plus size={12} />
                  <span>Thêm bài vào chương này</span>
                </button>
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.items.map((lesson, idx) => (
                  <div
                    key={lesson.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black">
                            {idx + 1}
                          </span>
                          <h4 className="font-black text-slate-800 text-sm leading-snug group-hover:text-blue-600 transition-colors">
                            {lesson.title}
                          </h4>
                        </div>
                      </div>

                      {/* URL Box */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <LinkIcon size={13} className="text-blue-600 shrink-0" />
                          <span className="text-[11px] font-mono text-blue-700 truncate font-semibold" title={lesson.url}>
                            {lesson.url}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(lesson.url, lesson.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                            title="Sao chép đường dẫn"
                          >
                            {copiedId === lesson.id ? (
                              <Check size={13} className="text-emerald-600" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewLesson({ url: lesson.url, title: lesson.title })}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                            title="Mở xem thử bài học trong modal"
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Default key concept if available */}
                      {lesson.defaultKeyConcept && (
                        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-950 space-y-1">
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-800">
                            <Lightbulb size={11} className="text-amber-600" />
                            <span>Kiến thức trọng tâm mặc định:</span>
                          </div>
                          <div className="text-[11px] text-slate-700 line-clamp-2 pl-1 font-medium">
                            <LatexText text={lesson.defaultKeyConcept} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPreviewLesson({ url: lesson.url, title: lesson.title })}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors"
                      >
                        <BookOpen size={12} />
                        <span>Xem thử bài học</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(lesson)}
                          className="px-3 py-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-colors"
                        >
                          <Edit3 size={12} />
                          <span>Sửa</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Bạn có chắc chắn muốn xóa bài học "${lesson.title}" không?`)) {
                              await onDeleteLesson(lesson.id);
                            }
                          }}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Xóa bài học"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Thêm / Chỉnh sửa bài học */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[3200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 animate-scale-up overflow-hidden my-auto">
            {/* Modal Header - Cố định ở đầu */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner shrink-0">
                  <BookOpen size={17} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tight text-xs sm:text-sm">
                    {editingLessonId ? 'Chỉnh sửa bài học' : 'Thêm bài học mới'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium line-clamp-1">
                    Gán tên bài với đường dẫn web để tái sử dụng nhanh khi tạo đề
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form với phần thân có thanh cuộn và nút bấm cố định bên dưới */}
            <form onSubmit={handleSubmitForm} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Chọn khối */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Khối học:
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all cursor-pointer"
                      value={formGrade}
                      onChange={e => handleFormGradeChange(e.target.value as Grade)}
                    >
                      <option value="10">Khối 10</option>
                      <option value="11">Khối 11</option>
                      <option value="12">Khối 12</option>
                    </select>
                  </div>

                  {/* Chọn chương */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Chương học:
                    </label>
                    {chaptersForFormGrade.length > 0 ? (
                      <select
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all cursor-pointer truncate"
                        value={formChapterId}
                        onChange={e => {
                          const cid = e.target.value;
                          setFormChapterId(cid);
                          const ch = chaptersForFormGrade.find(c => c.id === cid);
                          if (ch) setFormChapterName(ch.name || (ch as any).title || '');
                        }}
                      >
                        {chaptersForFormGrade.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name || (c as any).title || "Chương"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all"
                        placeholder="Nhập tên chương..."
                        value={formChapterName}
                        onChange={e => setFormChapterName(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                {/* Tên bài học */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Tên bài học <span className="text-red-500">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all placeholder:text-slate-400"
                    placeholder="VD: Bài 13: Tổng hợp và phân tích lực"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                  />
                </div>

                {/* Link bài học */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Đường dẫn web bài học (Link Vercel / SGK) <span className="text-red-500">*</span>:
                    </label>
                    {formUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewLesson({ url: formUrl, title: formTitle || 'Xem thử bài học' })}
                        className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <ExternalLink size={10} />
                        <span>Xem thử</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-blue-700 outline-none focus:border-blue-500 transition-all placeholder:text-slate-400 font-mono text-[11px]"
                    placeholder="https://hethonghoctap-nhc.vercel.app/student?subject=10&node=g10-1780405969910"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                  />
                </div>

                {/* Kiến thức trọng tâm mặc định (tùy chọn) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Khung kiến thức cốt lõi (tùy chọn):
                    </label>
                    <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      Hỗ trợ LaTeX ($...$)
                    </span>
                  </div>

                  <textarea
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:border-blue-500 transition-all placeholder:text-slate-400 leading-relaxed min-h-[70px] max-h-[140px]"
                    rows={3}
                    placeholder="VD: Công thức: $F = \sqrt{F_1^2 + F_2^2 + 2F_1F_2\cos\alpha}$&#10;Ghi chú: Gia tốc luôn ngược pha với li độ..."
                    value={formDefaultKeyConcept}
                    onChange={e => setFormDefaultKeyConcept(e.target.value)}
                  />
                  {formDefaultKeyConcept && (
                    <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-slate-700 shadow-2xs max-h-36 overflow-y-auto">
                      <p className="text-[9px] font-black uppercase text-amber-800 mb-1 flex items-center gap-1">
                        <Sparkles size={10} className="text-amber-600" />
                        <span>Xem trước hiển thị:</span>
                      </p>
                      <div className="p-2 bg-white rounded-lg border border-amber-100">
                        <LatexText text={formDefaultKeyConcept} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer hành động - Cố định ở dưới đáy, luôn hiển thị nút Lưu & Hủy */}
              <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-100 bg-slate-50/90 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 font-black uppercase text-[11px] rounded-xl hover:bg-white transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] rounded-xl shadow-md shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>{editingLessonId ? 'Cập nhật bài học' : 'Lưu bài học'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xem thử bài học trong iframe */}
      <LessonViewerModal
        isOpen={!!previewLesson}
        lessonUrl={previewLesson?.url || ''}
        lessonTitle={previewLesson?.title}
        onClose={() => setPreviewLesson(null)}
      />
    </div>
  );
}
