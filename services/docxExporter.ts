import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageBreak,
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathRadical,
  MathSubScript,
  MathSuperScript,
  MathSubSuperScript,
  MathComponent,
  ImageRun,
  XmlComponent,
  BuilderElement,
  createMathAccentCharacter,
  createMathBase,
} from 'docx';
import { Quiz, Question } from '../types';
import { normalizeFullText, repairVietnameseText } from './vietnameseFixer';

/**
 * Native Word Equation Accent Component (m:acc)
 * Dùng cho \bar{A}, \vec{v}, \hat{A}, \tilde{x}, \dot{x}, \ddot{x}
 * Hiển thị thanh gạch / mũi tên / dấu mũ chuẩn Word, thanh thoát và không dính/cắt vào chữ
 */
export class MathAccent extends XmlComponent {
  constructor(options: { children: MathComponent[]; accentChar?: string }) {
    super('m:acc');
    this.root.push(
      new BuilderElement({
        name: 'm:accPr',
        children: [
          createMathAccentCharacter({ accent: options.accentChar || '\u0302' }),
        ],
      })
    );
    this.root.push(createMathBase({ children: options.children }));
  }
}

/**
 * Native Word Equation Bar Component (m:bar)
 * Dùng cho \overline{AB} vạch ngang trên đầu đoạn thẳng hoặc biểu thức
 */
export class MathBar extends XmlComponent {
  constructor(options: { children: MathComponent[]; position?: 'top' | 'bot' }) {
    super('m:bar');
    this.root.push(
      new BuilderElement({
        name: 'm:barPr',
        children: [
          new BuilderElement({
            name: 'm:pos',
            attributes: { pos: { key: 'm:val', value: options.position || 'top' } },
          }),
        ],
      })
    );
    this.root.push(createMathBase({ children: options.children }));
  }
}

export const GREEK_AND_MATH_SYMBOLS: Record<string, string> = {
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
  '\\simeq': '≃',
  '\\cong': '≅',
  '\\equiv': '≡',
  '\\propto': '∝',
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
  '\\,': ' ',
  '\\;': '  ',
  '\\quad': '   ',
  '\\qquad': '    ',
  '\\!': '',
};

/**
 * Thay thế an toàn các macro LaTeX thành ký hiệu Unicode,
 * tránh triệt để lỗi tiền tố (ví dụ \\le làm hỏng \\leftrightarrow hay \\in làm hỏng \\infty).
 */
export function replaceLatexMacros(str: string): string {
  if (!str) return '';
  let s = str
    .replace(/\\uparrow\s*\\uparrow/g, '↑↑')
    .replace(/\\uparrow\s*\\downarrow/g, '↑↓')
    .replace(/\\downarrow\s*\\uparrow/g, '↓↑')
    .replace(/\\downarrow\s*\\downarrow/g, '↓↓');

  // Xử lý các lệnh dấu cách và ký tự đơn
  s = s
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, '  ')
    .replace(/\\!/g, '')
    .replace(/\\quad/g, '   ')
    .replace(/\\qquad/g, '    ');

  // Khớp chính xác tên lệnh chữ cái đầy đủ (\\alpha, \\leftrightarrow, \\le...)
  return s.replace(/\\[a-zA-Z]+/g, (match) => {
    return GREEK_AND_MATH_SYMBOLS[match] !== undefined ? GREEK_AND_MATH_SYMBOLS[match] : match;
  });
}

function extractBraced(str: string, startIndex: number): { content: string; nextIndex: number } | null {
  if (str[startIndex] !== '{') return null;
  let depth = 0;
  let content = '';
  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    if (char === '{') {
      depth++;
      if (depth > 1) content += char;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return { content, nextIndex: i + 1 };
      } else {
        content += char;
      }
    } else {
      content += char;
    }
  }
  return null;
}

function extractBracketed(str: string, startIndex: number): { content: string; nextIndex: number } | null {
  if (str[startIndex] !== '[') return null;
  let depth = 0;
  let content = '';
  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    if (char === '[') {
      depth++;
      if (depth > 1) content += char;
    } else if (char === ']') {
      depth--;
      if (depth === 0) {
        return { content, nextIndex: i + 1 };
      } else {
        content += char;
      }
    } else {
      content += char;
    }
  }
  return null;
}

/**
 * Trích xuất token cho chỉ số trên / dưới (hỗ trợ {...}, \macro như \alpha, \circ, hoặc ký tự đơn)
 */
function extractScriptToken(str: string, pos: number): { content: string; nextIndex: number } | null {
  if (pos >= str.length) return null;
  if (str[pos] === '{') {
    return extractBraced(str, pos);
  }
  if (str[pos] === '\\') {
    const match = str.slice(pos).match(/^\\[a-zA-Z]+/);
    if (match) {
      return {
        content: match[0],
        nextIndex: pos + match[0].length,
      };
    }
    return {
      content: str.slice(pos, pos + 2),
      nextIndex: pos + 2,
    };
  }
  return {
    content: str[pos],
    nextIndex: pos + 1,
  };
}

/**
 * Tải ảnh từ URL hoặc giải mã Base64 sang Uint8Array kèm kích thước căn chỉnh trang in Word
 */
async function fetchImageBufferAndDimensions(
  url?: string
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;

  try {
    let uint8Array: Uint8Array;
    const cleanUrl = url.trim();

    if (cleanUrl.startsWith('data:')) {
      const base64 = cleanUrl.includes(',') ? cleanUrl.split(',')[1] : cleanUrl;
      const binaryString = atob(base64);
      const len = binaryString.length;
      uint8Array = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
    } else {
      const response = await fetch(cleanUrl);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      uint8Array = new Uint8Array(arrayBuffer);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || 360;
        let h = img.naturalHeight || 200;
        const maxWidth = 450;
        const maxHeight = 300;
        if (w > maxWidth) {
          h = (h * maxWidth) / w;
          w = maxWidth;
        }
        if (h > maxHeight) {
          w = (w * maxHeight) / h;
          h = maxHeight;
        }
        resolve({ data: uint8Array, width: Math.round(w), height: Math.round(h) });
      };
      img.onerror = () => {
        resolve({ data: uint8Array, width: 360, height: 200 });
      };
      img.src = cleanUrl;
    });
  } catch (err) {
    console.warn('Lỗi khi tải hình ảnh cho Word export:', url, err);
    return null;
  }
}

/**
 * Phân tích cú pháp chuỗi LaTeX sang các thành phần Word Math OMML Component
 */
export function parseLatexToDocxMath(latex: string): MathComponent[] {
  let clean = latex.trim();
  if (clean.startsWith('$$') && clean.endsWith('$$')) {
    clean = clean.slice(2, -2).trim();
  } else if (clean.startsWith('$') && clean.endsWith('$')) {
    clean = clean.slice(1, -1).trim();
  }

  // Tiền xử lý độ / góc / nhiệt độ: 6^\circ, 30^\circ, 6^{\circ}, 6^\circ\text{C}, 6^\circ C -> 6° / 6°C
  clean = clean.replace(/\^\{\\circ\}/g, '°');
  clean = clean.replace(/\^\\circ/g, '°');
  clean = clean.replace(/\^\{\\degree\}/g, '°');
  clean = clean.replace(/\^\\degree/g, '°');
  clean = clean.replace(/\^\{\\prime\}/g, '′');
  clean = clean.replace(/\^\\prime/g, '′');
  clean = clean.replace(/\\prime/g, '′');

  // Tiền xử lý font & text
  clean = clean.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  clean = clean.replace(/\\text\{([^}]+)\}/g, '$1');
  clean = clean.replace(/\\mathbf\{([^}]+)\}/g, '$1');
  clean = clean.replace(/\\ce\{([^}]+)\}/g, '$1');

  const components: MathComponent[] = [];
  let i = 0;
  let textBuffer = '';

  const flushText = () => {
    if (textBuffer.length > 0) {
      const txt = replaceLatexMacros(textBuffer);
      if (txt) {
        components.push(new MathRun(txt));
      }
      textBuffer = '';
    }
  };

  while (i < clean.length) {
    // 1. Phân số \frac{num}{den}
    if (clean.startsWith('\\frac', i)) {
      flushText();
      let pos = i + 5;
      while (pos < clean.length && clean[pos] === ' ') pos++;
      const numRes = extractBraced(clean, pos);
      if (numRes) {
        pos = numRes.nextIndex;
        while (pos < clean.length && clean[pos] === ' ') pos++;
        const denRes = extractBraced(clean, pos);
        if (denRes) {
          components.push(
            new MathFraction({
              numerator: parseLatexToDocxMath(numRes.content),
              denominator: parseLatexToDocxMath(denRes.content),
            })
          );
          i = denRes.nextIndex;
          continue;
        }
      }
    }

    // 2. Căn bậc hai & căn bậc n: \sqrt{x} hoặc \sqrt[n]{x}
    if (clean.startsWith('\\sqrt', i)) {
      flushText();
      let pos = i + 5;
      while (pos < clean.length && clean[pos] === ' ') pos++;
      let degRes = null;
      if (clean[pos] === '[') {
        degRes = extractBracketed(clean, pos);
        if (degRes) {
          pos = degRes.nextIndex;
          while (pos < clean.length && clean[pos] === ' ') pos++;
        }
      }
      const radRes = extractBraced(clean, pos);
      if (radRes) {
        if (degRes) {
          components.push(
            new MathRadical({
              children: parseLatexToDocxMath(radRes.content),
              degree: parseLatexToDocxMath(degRes.content),
            })
          );
        } else {
          components.push(
            new MathRadical({
              children: parseLatexToDocxMath(radRes.content),
            })
          );
        }
        i = radRes.nextIndex;
        continue;
      }
    }

    // 3. Word Native Math Accents: \bar, \overline, \vec, \hat, \tilde, \dot, \ddot
    if (clean.startsWith('\\bar', i) || clean.startsWith('\\overline', i)) {
      flushText();
      const isOverline = clean.startsWith('\\overline', i);
      let pos = i + (isOverline ? 9 : 4);
      while (pos < clean.length && clean[pos] === ' ') pos++;
      if (pos < clean.length && clean[pos] === '{') {
        const res = extractBraced(clean, pos);
        if (res) {
          components.push(
            new MathBar({
              children: parseLatexToDocxMath(res.content),
              position: 'top',
            })
          );
          i = res.nextIndex;
          continue;
        }
      } else if (pos < clean.length && /[a-zA-Z0-9]/.test(clean[pos])) {
        components.push(
          new MathBar({
            children: [new MathRun(clean[pos])],
            position: 'top',
          })
        );
        i = pos + 1;
        continue;
      }
    }

    if (clean.startsWith('\\vec', i) || clean.startsWith('\\overrightarrow', i)) {
      flushText();
      const isOver = clean.startsWith('\\overrightarrow', i);
      let pos = i + (isOver ? 16 : 4);
      while (pos < clean.length && clean[pos] === ' ') pos++;
      if (pos < clean.length && clean[pos] === '{') {
        const res = extractBraced(clean, pos);
        if (res) {
          components.push(
            new MathAccent({
              accentChar: '\u20D7',
              children: parseLatexToDocxMath(res.content),
            })
          );
          i = res.nextIndex;
          continue;
        }
      } else if (pos < clean.length && /[a-zA-Z0-9]/.test(clean[pos])) {
        components.push(
          new MathAccent({
            accentChar: '\u20D7',
            children: [new MathRun(clean[pos])],
          })
        );
        i = pos + 1;
        continue;
      }
    }

    if (clean.startsWith('\\hat', i) || clean.startsWith('\\widehat', i)) {
      flushText();
      const isWide = clean.startsWith('\\widehat', i);
      let pos = i + (isWide ? 8 : 4);
      while (pos < clean.length && clean[pos] === ' ') pos++;
      if (pos < clean.length && clean[pos] === '{') {
        const res = extractBraced(clean, pos);
        if (res) {
          components.push(
            new MathAccent({
              accentChar: '\u0302',
              children: parseLatexToDocxMath(res.content),
            })
          );
          i = res.nextIndex;
          continue;
        }
      } else if (pos < clean.length && /[a-zA-Z0-9]/.test(clean[pos])) {
        components.push(
          new MathAccent({
            accentChar: '\u0302',
            children: [new MathRun(clean[pos])],
          })
        );
        i = pos + 1;
        continue;
      }
    }

    if (clean.startsWith('\\tilde', i) || clean.startsWith('\\widetilde', i)) {
      flushText();
      const isWide = clean.startsWith('\\widetilde', i);
      let pos = i + (isWide ? 10 : 6);
      while (pos < clean.length && clean[pos] === ' ') pos++;
      if (pos < clean.length && clean[pos] === '{') {
        const res = extractBraced(clean, pos);
        if (res) {
          components.push(
            new MathAccent({
              accentChar: '\u0303',
              children: parseLatexToDocxMath(res.content),
            })
          );
          i = res.nextIndex;
          continue;
        }
      } else if (pos < clean.length && /[a-zA-Z0-9]/.test(clean[pos])) {
        components.push(
          new MathAccent({
            accentChar: '\u0303',
            children: [new MathRun(clean[pos])],
          })
        );
        i = pos + 1;
        continue;
      }
    }

    if (clean.startsWith('\\dot', i) && !clean.startsWith('\\dots', i)) {
      flushText();
      let pos = i + 4;
      while (pos < clean.length && clean[pos] === ' ') pos++;
      if (pos < clean.length && clean[pos] === '{') {
        const res = extractBraced(clean, pos);
        if (res) {
          components.push(
            new MathAccent({
              accentChar: '\u0307',
              children: parseLatexToDocxMath(res.content),
            })
          );
          i = res.nextIndex;
          continue;
        }
      } else if (pos < clean.length && /[a-zA-Z0-9]/.test(clean[pos])) {
        components.push(
          new MathAccent({
            accentChar: '\u0307',
            children: [new MathRun(clean[pos])],
          })
        );
        i = pos + 1;
        continue;
      }
    }

    if (clean.startsWith('\\ddot', i)) {
      flushText();
      let pos = i + 5;
      while (pos < clean.length && clean[pos] === ' ') pos++;
      if (pos < clean.length && clean[pos] === '{') {
        const res = extractBraced(clean, pos);
        if (res) {
          components.push(
            new MathAccent({
              accentChar: '\u0308',
              children: parseLatexToDocxMath(res.content),
            })
          );
          i = res.nextIndex;
          continue;
        }
      } else if (pos < clean.length && /[a-zA-Z0-9]/.test(clean[pos])) {
        components.push(
          new MathAccent({
            accentChar: '\u0308',
            children: [new MathRun(clean[pos])],
          })
        );
        i = pos + 1;
        continue;
      }
    }

    // 3. Chỉ số dưới & trên: x_{sub}^{sup} hoặc x^{sup}_{sub} hoặc x_sub hoặc x^sup
    if (clean[i] === '_' || clean[i] === '^') {
      const isSub = clean[i] === '_';
      let pos = i + 1;
      const firstToken = extractScriptToken(clean, pos);
      if (!firstToken) {
        textBuffer += clean[i];
        i++;
        continue;
      }
      const firstContent = firstToken.content;
      const nextPos = firstToken.nextIndex;

      // Kiểm tra xem có tiếp tục script thứ 2 không (vd _sub^sup hoặc ^sup_sub)
      let secondIsSub: boolean | null = null;
      let secondContent = '';
      let finalPos = nextPos;

      if (finalPos < clean.length && (clean[finalPos] === '_' || clean[finalPos] === '^')) {
        secondIsSub = clean[finalPos] === '_';
        if (secondIsSub !== isSub) {
          const secondToken = extractScriptToken(clean, finalPos + 1);
          if (secondToken) {
            secondContent = secondToken.content;
            finalPos = secondToken.nextIndex;
          }
        }
      }

      // Lấy ký tự gốc (base)
      let baseComponents: MathComponent[] = [];
      if (textBuffer.length > 0) {
        const numMatch = textBuffer.match(/\d+$/);
        if (numMatch) {
          const numStr = numMatch[0];
          textBuffer = textBuffer.slice(0, -numStr.length);
          flushText();
          baseComponents = [new MathRun(numStr)];
        } else {
          const lastChar = textBuffer[textBuffer.length - 1];
          textBuffer = textBuffer.slice(0, -1);
          flushText();
          baseComponents = [new MathRun(lastChar)];
        }
      } else if (components.length > 0) {
        const lastComp = components.pop()!;
        baseComponents = [lastComp];
      } else {
        baseComponents = [new MathRun('')];
      }

      if (secondContent) {
        const sub = isSub ? firstContent : secondContent;
        const sup = isSub ? secondContent : firstContent;
        components.push(
          new MathSubSuperScript({
            children: baseComponents,
            subScript: parseLatexToDocxMath(sub),
            superScript: parseLatexToDocxMath(sup),
          })
        );
      } else if (isSub) {
        components.push(
          new MathSubScript({
            children: baseComponents,
            subScript: parseLatexToDocxMath(firstContent),
          })
        );
      } else {
        components.push(
          new MathSuperScript({
            children: baseComponents,
            superScript: parseLatexToDocxMath(firstContent),
          })
        );
      }

      i = finalPos;
      continue;
    }

    // 4. Ký hiệu đặc biệt như dấu mũi tên vật lý, dấu ngoặc, macro LaTeX
    if (clean[i] === '\\') {
      // 4.1. Cặp mũi tên cùng chiều, ngược chiều vật lý
      if (clean.startsWith('\\uparrow\\uparrow', i) || clean.startsWith('\\uparrow \\uparrow', i)) {
        textBuffer += '↑↑';
        i += clean.startsWith('\\uparrow\\uparrow', i) ? 16 : 17;
        continue;
      }
      if (clean.startsWith('\\uparrow\\downarrow', i) || clean.startsWith('\\uparrow \\downarrow', i)) {
        textBuffer += '↑↓';
        i += clean.startsWith('\\uparrow\\downarrow', i) ? 18 : 19;
        continue;
      }
      if (clean.startsWith('\\downarrow\\uparrow', i) || clean.startsWith('\\downarrow \\uparrow', i)) {
        textBuffer += '↓↑';
        i += clean.startsWith('\\downarrow\\uparrow', i) ? 18 : 19;
        continue;
      }
      if (clean.startsWith('\\downarrow\\downarrow', i) || clean.startsWith('\\downarrow \\downarrow', i)) {
        textBuffer += '↓↓';
        i += clean.startsWith('\\downarrow\\downarrow', i) ? 20 : 21;
        continue;
      }

      // 4.2. Dấu ngoặc co giãn \left, \right
      if (clean.startsWith('\\left(', i)) {
        textBuffer += '(';
        i += 6;
        continue;
      }
      if (clean.startsWith('\\right)', i)) {
        textBuffer += ')';
        i += 7;
        continue;
      }
      if (clean.startsWith('\\left[', i)) {
        textBuffer += '[';
        i += 6;
        continue;
      }
      if (clean.startsWith('\\right]', i)) {
        textBuffer += ']';
        i += 7;
        continue;
      }
      if (clean.startsWith('\\left\\{', i) || clean.startsWith('\\left{', i)) {
        textBuffer += '{';
        i += clean.startsWith('\\left\\{', i) ? 7 : 6;
        continue;
      }
      if (clean.startsWith('\\right\\}', i) || clean.startsWith('\\right}', i)) {
        textBuffer += '}';
        i += clean.startsWith('\\right\\}', i) ? 8 : 7;
        continue;
      }
      if (clean.startsWith('\\left|', i)) {
        textBuffer += '|';
        i += 6;
        continue;
      }
      if (clean.startsWith('\\right|', i)) {
        textBuffer += '|';
        i += 7;
        continue;
      }

      // 4.3. Các lệnh khoảng trắng / ký tự đơn
      if (clean.startsWith('\\,', i)) {
        textBuffer += ' ';
        i += 2;
        continue;
      }
      if (clean.startsWith('\\;', i)) {
        textBuffer += '  ';
        i += 2;
        continue;
      }
      if (clean.startsWith('\\!', i)) {
        i += 2;
        continue;
      }
      if (clean.startsWith('\\quad', i)) {
        textBuffer += '   ';
        i += 5;
        continue;
      }
      if (clean.startsWith('\\qquad', i)) {
        textBuffer += '    ';
        i += 6;
        continue;
      }

      // 4.4. Khớp chính xác tên lệnh macro chữ cái đầy đủ (\alpha, \leftrightarrow, \le, \infty...)
      const macroMatch = clean.slice(i).match(/^\\[a-zA-Z]+/);
      if (macroMatch) {
        const macro = macroMatch[0];
        if (GREEK_AND_MATH_SYMBOLS[macro] !== undefined) {
          textBuffer += GREEK_AND_MATH_SYMBOLS[macro];
          i += macro.length;
          continue;
        }
      }
    }

    textBuffer += clean[i];
    i++;
  }

  flushText();
  return components.length > 0 ? components : [new MathRun(clean)];
}

/**
 * Phân tách đoạn văn bản thông thường chứa $...$ thành chuỗi các TextRun và Math (Word Native Equation)
 */
export function parseTextWithMath(
  text: string,
  options?: { bold?: boolean; italics?: boolean; size?: number; color?: string; underline?: boolean }
): (TextRun | DocxMath)[] {
  if (!text) return [];

  const repaired = repairVietnameseText(text);
  const parts = repaired.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  const runs: (TextRun | DocxMath)[] = [];

  for (const part of parts) {
    if (!part) continue;

    if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('$') && part.endsWith('$'))) {
      const mathComponents = parseLatexToDocxMath(part);
      runs.push(
        new DocxMath({
          children: mathComponents,
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          font: 'Times New Roman',
          size: options?.size || 23, // 11.5pt
          bold: options?.bold || false,
          italics: options?.italics || false,
          color: options?.color || '000000',
          underline: options?.underline ? {} : undefined,
        })
      );
    }
  }

  return runs;
}

/**
 * Tạo tài liệu Word chuẩn (.docx) với toàn bộ công thức là Microsoft Word Native Equation (OMML)
 * Bố trí định dạng chuẩn giống hệt xuất file .doc:
 * 1. Tiêu đề đề thi chuẩn 2 cột (Sở GDĐT, Trường THPT / Đề thi chính thức, Môn, Khối)
 * 2. Khung Họ tên và SBD
 * 3. Tên đề thi in hoa đậm ở giữa
 * 4. Nội dung các câu hỏi đề thi (kèm hình ảnh, công thức, lời dẫn; phương án A, B, C, D KHÔNG lộ màu đáp án)
 * 5. Dòng kết: ---------- HẾT ----------
 * 6. BẢNG ĐÁP ÁN ở phía dưới cuối đề (ngắt trang chuẩn, gồm các bảng Phần I, Phần II, Phần III)
 */
export async function generateNativeWordDocx(
  quiz: Quiz,
  includeAnswers: boolean = true,
  layoutMode: 'single' | 'auto' = 'single'
): Promise<Blob> {
  const contentElements: (Paragraph | Table)[] = [];

  const borderSingle = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const borderNone = { style: BorderStyle.NONE, size: 0, color: 'auto' };

  const tableBorders = {
    top: borderSingle,
    bottom: borderSingle,
    left: borderSingle,
    right: borderSingle,
    insideHorizontal: borderSingle,
    insideVertical: borderSingle,
  };

  const noBorders = {
    top: borderNone,
    bottom: borderNone,
    left: borderNone,
    right: borderNone,
    insideHorizontal: borderNone,
    insideVertical: borderNone,
  };

  // 1. HEADER 2 CỘT (Sở GD&ĐT / Trường & Đề thi chính thức / Môn học)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: 'SỞ GDĐT TP. HỒ CHÍ MINH',
                    font: 'Times New Roman',
                    bold: true,
                    size: 22,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: 'TRƯỜNG THPT NGUYỄN HỮU CẦU',
                    font: 'Times New Roman',
                    bold: true,
                    size: 22,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: 'ĐỀ THI CHÍNH THỨC',
                    font: 'Times New Roman',
                    bold: true,
                    size: 23,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: `Môn: ${quiz.category || 'Vật lý'} - Khối ${quiz.grade !== 'all' ? quiz.grade : '12'}`,
                    font: 'Times New Roman',
                    bold: true,
                    size: 22,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  contentElements.push(headerTable);

  // 2. KHUNG HỌ VÀ TÊN & SBD
  const nameBoxTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: borderSingle,
      bottom: borderSingle,
      left: borderSingle,
      right: borderSingle,
      insideHorizontal: borderNone,
      insideVertical: borderNone,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Họ và tên: .......................................................................... SBD: .....................................',
                    font: 'Times New Roman',
                    bold: true,
                    size: 21,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  contentElements.push(nameBoxTable);

  // 3. TÊN ĐỀ THI (In hoa, ở giữa)
  contentElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 160 },
      children: [
        new TextRun({
          text: normalizeFullText(quiz.title || 'ĐỀ THI TRẮC NGHIỆM').toUpperCase(),
          font: 'Times New Roman',
          size: 28, // 14pt
          bold: true,
        }),
      ],
    })
  );

  const mcqQs = quiz.questions.filter((q) => q.type === 'mcq');
  const groupTfQs = quiz.questions.filter((q) => q.type === 'group-tf');
  const shortQs = quiz.questions.filter((q) => q.type === 'short');

  const getLevelColor = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'B': return '047857';
      case 'H': return '1d4ed8';
      case 'VD': return 'b45309';
      case 'VDC': return 'b91c1c';
      default: return '1d4ed8';
    }
  };

  // PHẦN 1: CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN
  if (mcqQs.length > 0) {
    contentElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN',
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
        ],
        spacing: { before: 200, after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Thí sinh trả lời từ câu 1 đến câu ${mcqQs.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.`,
            font: 'Times New Roman',
            size: 21,
            italics: true,
          }),
        ],
        spacing: { after: 120 },
      })
    );

    for (let idx = 0; idx < mcqQs.length; idx++) {
      const q = mcqQs[idx];
      const qIndex = idx + 1;
      const levelTag = q.level ? `[${q.level.toUpperCase()}] ` : '';

      // Lời dẫn / dữ liệu dùng chung nếu có
      if (q.context) {
        contentElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Lời dẫn / Dữ liệu dùng chung: ',
                font: 'Times New Roman',
                size: 22,
                bold: true,
                color: '854d0e',
              }),
              ...parseTextWithMath(q.context, { size: 22, italics: true }),
            ],
            indent: { left: 180 },
            spacing: { before: 80, after: 60 },
          })
        );
      }

      const questionRuns = [
        new TextRun({
          text: `Câu ${qIndex}: `,
          font: 'Times New Roman',
          size: 23,
          bold: true,
          underline: {},
        }),
        ...(levelTag
          ? [
              new TextRun({
                text: levelTag,
                font: 'Times New Roman',
                size: 22,
                bold: true,
                color: getLevelColor(q.level),
              }),
            ]
          : []),
        ...parseTextWithMath(q.text, { size: 23 }),
      ];

      contentElements.push(
        new Paragraph({
          children: questionRuns,
          spacing: { before: 100, after: 40 },
        })
      );

      // Chèn hình ảnh câu hỏi nếu có
      if (q.imageUrl) {
        const imgObj = await fetchImageBufferAndDimensions(q.imageUrl);
        if (imgObj) {
          contentElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: imgObj.data,
                  transformation: {
                    width: imgObj.width,
                    height: imgObj.height,
                  },
                }),
              ],
              spacing: { before: 60, after: 80 },
            })
          );
        }
      }

      // 4 Lựa chọn phương án
      if (q.options && q.options.length > 0) {
        const options = q.options;
        const maxLen = Math.max(...options.map((o) => (o || '').length));
        const totalLen = options.reduce((sum, o) => sum + (o || '').length, 0);

        if (layoutMode === 'auto' && options.length === 4 && maxLen <= 20 && totalLen <= 75) {
          // Dàn 4 phương án trên 1 hàng (bảng không viền)
          const cells = options.map((optText, optIdx) => {
            const optKey = String.fromCharCode(65 + optIdx);
            return new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              margins: { top: 20, bottom: 20, left: 40, right: 40 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${optKey}. `,
                      font: 'Times New Roman',
                      size: 23,
                      bold: true,
                    }),
                    ...parseTextWithMath(optText, { size: 23 }),
                  ],
                }),
              ],
            });
          });

          contentElements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: noBorders,
              rows: [new TableRow({ children: cells })],
            })
          );
        } else if (layoutMode === 'auto' && options.length === 4 && maxLen <= 45) {
          // Dàn 2 hàng, mỗi hàng 2 phương án (A-B và C-D)
          const row1Cells = [0, 1].map((optIdx) => {
            const optKey = String.fromCharCode(65 + optIdx);
            return new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 20, bottom: 20, left: 40, right: 40 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${optKey}. `,
                      font: 'Times New Roman',
                      size: 23,
                      bold: true,
                    }),
                    ...parseTextWithMath(options[optIdx], { size: 23 }),
                  ],
                }),
              ],
            });
          });

          const row2Cells = [2, 3].map((optIdx) => {
            const optKey = String.fromCharCode(65 + optIdx);
            return new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 20, bottom: 20, left: 40, right: 40 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${optKey}. `,
                      font: 'Times New Roman',
                      size: 23,
                      bold: true,
                    }),
                    ...parseTextWithMath(options[optIdx], { size: 23 }),
                  ],
                }),
              ],
            });
          });

          contentElements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: noBorders,
              rows: [new TableRow({ children: row1Cells }), new TableRow({ children: row2Cells })],
            })
          );
        } else {
          // Mặc định: Mỗi phương án 1 dòng thẳng hàng
          options.forEach((optText, optIdx) => {
            const optKey = String.fromCharCode(65 + optIdx);
            contentElements.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${optKey}. `,
                    font: 'Times New Roman',
                    size: 23,
                    bold: true,
                  }),
                  ...parseTextWithMath(optText, { size: 23 }),
                ],
                indent: { left: 360 },
                spacing: { before: 25, after: 25 },
              })
            );
          });
        }
      }
    }
  }

  // PHẦN 2: CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI
  if (groupTfQs.length > 0) {
    contentElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI',
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
        ],
        spacing: { before: 240, after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Thí sinh trả lời từ câu 1 đến câu ${groupTfQs.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`,
            font: 'Times New Roman',
            size: 21,
            italics: true,
          }),
        ],
        spacing: { after: 120 },
      })
    );

    for (let idx = 0; idx < groupTfQs.length; idx++) {
      const q = groupTfQs[idx];
      const qIndex = idx + 1;
      const levelTag = q.level ? `[${q.level.toUpperCase()}] ` : '';

      if (q.context) {
        contentElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Lời dẫn / Dữ liệu dùng chung: ',
                font: 'Times New Roman',
                size: 22,
                bold: true,
                color: '854d0e',
              }),
              ...parseTextWithMath(q.context, { size: 22, italics: true }),
            ],
            indent: { left: 180 },
            spacing: { before: 80, after: 60 },
          })
        );
      }

      const questionRuns = [
        new TextRun({
          text: `Câu ${qIndex}: `,
          font: 'Times New Roman',
          size: 23,
          bold: true,
          underline: {},
        }),
        ...(levelTag
          ? [
              new TextRun({
                text: levelTag,
                font: 'Times New Roman',
                size: 22,
                bold: true,
                color: getLevelColor(q.level),
              }),
            ]
          : []),
        ...parseTextWithMath(q.text, { size: 23 }),
      ];

      contentElements.push(
        new Paragraph({
          children: questionRuns,
          spacing: { before: 100, after: 40 },
        })
      );

      if (q.imageUrl) {
        const imgObj = await fetchImageBufferAndDimensions(q.imageUrl);
        if (imgObj) {
          contentElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: imgObj.data,
                  transformation: {
                    width: imgObj.width,
                    height: imgObj.height,
                  },
                }),
              ],
              spacing: { before: 60, after: 80 },
            })
          );
        }
      }

      if (q.subQuestions && q.subQuestions.length > 0) {
        q.subQuestions.forEach((sub, subIdx) => {
          const letter = String.fromCharCode(97 + subIdx);
          const subLevelTag = sub.level ? `[${sub.level.toUpperCase()}] ` : '';
          const subRuns = [
            new TextRun({
              text: `${letter}) `,
              font: 'Times New Roman',
              size: 23,
              bold: true,
            }),
            ...(subLevelTag
              ? [
                  new TextRun({
                    text: subLevelTag,
                    font: 'Times New Roman',
                    size: 20,
                    bold: true,
                    color: getLevelColor(sub.level),
                  }),
                ]
              : []),
            ...parseTextWithMath(sub.text, { size: 23 }),
          ];

          contentElements.push(
            new Paragraph({
              children: subRuns,
              indent: { left: 360 },
              spacing: { before: 25, after: 25 },
            })
          );
        });
      }
    }
  }

  // PHẦN 3: CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN
  if (shortQs.length > 0) {
    contentElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN',
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
        ],
        spacing: { before: 240, after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Thí sinh trả lời từ câu 1 đến câu ${shortQs.length}.`,
            font: 'Times New Roman',
            size: 21,
            italics: true,
          }),
        ],
        spacing: { after: 120 },
      })
    );

    for (let idx = 0; idx < shortQs.length; idx++) {
      const q = shortQs[idx];
      const qIndex = idx + 1;
      const levelTag = q.level ? `[${q.level.toUpperCase()}] ` : '';

      if (q.context) {
        contentElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Lời dẫn / Dữ liệu dùng chung: ',
                font: 'Times New Roman',
                size: 22,
                bold: true,
                color: '854d0e',
              }),
              ...parseTextWithMath(q.context, { size: 22, italics: true }),
            ],
            indent: { left: 180 },
            spacing: { before: 80, after: 60 },
          })
        );
      }

      const questionRuns = [
        new TextRun({
          text: `Câu ${qIndex}: `,
          font: 'Times New Roman',
          size: 23,
          bold: true,
          underline: {},
        }),
        ...(levelTag
          ? [
              new TextRun({
                text: levelTag,
                font: 'Times New Roman',
                size: 22,
                bold: true,
                color: getLevelColor(q.level),
              }),
            ]
          : []),
        ...parseTextWithMath(q.text, { size: 23 }),
      ];

      contentElements.push(
        new Paragraph({
          children: questionRuns,
          spacing: { before: 100, after: 40 },
        })
      );

      if (q.imageUrl) {
        const imgObj = await fetchImageBufferAndDimensions(q.imageUrl);
        if (imgObj) {
          contentElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: imgObj.data,
                  transformation: {
                    width: imgObj.width,
                    height: imgObj.height,
                  },
                }),
              ],
              spacing: { before: 60, after: 80 },
            })
          );
        }
      }

      contentElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Đáp số: ........................................................................',
              font: 'Times New Roman',
              size: 21,
              italics: true,
              color: '444444',
            }),
          ],
          indent: { left: 360 },
          spacing: { before: 20, after: 40 },
        })
      );
    }
  }

  // LỜI KẾT
  contentElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: '---------- HẾT ----------',
          font: 'Times New Roman',
          size: 23,
          bold: true,
        }),
      ],
      spacing: { before: 260, after: 180 },
    })
  );

  // 6. BẢNG ĐÁP ÁN (Định dạng giống xuất doc)
  if (includeAnswers) {
    contentElements.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'BẢNG ĐÁP ÁN',
            font: 'Times New Roman',
            size: 26, // 13pt
            bold: true,
          }),
        ],
        spacing: { before: 120, after: 180 },
      })
    );

    // Bảng đáp án Phần I
    if (mcqQs.length > 0) {
      contentElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN',
              font: 'Times New Roman',
              size: 22,
              bold: true,
            }),
          ],
          spacing: { before: 140, after: 80 },
        })
      );

      const tableRows: TableRow[] = [];
      const numChunks = Math.ceil(mcqQs.length / 10);

      for (let rowIndex = 0; rowIndex < numChunks; rowIndex++) {
        const chunk = mcqQs.slice(rowIndex * 10, (rowIndex + 1) * 10);

        const headerCells: TableCell[] = chunk.map((_, colIndex) => {
          const qNum = rowIndex * 10 + colIndex + 1;
          return new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8FAFC' },
            margins: { top: 70, bottom: 70, left: 30, right: 30 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Câu ${qNum}`,
                    font: 'Times New Roman',
                    size: 20,
                    bold: true,
                  }),
                ],
              }),
            ],
          });
        });

        for (let i = chunk.length; i < 10; i++) {
          headerCells.push(
            new TableCell({
              width: { size: 10, type: WidthType.PERCENTAGE },
              margins: { top: 70, bottom: 70, left: 30, right: 30 },
              children: [new Paragraph({ children: [] })],
            })
          );
        }

        const answerCells: TableCell[] = chunk.map((q) => {
          let ansLetter = q.correctAnswer || '?';
          if (q.options && q.options.length > 0) {
            const cIdx = q.options.indexOf(q.correctAnswer || '');
            if (cIdx !== -1) {
              ansLetter = String.fromCharCode(65 + cIdx);
            }
          }
          return new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            margins: { top: 70, bottom: 70, left: 30, right: 30 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: ansLetter,
                    font: 'Times New Roman',
                    size: 21,
                    bold: true,
                    color: '166534',
                  }),
                ],
              }),
            ],
          });
        });

        for (let i = chunk.length; i < 10; i++) {
          answerCells.push(
            new TableCell({
              width: { size: 10, type: WidthType.PERCENTAGE },
              margins: { top: 70, bottom: 70, left: 30, right: 30 },
              children: [new Paragraph({ children: [] })],
            })
          );
        }

        tableRows.push(new TableRow({ children: headerCells }));
        tableRows.push(new TableRow({ children: answerCells }));
      }

      contentElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: tableRows,
        })
      );
    }

    // Bảng đáp án Phần II
    if (groupTfQs.length > 0) {
      contentElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI',
              font: 'Times New Roman',
              size: 22,
              bold: true,
            }),
          ],
          spacing: { before: 180, after: 80 },
        })
      );

      const tableRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 16, type: WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC' },
              margins: { top: 70, bottom: 70, left: 40, right: 40 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Câu', font: 'Times New Roman', size: 20, bold: true })],
                }),
              ],
            }),
            ...['a', 'b', 'c', 'd'].map((col) => (
              new TableCell({
                width: { size: 21, type: WidthType.PERCENTAGE },
                shading: { fill: 'F8FAFC' },
                margins: { top: 70, bottom: 70, left: 40, right: 40 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: col, font: 'Times New Roman', size: 20, bold: true })],
                  }),
                ],
              })
            )),
          ],
        }),
      ];

      groupTfQs.forEach((q, i) => {
        const subAns = q.subQuestions || [];
        const cells: TableCell[] = [
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `Câu ${i + 1}`, font: 'Times New Roman', size: 20, bold: true })],
              }),
            ],
          }),
          ...[0, 1, 2, 3].map((subIdx) => {
            const sq = subAns[subIdx];
            const isTrue = sq ? (String(sq.correctAnswer).toLowerCase() === 'true' || String(sq.correctAnswer).toLowerCase() === 'đúng') : false;
            const val = sq ? (isTrue ? 'Đ' : 'S') : '-';
            return new TableCell({
              width: { size: 21, type: WidthType.PERCENTAGE },
              margins: { top: 60, bottom: 60, left: 40, right: 40 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: val,
                      font: 'Times New Roman',
                      size: 20,
                      bold: true,
                      color: val === 'Đ' ? '166534' : val === 'S' ? 'DC2626' : '000000',
                    }),
                  ],
                }),
              ],
            });
          }),
        ];

        tableRows.push(new TableRow({ children: cells }));
      });

      contentElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: tableRows,
        })
      );
    }

    // Bảng đáp án Phần III
    if (shortQs.length > 0) {
      contentElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN',
              font: 'Times New Roman',
              size: 22,
              bold: true,
            }),
          ],
          spacing: { before: 180, after: 80 },
        })
      );

      const tableRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC' },
              margins: { top: 70, bottom: 70, left: 40, right: 40 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Câu', font: 'Times New Roman', size: 20, bold: true })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC' },
              margins: { top: 70, bottom: 70, left: 40, right: 40 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Đáp án', font: 'Times New Roman', size: 20, bold: true })],
                }),
              ],
            }),
          ],
        }),
      ];

      shortQs.forEach((q, i) => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                margins: { top: 60, bottom: 60, left: 40, right: 40 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `Câu ${i + 1}`, font: 'Times New Roman', size: 20, bold: true })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 75, type: WidthType.PERCENTAGE },
                margins: { top: 60, bottom: 60, left: 40, right: 40 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: String(q.correctAnswer || 'N/A'),
                        font: 'Times New Roman',
                        size: 20,
                        bold: true,
                        color: '1D4ED8',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
      });

      contentElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: tableRows,
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1100,
              right: 1100,
            },
          },
        },
        children: contentElements,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
