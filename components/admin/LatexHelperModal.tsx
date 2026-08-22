import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Copy, Check, CornerDownLeft, Trash2, 
  Type, Bold, Italic, Underline, Palette, Sparkles, RefreshCw
} from 'lucide-react';
import LatexText from '../LatexText';

interface LatexHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCode?: (code: string) => void;
  targetQuestionLabel?: string | null;
  initialCode?: string;
}

// Danh sách ký hiệu toán học nhanh (Symbols Grid)
const MATH_SYMBOLS = [
  { label: '≤', code: '\\le ' },
  { label: '≥', code: '\\ge ' },
  { label: '≠', code: '\\neq ' },
  { label: '≈', code: '\\approx ' },
  { label: '±', code: '\\pm ' },
  { label: '∓', code: '\\mp ' },
  { label: '∈', code: '\\in ' },
  { label: '∉', code: '\\notin ' },
  { label: '⊂', code: '\\subset ' },
  { label: '∪', code: '\\cup ' },
  { label: '∩', code: '\\cap ' },
  { label: '∅', code: '\\emptyset ' },
  { label: '∀', code: '\\forall ' },
  { label: '∃', code: '\\exists ' },
  { label: '⇒', code: '\\Rightarrow ' },
  { label: '⇔', code: '\\Leftrightarrow ' },
  { label: '→', code: '\\to ' },
  { label: '∞', code: '+\\infty ' },
  { label: '-∞', code: '-\\infty ' },
  { label: '°', code: '^\\circ ' },
  { label: '∥', code: '\\parallel ' },
  { label: '⊥', code: '\\perp ' },
  { label: 'Δ', code: '\\Delta ' },
  { label: 'π', code: '\\pi ' },
  { label: 'α', code: '\\alpha ' },
  { label: 'β', code: '\\beta ' },
  { label: 'γ', code: '\\gamma ' },
  { label: 'θ', code: '\\theta ' },
  { label: 'λ', code: '\\lambda ' },
  { label: 'φ', code: '\\varphi ' },
  { label: 'ω', code: '\\omega ' },
  { label: 'ℝ', code: '\\mathbb{R} ' },
];

// Danh sách bảng màu nhanh
const COLOR_PRESETS = [
  { name: 'Đỏ', hex: '#ef4444', latex: 'red' },
  { name: 'Xanh dương', hex: '#2563eb', latex: 'blue' },
  { name: 'Xanh lá', hex: '#16a34a', latex: 'green' },
  { name: 'Cam', hex: '#ea580c', latex: 'orange' },
  { name: 'Tím', hex: '#9333ea', latex: 'purple' },
  { name: 'Hồng', hex: '#db2777', latex: 'magenta' },
  { name: 'Đen', hex: '#0f172a', latex: 'black' },
];

// Các nhóm mẫu công thức
const TEMPLATE_TABS = [
  { id: 'algebra', name: 'Đại số & Giải tích' },
  { id: 'geometry', name: 'Hình học & Vector' },
  { id: 'systems', name: 'Hệ PT & Dấu ngoặc' },
  { id: 'sets_logic', name: 'Tập hợp & Tổ hợp' },
];

const TEMPLATES: Record<string, Array<{ label: string; preview: string; code: string; title: string }>> = {
  algebra: [
    { label: 'Phân số lớn', preview: '$\\dfrac{a}{b}$', code: '\\dfrac{a}{b}', title: 'Phân số kích thước lớn rõ nét' },
    { label: 'Phân số nhỏ', preview: '$\\frac{a}{b}$', code: '\\frac{a}{b}', title: 'Phân số kích thước vừa' },
    { label: 'Căn bậc hai', preview: '$\\sqrt{x}$', code: '\\sqrt{x}', title: 'Căn bậc 2' },
    { label: 'Căn bậc n', preview: '$\\sqrt[n]{x}$', code: '\\sqrt[n]{x}', title: 'Căn bậc n' },
    { label: 'Lũy thừa', preview: '$x^2$', code: 'x^2', title: 'Số mũ / lũy thừa' },
    { label: 'Chỉ số dưới', preview: '$x_1$', code: 'x_1', title: 'Chỉ số dưới (nghiệm, dãy số)' },
    { label: 'Mũ & Chỉ số', preview: '$x_1^2$', code: 'x_1^2', title: 'Cả số mũ và chỉ số dưới' },
    { label: 'Tích phân cận to', preview: '$\\displaystyle\\int_{a}^{b} f(x)dx$', code: '\\displaystyle\\int_{a}^{b} f(x)\\,dx', title: 'Tích phân có cận từ a đến b' },
    { label: 'Nguyên hàm', preview: '$\\int f(x)dx$', code: '\\int f(x)\\,dx', title: 'Nguyên hàm hàm số' },
    { label: 'Giới hạn Lim', preview: '$\\lim_{x \\to x_0} f(x)$', code: '\\lim_{x \\to x_0} f(x)', title: 'Giới hạn Lim' },
    { label: 'Tổng Sigma', preview: '$\\sum_{i=1}^{n} a_i$', code: '\\sum_{i=1}^{n} a_i', title: 'Tổng Sigma' },
    { label: 'Đạo hàm', preview: '$y\', f\'(x)$', code: 'y\', f\'(x)', title: 'Đạo hàm' },
  ],
  geometry: [
    { label: 'Vector đơn', preview: '$\\vec{u}$', code: '\\vec{u}', title: 'Vector chỉ phương / pháp tuyến' },
    { label: 'Vector 2 điểm', preview: '$\\overrightarrow{AB}$', code: '\\overrightarrow{AB}', title: 'Vector nối 2 điểm' },
    { label: 'Góc có mũ', preview: '$\\widehat{ABC}$', code: '\\widehat{ABC}', title: 'Góc có dấu mũ' },
    { label: 'Độ góc', preview: '$60^\\circ$', code: '60^\\circ', title: 'Ký hiệu độ' },
    { label: 'Tam giác', preview: '$\\Delta ABC$', code: '\\Delta ABC', title: 'Tam giác ABC' },
    { label: 'Song song', preview: '$d_1 \\parallel d_2$', code: 'd_1 \\parallel d_2', title: 'Quan hệ song song' },
    { label: 'Vuông góc', preview: '$d \\perp (P)$', code: 'd \\perp (P)', title: 'Quan hệ vuông góc' },
    { label: 'Mặt phẳng', preview: '$(P), (Q), (\\alpha)$', code: '(P), (Q), (\\alpha)', title: 'Ký hiệu mặt phẳng' },
  ],
  systems: [
    { label: 'Hệ PT (Ngoặc nhọn)', preview: '$\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}$', code: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}', title: 'Hệ phương trình 2 ẩn' },
    { label: 'Hệ 3 PT', preview: '$\\begin{cases} x + y + z = 1 \\\\ 2x - y + z = 3 \\\\ x + 2y - z = 0 \\end{cases}$', code: '\\begin{cases} x + y + z = 1 \\\\ 2x - y + z = 3 \\\\ x + 2y - z = 0 \\end{cases}', title: 'Hệ phương trình 3 ẩn' },
    { label: 'Tuyển nghiệm (Ngoặc vuông)', preview: '$\\left[\\begin{aligned} x &= 1 \\\\ x &= 2 \\end{aligned}\\right.$', code: '\\left[\\begin{aligned} x &= 1 \\\\ x &= 2 \\end{aligned}\\right.', title: 'Ngoặc vuông tuyển chọn nghiệm' },
    { label: 'Ngoặc tròn tự co dãn', preview: '$\\left( \\dfrac{a}{b} \\right)$', code: '\\left( \\dfrac{a}{b} \\right)', title: 'Ngoặc tròn lớn ôm trọn phân số' },
    { label: 'Trị tuyệt đối / Module', preview: '$|x|, |z|$', code: '|x|', title: 'Giá trị tuyệt đối' },
    { label: 'Ma trận $2\\times2$', preview: '$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$', code: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', title: 'Ma trận / Định thức' },
  ],
  sets_logic: [
    { label: 'Tập số thực ℝ', preview: '$D = \\mathbb{R} \\setminus \\{0\\}$', code: 'D = \\mathbb{R} \\setminus \\{0\\}', title: 'Tập số thực, tập xác định' },
    { label: 'Tổ hợp $C_n^k$', preview: '$C_n^k$', code: 'C_n^k', title: 'Tổ hợp chập k của n' },
    { label: 'Chỉnh hợp $A_n^k$', preview: '$A_n^k$', code: 'A_n^k', title: 'Chỉnh hợp' },
    { label: 'Giai thừa $n!$', preview: '$n! = n(n-1)...1$', code: 'n!', title: 'Giai thừa' },
    { label: 'Với mọi ∀', preview: '$\\forall x \\in \\mathbb{R}$', code: '\\forall x \\in \\mathbb{R}', title: 'Với mọi x' },
    { label: 'Tồn tại ∃', preview: '$\\exists x > 0$', code: '\\exists x > 0', title: 'Tồn tại x' },
  ],
};

export default function LatexHelperModal({
  isOpen,
  onClose,
  onInsertCode,
  targetQuestionLabel,
  initialCode = ''
}: LatexHelperModalProps) {
  const [editorText, setEditorText] = useState<string>('$\\dfrac{a}{b}$');
  const [activeTab, setActiveTab] = useState<string>('algebra');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialCode && initialCode.trim()) {
        setEditorText(initialCode);
      } else {
        setEditorText('$\\dfrac{a}{b}$');
      }
      setIsCopied(false);
    }
  }, [isOpen, initialCode]);

  if (!isOpen) return null;

  // Chèn chuỗi mã vào vị trí con trỏ trong Textarea
  const insertAtCursor = (textToInsert: string, wrapMath: boolean = false) => {
    const textarea = textareaRef.current;
    let finalInsert = textToInsert;

    // Nếu người dùng chọn chèn công thức nhưng chưa có dấu $ bao quanh
    if (wrapMath && !textToInsert.startsWith('$') && !textToInsert.startsWith('<')) {
      finalInsert = `$${textToInsert}$`;
    }

    if (!textarea) {
      setEditorText(prev => prev ? `${prev} ${finalInsert}` : finalInsert);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = editorText.substring(0, start);
    const after = editorText.substring(end);

    const newText = before + finalInsert + after;
    setEditorText(newText);

    // Di chuyển con trỏ ra sau chuỗi vừa chèn
    setTimeout(() => {
      textarea.focus();
      const nextPos = start + finalInsert.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 50);
  };

  // Bao bọc đoạn văn bản đang được chọn với thẻ HTML hoặc lệnh LaTeX
  const wrapSelectedText = (prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      insertAtCursor(`${prefix}${suffix}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editorText.substring(start, end);
    const content = selected || 'nội dung';

    const before = editorText.substring(0, start);
    const after = editorText.substring(end);
    const newText = before + prefix + content + suffix + after;

    setEditorText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + content.length);
    }, 50);
  };

  // Áp dụng màu sắc cho đoạn chọn
  const applyColor = (colorName: string, colorHex: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart || 0;
    const end = textarea?.selectionEnd || 0;

    // Kiểm tra xem đoạn chọn có nằm trong công thức LaTeX $...$ hay không
    const isInsideMath = editorText.lastIndexOf('$', start) !== -1 && 
                         (editorText.indexOf('$', start) !== -1 || editorText.endsWith('$'));

    if (isInsideMath) {
      wrapSelectedText(`\\color{${colorName}}{`, '}');
    } else {
      wrapSelectedText(`<span style="color:${colorHex}">`, '</span>');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editorText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(null as any), 1800);
  };

  const handleInsertToQuiz = () => {
    if (onInsertCode && editorText.trim()) {
      onInsertCode(editorText);
      onClose();
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[3600] flex items-center justify-center p-2 sm:p-4">
      {/* Cửa sổ Equation Editor mô phỏng MathType chuyên nghiệp, thiết kế cố định Header/Footer và có thanh cuộn độc lập */}
      <div className="bg-[#f0f2f5] text-slate-800 w-full max-w-4xl h-[94vh] max-h-[860px] rounded-2xl shadow-2xl border-2 border-slate-400/60 flex flex-col overflow-hidden animate-scale-up font-sans">
        
        {/* 1. TITLE BAR (CỐ ĐỊNH Ở ĐẦU - LUÔN THẤY RÕ NÚT X) */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between select-none shrink-0 border-b border-slate-700 z-10 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-blue-600 rounded text-white text-xs font-black">∑</span>
            <h3 className="text-xs sm:text-sm font-black tracking-wide uppercase">
              Equation Editor - Soạn thảo công thức & LaTeX
            </h3>
            {targetQuestionLabel && (
              <span className="bg-white/20 text-blue-200 text-[10px] px-2 py-0.5 rounded font-bold border border-white/10">
                {targetQuestionLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Nút chèn / copy nhanh ngay trên Header nếu muốn */}
            <button
              onClick={handleCopy}
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                isCopied ? 'bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
              title="Sao chép toàn bộ mã"
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
              {isCopied ? 'Đã copy' : 'Copy'}
            </button>
            <button 
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 rounded-lg text-white font-bold transition-colors shadow-sm cursor-pointer"
              title="Đóng cửa sổ (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2. BODY CHÍNH CÓ THANH TRƯỢT DỌC (Scrollable Content Container) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col divide-y divide-slate-300">
          
          {/* Thanh công cụ Định dạng chữ & Màu sắc */}
          <div className="bg-white px-3 py-2 flex flex-wrap items-center gap-2 text-xs shrink-0 select-none">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
              <Type size={12}/> Định dạng:
            </span>

            {/* Các nút In đậm, In nghiêng, Gạch chân */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                onClick={() => wrapSelectedText('<b>', '</b>')}
                className="p-1.5 hover:bg-white rounded font-bold text-slate-700 hover:text-black transition-colors"
                title="Chữ in đậm (Bold) <b>...</b>"
              >
                <Bold size={13} />
              </button>
              <button
                onClick={() => wrapSelectedText('<i>', '</i>')}
                className="p-1.5 hover:bg-white rounded italic text-slate-700 hover:text-black transition-colors"
                title="Chữ in nghiêng (Italic) <i>...</i>"
              >
                <Italic size={13} />
              </button>
              <button
                onClick={() => wrapSelectedText('<u>', '</u>')}
                className="p-1.5 hover:bg-white rounded text-slate-700 hover:text-black transition-colors"
                title="Gạch chân <u>...</u>"
              >
                <Underline size={13} />
              </button>
            </div>

            {/* Các nút Xuống dòng */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                onClick={() => insertAtCursor('<br>\n')}
                className="px-2 py-1 hover:bg-white rounded text-[11px] font-mono font-bold text-blue-700 hover:text-blue-900 transition-colors"
                title="Xuống dòng với thẻ <br>"
              >
                &lt;br&gt;
              </button>
              <button
                onClick={() => insertAtCursor('$\\$\\n')}
                className="px-2 py-1 hover:bg-white rounded text-[11px] font-mono font-bold text-indigo-700 hover:text-indigo-900 transition-colors"
                title="Xuống dòng kiểu $\\$ (LaTeX)"
              >
                $\\$
              </button>
            </div>

            {/* Chèn chữ tiếng Việt trong công thức */}
            <button
              onClick={() => wrapSelectedText('\\text{', '}')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-700 transition-colors"
              title="Chèn chữ tiếng Việt có dấu trong công thức LaTeX: \text{...}"
            >
              \text&#123;chữ&#125;
            </button>

            {/* Bảng chọn màu sắc */}
            <div className="flex items-center gap-1 sm:ml-auto pl-2 border-l border-slate-200">
              <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-0.5">
                <Palette size={11}/> Màu:
              </span>
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.name}
                    onClick={() => applyColor(c.latex, c.hex)}
                    className="w-4 h-4 rounded-full border border-black/20 hover:scale-125 transition-transform shadow-xs"
                    style={{ backgroundColor: c.hex }}
                    title={`Tô màu ${c.name}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Thanh công cụ Ký hiệu toán học nhanh (Symbols Grid) */}
          <div className="bg-slate-50 px-3 py-2 overflow-x-auto custom-scrollbar shrink-0 select-none">
            <div className="flex items-center gap-1 min-w-max">
              <span className="text-[9px] font-black uppercase text-slate-400 mr-1">Ký hiệu:</span>
              {MATH_SYMBOLS.map((sym, idx) => (
                <button
                  key={idx}
                  onClick={() => insertAtCursor(sym.code)}
                  className="min-w-[26px] h-[26px] px-1.5 bg-white hover:bg-blue-600 hover:text-white border border-slate-300 rounded text-xs font-bold transition-all shadow-2xs active:scale-95 flex items-center justify-center cursor-pointer"
                  title={`Chèn ký hiệu ${sym.label} (${sym.code})`}
                >
                  {sym.label}
                </button>
              ))}
            </div>
          </div>

          {/* Khu vực Mẫu công thức (Template Ribbon) */}
          <div className="bg-white p-3 shrink-0 select-none">
            {/* Tabs chuyển danh mục */}
            <div className="flex gap-1 border-b border-slate-200 pb-1.5 mb-2 overflow-x-auto custom-scrollbar">
              {TEMPLATE_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1 rounded-md text-[10px] font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* Grid các nút bấm Mẫu công thức */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
              {TEMPLATES[activeTab]?.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => insertAtCursor(item.code, true)}
                  className="p-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-400 rounded-lg text-center transition-all group flex flex-col items-center justify-center min-h-[46px] shadow-2xs cursor-pointer"
                  title={`${item.title} - Bấm để chèn`}
                >
                  <div className="text-xs text-slate-800 group-hover:text-blue-700 pointer-events-none mb-0.5">
                    <LatexText text={item.preview} />
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 group-hover:text-blue-600 uppercase tracking-tighter truncate max-w-full">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Khung chia đôi: Soạn thảo (Trái) & Xem trước trực quan (Phải) */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300 bg-white min-h-[220px]">
            
            {/* CỘT TRÁI: Ô nhập mã (Code Textarea) */}
            <div className="p-3 flex flex-col bg-white">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Mã LaTeX / HTML công thức:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditorText('')}
                    className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-0.5 cursor-pointer"
                    title="Xóa trắng nội dung"
                  >
                    <Trash2 size={11}/> Xóa
                  </button>
                  <button
                    onClick={() => setEditorText('$\\dfrac{a}{b}$')}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                    title="Mẫu ban đầu"
                  >
                    <RefreshCw size={11}/> Mẫu
                  </button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={editorText}
                onChange={e => setEditorText(e.target.value)}
                placeholder="VD: $\dfrac{a}{b}$ hoặc $x^2 + \sqrt{x} = 5$..."
                className="w-full h-36 p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all resize-none shadow-inner custom-scrollbar"
                spellCheck={false}
              />
            </div>

            {/* CỘT PHẢI: Xem trước trực quan KaTeX Live Preview */}
            <div className="p-3 flex flex-col bg-slate-50">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase text-blue-600 tracking-wider flex items-center gap-1">
                  <Sparkles size={12}/> Kết quả hiển thị (Preview):
                </label>
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  Thời gian thực
                </span>
              </div>

              <div className="h-36 p-4 bg-white border border-slate-300 rounded-xl overflow-auto custom-scrollbar flex items-center justify-center shadow-inner text-center">
                {editorText.trim() ? (
                  <div className="text-base md:text-lg text-slate-900 leading-relaxed">
                    <LatexText text={editorText} />
                  </div>
                ) : (
                  <span className="text-xs text-slate-300 italic font-bold">
                    (Chưa có nội dung công thức)
                  </span>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* 3. FOOTER CỐ ĐỊNH Ở ĐÁY (LUÔN HIỂN THỊ 100% NÚT CHÈN & COPY) */}
        <div className="bg-white border-t border-slate-300 px-4 py-3 flex items-center justify-between gap-3 shrink-0 shadow-lg z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`py-2 px-4 rounded-xl text-xs font-black uppercase transition-all border flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                isCopied 
                  ? 'bg-emerald-500 text-white border-emerald-500' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="Sao chép toàn bộ mã vào Clipboard"
            >
              {isCopied ? <Check size={14} /> : <Copy size={14} />}
              {isCopied ? 'ĐÃ COPY' : 'COPY MÃ'}
            </button>

            <button
              onClick={onClose}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>

          <button
            onClick={handleInsertToQuiz}
            className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            title="Chèn công thức này vào câu hỏi đang soạn"
          >
            <CornerDownLeft size={16} /> {onInsertCode ? 'CHÈN VÀO CÂU (INSERT)' : 'ÁP DỤNG'}
          </button>
        </div>

      </div>
    </div>
  );
}
