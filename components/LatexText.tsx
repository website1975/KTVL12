
import React, { useEffect } from 'react';

declare const katex: any;

interface LatexTextProps {
  text: string;
}

const LatexText: React.FC<LatexTextProps> = ({ text }) => {
  useEffect(() => {
    // Re-render handled by React key prop mostly, but effect ensures cleanup if needed
  }, [text]);

  if (!text) return null;

  // Split text by standard LaTeX delimiters: $...$ for inline
  const parts = text.split(/(\$.*?\$)/g);
  
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
                   return <span key={i} dangerouslySetInnerHTML={{ __html: html }} className="mx-1 font-serif text-lg" />;
               }
               return <code key={i} className="bg-gray-100 p-1 rounded text-red-500 font-mono">{latex}</code>
             } catch (e) {
               return <span key={i} className="text-red-400">{part}</span>;
             }
           }
           // Cho phép render HTML (như thẻ <br/>) trong phần văn bản thường
           return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />;
      })}
    </span>
  );
};

export default LatexText;
