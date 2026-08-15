
import React, { useMemo } from 'react';
import { normalizeFullText } from '../services/vietnameseFixer';

declare const katex: any;

interface LatexTextProps {
  text: string;
}

export default function LatexText({ text }: LatexTextProps) {
  if (!text) return null;

  // Chuẩn hóa tiếng Việt (sửa vỡ dấu) và tự động nhận diện công thức LaTeX chưa bọc $...$
  const cleanText = useMemo(() => normalizeFullText(text), [text]);

  // Tách text theo cú pháp LaTeX $...$
  const parts = useMemo(() => cleanText.split(/(\$.*?\$)/g), [cleanText]);
  
  return (
    <span>
      {parts.map((part, i) => {
           if (part.startsWith('$') && part.endsWith('$')) {
             try {
               const latex = part.slice(1, -1);
               if (typeof katex !== 'undefined') {
                   const html = katex.renderToString(latex, { 
                       throwOnError: false,
                       output: 'html', // Generate HTML for rendering
                       displayMode: false // Inline math
                   });
                   // Thêm data-latex để lưu lại mã gốc cho việc xuất Word
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
           // Cho phép render HTML (như thẻ <br/>) trong phần văn bản thường
           return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />;
      })}
    </span>
  );
}
