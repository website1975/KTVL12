import React, { useMemo, useState } from 'react';
import { normalizeFullText } from '../services/vietnameseFixer';
import { X } from 'lucide-react';

declare const katex: any;

interface LatexTextProps {
  text: string;
  className?: string;
}

export default function LatexText({ text, className = '' }: LatexTextProps) {
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  if (!text) return null;

  // Chuẩn hóa tiếng Việt (sửa vỡ dấu), giữ nguyên 100% công thức trong $...$ và $$...$$
  const cleanText = useMemo(() => normalizeFullText(text), [text]);

  const renderedContent = useMemo(() => {
    if (!cleanText) return null;

    // Tách chuỗi theo: Thẻ ảnh <img...>, Display Math $$...$$, Inline Math $...$
    const parts = cleanText.split(/(<img[^>]*>|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

    return parts.map((part, index) => {
      if (!part) return null;

      // 1. Xử lý thẻ ảnh <img>
      if (part.startsWith('<img') && part.endsWith('>')) {
        const srcMatch = part.match(/src=["'](.*?)["']/);
        const altMatch = part.match(/alt=["'](.*?)["']/);
        const src = srcMatch ? srcMatch[1] : '';
        const alt = altMatch ? altMatch[1] : 'Hình ảnh';

        return (
          <span key={index} className="inline-block my-2 max-w-full">
            <img
              src={src}
              alt={alt}
              className="max-h-72 max-w-full object-contain rounded-xl border border-slate-200 shadow-sm cursor-zoom-in hover:opacity-95 transition-all"
              onClick={() => setZoomImg(src)}
            />
          </span>
        );
      }

      // 2. Xử lý Display Math: $$...$$
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
        const formula = part.slice(2, -2).trim();
        try {
          const k = typeof katex !== 'undefined' ? katex : (typeof window !== 'undefined' ? (window as any).katex : null);
          if (k) {
            const html = k.renderToString(formula, {
              displayMode: true,
              throwOnError: false,
            });
            return (
              <span
                key={index}
                className="block my-2 overflow-x-auto text-center"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          return <span key={index} className="block my-2 font-mono text-center">{formula}</span>;
        } catch {
          return <span key={index} className="block my-2 font-mono text-red-500">{formula}</span>;
        }
      }

      // 3. Xử lý Inline Math: $...$
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const formula = part.slice(1, -1).trim();
        try {
          const k = typeof katex !== 'undefined' ? katex : (typeof window !== 'undefined' ? (window as any).katex : null);
          if (k) {
            const html = k.renderToString(formula, {
              displayMode: false,
              throwOnError: false,
            });
            return (
              <span
                key={index}
                className="inline-block mx-0.5"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          return <span key={index} className="font-mono">{formula}</span>;
        } catch {
          return <span key={index} className="font-mono text-red-500">{formula}</span>;
        }
      }

      // 4. Văn bản thường: giữ nguyên ngắt dòng và thụt lề
      return (
        <span key={index} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  }, [cleanText]);

  return (
    <>
      <span className={`quiz-rendered-text ${className}`}>
        {renderedContent}
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
