import React, { useState, useEffect } from 'react';
import { Quiz, ClassRoom } from '../../types';
import { X, Copy, Check, Send, MessageSquare, ExternalLink, Sparkles, BookOpen, Clock, Users } from 'lucide-react';

interface ZaloNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz | null;
  classes?: ClassRoom[];
}

export const formatZaloDateTime = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
};

export const getAssignedClassNames = (q: Quiz, classes: ClassRoom[] = []) => {
  if (q.targetType === 'classes' && q.assignedClassIds && q.assignedClassIds.length > 0) {
    const names = q.assignedClassIds.map(id => {
      const found = classes?.find(c => c.id === id);
      return found ? found.name : id;
    });
    return names.join(', ');
  }
  return 'Tất cả các lớp';
};

export const getRoomNames = (q: Quiz, classes: ClassRoom[] = []) => {
  if (q.targetType === 'classes' && q.assignedClassIds && q.assignedClassIds.length > 0) {
    const names = q.assignedClassIds.map(id => {
      const found = classes?.find(c => c.id === id);
      return found ? found.name : id;
    });
    return names.join(', ');
  }
  return 'TOÀN KHỐI';
};

export const generateZaloNoticeText = (q: Quiz, classes: ClassRoom[] = []): string => {
  const qCount = q.questionCount || (q.questions ? q.questions.length : 0);
  const classNames = getAssignedClassNames(q, classes);
  const roomNames = getRoomNames(q, classes);
  
  const startTimeStr = q.startTime ? formatZaloDateTime(q.startTime) : 'Mở tự do (Bắt đầu ngay)';
  const endTimeStr = q.endTime ? formatZaloDateTime(q.endTime) : 'Không giới hạn hạn nộp';
  
  const formStr = q.type === 'practice'
    ? 'Tự luyện (Không giới hạn lượt)'
    : `Làm bài kiểm tra (${q.maxAttempts && q.maxAttempts > 1 ? `${q.maxAttempts} lần làm bài` : '1 lần duy nhất'})`;
    
  const quizLink = `${window.location.origin}/?quiz=${q.id}`;
  const subjectStr = q.category || 'Vật lý';
  const gradeStr = q.grade === 'all' ? 'Tất cả' : q.grade;

  return `📢 [THÔNG BÁO BÀI TẬP / BÀI KIỂM TRA MỚI]
━━━━━━━━━━━━━━━━━━━━
📝 Đề thi: ${q.title}
📚 Môn: ${subjectStr} - Khối ${gradeStr}
👥 Lớp: ${classNames}, PHÒNG ${roomNames}
⏱️ Thời lượng: ${q.durationMinutes} phút (${qCount} câu hỏi)
⏰ Khung giờ / Hạn nộp: ${startTimeStr} ➔ ${endTimeStr}
📌 Hình thức: ${formStr}
━━━━━━━━━━━━━━━━━━━━
👉 LINK LÀM BÀI TRỰC TIẾP:
${quizLink}

ℹ️ Hướng dẫn: Các em học sinh nhấp vào link trên, đăng nhập bằng Mã số học sinh (MSHS) để bắt đầu làm bài. Chúc các em làm bài đạt kết quả cao`;
};

export default function ZaloNoticeModal({ isOpen, onClose, quiz, classes = [] }: ZaloNoticeModalProps) {
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    if (quiz) {
      setCustomText(generateZaloNoticeText(quiz, classes));
      setCopied(false);
    }
  }, [quiz, classes]);

  if (!isOpen || !quiz) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(customText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center font-black">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight">Thông báo đề thi gửi Zalo</h3>
              <p className="text-[11px] text-blue-100 font-medium">Đã định dạng sẵn lời nhắn chuyên nghiệp cho nhóm lớp</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-start gap-3">
            <Sparkles size={18} className="text-sky-600 shrink-0 mt-0.5" />
            <p className="text-xs text-sky-900 font-medium leading-relaxed">
              Văn bản bên dưới đã được chuẩn hóa tự động theo thông tin bài thi <strong>"{quiz.title}"</strong>. Bạn có thể chỉnh sửa văn bản trực tiếp trước khi copy dán vào Zalo nhóm lớp.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-700">Nội dung thông báo (Sẵn sàng gửi):</label>
              {copied && (
                <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                  <Check size={12} /> Đã sao chép vào bộ nhớ đệm!
                </span>
              )}
            </div>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={12}
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono font-medium text-slate-800 leading-relaxed outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (quiz) setCustomText(generateZaloNoticeText(quiz, classes));
            }}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-all"
          >
            Khôi phục mặc định
          </button>

          <div className="flex items-center gap-2">
            <a
              href="https://chat.zalo.me"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all"
            >
              <ExternalLink size={14} />
              <span>Mở Zalo Web</span>
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
              }`}
            >
              {copied ? (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>ĐÃ SAO CHÉP LỜI NHẮC!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>SAO CHÉP LỜI NHẮC ZALO</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
