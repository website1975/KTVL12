import React, { useState } from 'react';
import { ChevronsRight, BookOpen, ExternalLink, Lightbulb, Sparkles } from 'lucide-react';
import LatexText from './LatexText';

interface KeyConceptCardProps {
  keyConcept?: string;
  lessonUrl?: string;
  lessonTitle?: string;
  onOpenLesson?: (url: string, title?: string) => void;
  className?: string;
}

export default function KeyConceptCard({
  keyConcept,
  lessonUrl,
  lessonTitle,
  onOpenLesson,
  className = ''
}: KeyConceptCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasConcept = Boolean(keyConcept && keyConcept.trim());
  const hasLesson = Boolean(lessonUrl && lessonUrl.trim());

  if (!hasConcept && !hasLesson) return null;

  const displayTitle = lessonTitle?.trim() || 'Tài liệu học tập / Kiến thức liên quan';

  const handleOpenExternal = () => {
    if (!lessonUrl) return;
    if (onOpenLesson) {
      onOpenLesson(lessonUrl.trim(), displayTitle);
    } else {
      window.open(lessonUrl.trim(), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`mt-4 ${className}`}>
      {/* Nút bấm nhỏ "Kiến thức cơ bản" với biểu tượng >> và tooltip */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-2xl text-xs font-black uppercase transition-all shadow-2xs active:scale-95 group cursor-pointer"
        title="Kiến thức cơ bản"
      >
        <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
          <ChevronsRight size={14} className="stroke-[3]" />
        </span>
        <span>Kiến thức cơ bản</span>
        <span className="text-[10px] text-amber-600 font-bold ml-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Nội dung hiển thị khi nhấn */}
      {isOpen && (
        <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50/95 via-orange-50/70 to-amber-50/40 p-5 shadow-md animate-fade-in space-y-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-200/40 rounded-full blur-xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Lightbulb size={16} />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  Kiến thức cơ bản & Trọng tâm
                  <Sparkles size={12} className="text-amber-600 animate-pulse" />
                </h4>
                <p className="text-[10px] text-amber-700 font-semibold">
                  Định lý, công thức cốt lõi và hướng dẫn ôn tập
                </p>
              </div>
            </div>

            {hasLesson && (
              <button
                type="button"
                onClick={handleOpenExternal}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 shrink-0"
                title="Chuyển hướng đến web link ngoài để học chi tiết"
              >
                <BookOpen size={14} />
                <span className="truncate max-w-[220px]">
                  {lessonTitle ? `Xem: ${lessonTitle}` : 'Xem bài học ngoài'}
                </span>
                <ExternalLink size={12} className="opacity-80 shrink-0" />
              </button>
            )}
          </div>

          {hasConcept && (
            <div className="text-slate-800 text-sm font-semibold leading-relaxed bg-white/90 p-4 rounded-xl border border-amber-200 shadow-2xs relative z-10">
              <LatexText text={keyConcept!} />
            </div>
          )}

          {!hasConcept && hasLesson && (
            <div className="flex items-center justify-between bg-white/90 p-4 rounded-xl border border-amber-200 relative z-10">
              <span className="text-xs font-bold text-slate-700">{displayTitle}</span>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <span>Mở web link ngoài</span>
                <ExternalLink size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
