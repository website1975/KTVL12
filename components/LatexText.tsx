import React, { useMemo, useState } from 'react';
import { normalizeFullText } from '../services/vietnameseFixer';
import { X, ZoomIn } from 'lucide-react';

declare const katex: any;

interface LatexTextProps {
  text: string;
}

export default function LatexText({ text }: LatexTextProps) {
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  if (!text) return null;

  // Chuẩn hóa tiếng Việt (sửa vỡ dấu), giữ nguyên 100% công thức trong $...$
  const cleanText = useMemo(() => normalizeFullText(text), [text]);

  // Tách text theo cú pháp LaTeX $...$
  const parts = useMemo(() => cleanText.split(/(\$.*?\$)/g), [cleanText]);

  // Lấy đối tượng KaTeX an toàn
  const getKatexInstance = () => {
    if (typeof katex !== 'undefined') return katex;
    if (typeof window !== 'undefined' && (window as any).katex) return (window as any).katex;
    return null;
  };

  const k = getKatexInstance();

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const src = (target as HTMLImageElement).src;
      if (src) {
        setZoomImg(src);
      }
    }
  };

  return (
    <>
      <span onClick={handleContainerClick} className="quiz-rendered-text">
        {parts.map((part, i) => {
          if (!part) return null;
          if (part.startsWith('$') && part.endsWith('$')) {
            const latex = part.slice(1, -1);
            
            // Hỗ trợ trường hợp gõ $\\$ hoặc $\\\\$ để xuống dòng
            if (latex.trim() === '\\' || latex.trim() === '\\\\' || latex.trim() === '') {
              return <br key={i} className="my-0.5" />;
            }

            try {
              if (k) {
                const html = k.renderToString(latex, { 
                  throwOnError: false,
                  output: 'html',
                  displayMode: false
                });
                return (
                  <span 
                    key={i} 
                    dangerouslySetInnerHTML={{ __html: html }} 
                    data-latex={latex}
                    className="latex-item inline-block mx-0.5 align-baseline" 
                  />
                );
              }
              return <code key={i} className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-mono text-sm">{latex}</code>;
            } catch (e) {
              return <span key={i} className="text-red-400">{part}</span>;
            }
          }

          // Hỗ trợ chuyển đổi Markdown image ![mô tả](url) thành thẻ <img> đẹp mắt
          let formattedPart = part.replace(
            /!\[(.*?)\]\((https?:\/\/[^\s\)]+|data:image\/[^\s\)]+)\)/g,
            '<img src="$2" alt="$1" class="quiz-inline-img my-2.5 max-h-72 max-w-full rounded-xl border border-slate-200 shadow-sm mx-auto block cursor-zoom-in" style="max-height: 280px; object-fit: contain;" loading="lazy" />'
          );

          // Cho phép render HTML (như thẻ <br/>, <b>, <img>...) và tự động chuyển phím Enter (\n) thành <br/>
          formattedPart = formattedPart.replace(/\n/g, '<br/>');

          return <span key={i} dangerouslySetInnerHTML={{ __html: formattedPart }} />;
        })}
      </span>

      {/* Modal Phóng to xem ảnh lớn khi click vào bất kỳ ảnh nào trong đề hoặc lời dẫn */}
      {zoomImg && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-sm animate-in fade-in"
          onClick={() => setZoomImg(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl p-3 shadow-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomImg(null)}
              className="absolute -top-3 -right-3 w-9 h-9 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-black transition-all"
            >
              <X size={18} />
            </button>
            <img 
              src={zoomImg} 
              alt="Phóng to" 
              className="max-h-[82vh] max-w-full object-contain rounded-2xl" 
            />
          </div>
        </div>
      )}
    </>
  );
}
