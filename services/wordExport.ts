/**
 * Bộ chuyển đổi công thức toán học LaTeX sang HTML định dạng chuẩn tương thích 100% với Microsoft Word
 * Giúp mở file Word lên công thức hiển thị đẹp mắt (chỉ số trên, dưới, ký hiệu toán học, chữ nghiêng, phân số)
 * KHÔNG bị lộ các thẻ XML/MathML lạ như <msub><mi>...
 */
export * from './docxExporter';


const LATEX_SYMBOLS: Record<string, string> = {
  // Hy Lạp (Thường)
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\epsilon': 'ε',
  '\\varepsilon': 'ε',
  '\\zeta': 'ζ',
  '\\eta': 'η',
  '\\theta': 'θ',
  '\\vartheta': 'ϑ',
  '\\iota': 'ι',
  '\\kappa': 'κ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\nu': 'ν',
  '\\xi': 'ξ',
  '\\pi': 'π',
  '\\rho': 'ρ',
  '\\sigma': 'σ',
  '\\tau': 'τ',
  '\\upsilon': 'υ',
  '\\phi': 'φ',
  '\\varphi': 'ϕ',
  '\\chi': 'χ',
  '\\psi': 'ψ',
  '\\omega': 'ω',

  // Hy Lạp (Hoa)
  '\\Gamma': 'Γ',
  '\\Delta': 'Δ',
  '\\Theta': 'Θ',
  '\\Lambda': 'Λ',
  '\\Xi': 'Ξ',
  '\\Pi': 'Π',
  '\\Sigma': 'Σ',
  '\\Upsilon': 'Υ',
  '\\Phi': 'Φ',
  '\\Psi': 'Ψ',
  '\\Omega': 'Ω',

  // Toán tử & Quan hệ
  '\\pm': '±',
  '\\mp': '∓',
  '\\times': '×',
  '\\div': '÷',
  '\\cdot': '·',
  '\\circ': '°',
  '\\degree': '°',
  '\\bullet': '•',
  '\\leq': '≤',
  '\\le': '≤',
  '\\geq': '≥',
  '\\ge': '≥',
  '\\neq': '≠',
  '\\ne': '≠',
  '\\approx': '≈',
  '\\sim': '∼',
  '\\equiv': '≡',
  '\\in': '∈',
  '\\notin': '∉',
  '\\subset': '⊂',
  '\\supset': '⊃',
  '\\subseteq': '⊆',
  '\\supseteq': '⊇',
  '\\cup': '∪',
  '\\cap': '∩',
  '\\forall': '∀',
  '\\exists': '∃',
  '\\infty': '∞',
  '\\partial': '∂',
  '\\nabla': '∇',
  '\\to': '→',
  '\\rightarrow': '→',
  '\\longrightarrow': '⟶',
  '\\leftarrow': '←',
  '\\longleftarrow': '⟵',
  '\\Rightarrow': '⇒',
  '\\Longrightarrow': '⟹',
  '\\Leftarrow': '⇐',
  '\\Longleftarrow': '⟸',
  '\\leftrightarrow': '↔',
  '\\longleftrightarrow': '⟷',
  '\\Leftrightarrow': '⇔',
  '\\Longleftrightarrow': '⟺',
  '\\rightleftharpoons': '⇌',
  '\\leftrightharpoons': '⇌',
  '\\mapsto': '↦',
  '\\uparrow': '↑',
  '\\downarrow': '↓',
  '\\updownarrow': '↕',
  '\\Uparrow': '⇑',
  '\\Downarrow': '⇓',
  '\\Updownarrow': '⇕',
  '\\upuparrows': '⇈',
  '\\downdownarrows': '⇊',
  '\\nearrow': '↗',
  '\\searrow': '↘',
  '\\swarrow': '↙',
  '\\nwarrow': '↖',
  '\\perp': '⊥',
  '\\parallel': '∥',
  '\\angle': '∠',
  '\\triangle': '△',

  // Khoảng trắng
  '\\,': '&nbsp;',
  '\\;': '&nbsp;&nbsp;',
  '\\quad': '&nbsp;&nbsp;&nbsp;',
  '\\qquad': '&nbsp;&nbsp;&nbsp;&nbsp;',
  '\\!': ''
};

/**
 * Chuyển đổi mã LaTeX thành HTML sạch (dùng sub, sup, ký hiệu Unicode, chữ nghiêng)
 * Microsoft Word mở file HTML này sẽ hiển thị chuẩn đẹp 100%, không bị vỡ font hay lộ code.
 */
export function latexToWordHtml(latex: string): string {
  if (!latex) return '';

  let clean = latex
    .replace(/^(\$\$|\$)/, '')
    .replace(/(\$\$|\$)$/, '')
    .trim();

  // Xóa các lệnh font
  clean = clean.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  clean = clean.replace(/\\text\{([^}]+)\}/g, '$1');
  clean = clean.replace(/\\textbf\{([^}]+)\}/g, '<b>$1</b>');
  clean = clean.replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>');
  clean = clean.replace(/\\textit\{([^}]+)\}/g, '<i>$1</i>');
  clean = clean.replace(/\\mathit\{([^}]+)\}/g, '<i>$1</i>');

  // Xử lý Hóa học \ce{...}
  clean = clean.replace(/\\ce\{([^}]+)\}/g, '$1');

  // Bar / Overline \bar{A}, \overline{AB} -> <span style="text-decoration:overline">...</span>
  clean = clean.replace(/\\bar\{([^{}]+)\}/g, '<span style="text-decoration:overline">$1</span>');
  clean = clean.replace(/\\overline\{([^{}]+)\}/g, '<span style="text-decoration:overline">$1</span>');
  clean = clean.replace(/\\bar\s+([a-zA-Z0-9])/g, '<span style="text-decoration:overline">$1</span>');
  clean = clean.replace(/\\hat\{([^{}]+)\}/g, (_, inner) => inner.split('').map((c: string) => `${c}&#770;`).join(''));
  clean = clean.replace(/\\tilde\{([^{}]+)\}/g, (_, inner) => inner.split('').map((c: string) => `${c}&#771;`).join(''));
  clean = clean.replace(/\\dot\{([^{}]+)\}/g, (_, inner) => inner.split('').map((c: string) => `${c}&#775;`).join(''));
  clean = clean.replace(/\\ddot\{([^{}]+)\}/g, (_, inner) => inner.split('').map((c: string) => `${c}&#776;`).join(''));

  // Ký hiệu tập hợp số
  clean = clean.replace(/\\mathbb\{R\}/g, 'ℝ');
  clean = clean.replace(/\\mathbb\{Z\}/g, 'ℤ');
  clean = clean.replace(/\\mathbb\{N\}/g, 'ℕ');
  clean = clean.replace(/\\mathbb\{Q\}/g, 'ℚ');
  clean = clean.replace(/\\mathbb\{C\}/g, 'ℂ');

  // Vector \vec{v} -> v&#8407;
  clean = clean.replace(/\\vec\{([^}]+)\}/g, '<i>$1&#8407;</i>');
  clean = clean.replace(/\\overrightarrow\{([^}]+)\}/g, '<i>$1&#8407;</i>');

  // Góc \widehat{AOB}
  clean = clean.replace(/\\widehat\{([^}]+)\}/g, '∠$1');

  // Ký hiệu độ: ^\circ hoặc ^{\circ}
  clean = clean.replace(/\^\{\\circ\}/g, '°');
  clean = clean.replace(/\^\\circ/g, '°');

  // Mũi tên vật lý cùng chiều / ngược chiều
  clean = clean
    .replace(/\\uparrow\s*\\uparrow/g, '↑↑')
    .replace(/\\uparrow\s*\\downarrow/g, '↑↓')
    .replace(/\\downarrow\s*\\uparrow/g, '↓↑')
    .replace(/\\downarrow\s*\\downarrow/g, '↓↓');

  // Phân số: \frac{A}{B} -> (A)/(B) hoặc trình bày đẹp dạng <sup>A</sup>/<sub>B</sub>
  let fracRegex = /\\frac\{([^{}]+)\}\{([^{}]+)\}/;
  let loopCount = 0;
  while (fracRegex.test(clean) && loopCount < 5) {
    clean = clean.replace(fracRegex, (_, num, den) => {
      return `(${num})/(${den})`;
    });
    loopCount++;
  }

  // Căn bậc hai \sqrt{x} -> √(x), \sqrt[n]{x} -> <sup>n</sup>√(x)
  clean = clean.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '<sup>$1</sup>√($2)');
  clean = clean.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // Ký hiệu toán học từ từ điển: Khớp toàn bộ macro chữ cái để tránh đè tiền tố (\\le vs \\leftrightarrow)
  clean = clean.replace(/\\[a-zA-Z]+/g, (match) => {
    return LATEX_SYMBOLS[match] !== undefined ? LATEX_SYMBOLS[match] : match;
  });

  // Xử lý ngoặc
  clean = clean.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  clean = clean.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
  clean = clean.replace(/\\left\\\{/g, '{').replace(/\\right\\\}/g, '}');
  clean = clean.replace(/\\left\|/g, '|').replace(/\\right\|/g, '|');

  // Xử lý cả chỉ số trên & dưới: X_{sub}^{sup} hoặc X^{sup}_{sub}
  clean = clean.replace(/_\{([^}]+)\}\^\{([^}]+)\}/g, '<sub>$1</sub><sup>$2</sup>');
  clean = clean.replace(/\^\{([^}]+)\}_\{([^}]+)\}/g, '<sup>$1</sup><sub>$2</sub>');
  clean = clean.replace(/_([a-zA-Z0-9])\^([a-zA-Z0-9])/g, '<sub>$1</sub><sup>$2</sup>');
  clean = clean.replace(/\^([a-zA-Z0-9])_([a-zA-Z0-9])/g, '<sup>$1</sup><sub>$2</sub>');

  // Xử lý chỉ số dưới: _{mst} -> <sub>mst</sub> hoặc _0 -> <sub>0</sub>
  clean = clean.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  clean = clean.replace(/_([a-zA-Z0-9\+\-]+)/g, '<sub>$1</sub>');

  // Xử lý chỉ số trên (số mũ): ^{2} -> <sup>2</sup> hoặc ^2 -> <sup>2</sup>
  clean = clean.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  clean = clean.replace(/\^([a-zA-Z0-9\+\-]+)/g, '<sup>$1</sup>');

  // Xóa các dấu gạch chéo còn sót lại
  clean = clean.replace(/\\([a-zA-Z]+)/g, '$1');

  return `<span style="font-family:'Times New Roman', 'Cambria Math', serif; font-style:italic;">${clean}</span>`;
}

/**
 * Chuyển đổi chuỗi văn bản chứa $...$ sang HTML có hỗ trợ hiển thị đẹp trong Word hoặc MathType TeX
 */
export function convertLatexForWordExport(htmlContent: string, mode: 'equation' | 'mathtype' = 'equation'): string {
  if (!htmlContent) return '';

  const div = document.createElement('div');
  div.innerHTML = htmlContent;

  const latexNodes = div.querySelectorAll('[data-latex]');
  latexNodes.forEach(node => {
    const rawLatex = node.getAttribute('data-latex') || '';
    if (!rawLatex) return;

    if (mode === 'equation') {
      // Chế độ Tự động: Chuyển sang HTML chuẩn có <sub>, <sup>, ký hiệu Unicode
      const formattedHtml = latexToWordHtml(rawLatex);
      const span = document.createElement('span');
      span.innerHTML = formattedHtml;
      node.parentNode?.replaceChild(span, node);
    } else {
      // Chế độ MathType: Chèn $...$ nguyên bản để dùng Alt + \ (Toggle TeX)
      const textNode = document.createTextNode(`$${rawLatex}$`);
      node.parentNode?.replaceChild(textNode, node);
    }
  });

  return div.innerHTML;
}
