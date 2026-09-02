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
  Math,
  MathRun,
  MathFraction,
  MathRadical,
  MathSubScript,
  MathSuperScript,
  MathSubSuperScript,
  MathComponent,
} from 'docx';
import { Quiz, Question } from '../types';
import { normalizeFullText, repairVietnameseText } from './vietnameseFixer';

const GREEK_AND_MATH_SYMBOLS: Record<string, string> = {
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
  '\\infty': '∞',
  '\\to': '→',
  '\\rightarrow': '→',
  '\\leftarrow': '←',
  '\\Rightarrow': '⇒',
  '\\Leftarrow': '⇐',
  '\\leftrightarrow': '↔',
  '\\Leftrightarrow': '⇔',
  '\\rightleftharpoons': '⇌',
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
      let txt = textBuffer;
      for (const [tex, sym] of Object.entries(GREEK_AND_MATH_SYMBOLS)) {
        txt = txt.split(tex).join(sym);
      }
      components.push(new MathRun(txt));
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

    // 4. Ký hiệu đặc biệt như \vec, \left(, \right)...
    if (clean[i] === '\\') {
      let matchedSymbol = false;
      for (const [tex, sym] of Object.entries(GREEK_AND_MATH_SYMBOLS)) {
        if (clean.startsWith(tex, i)) {
          textBuffer += sym;
          i += tex.length;
          matchedSymbol = true;
          break;
        }
      }
      if (matchedSymbol) continue;

      if (clean.startsWith('\\vec{', i) || clean.startsWith('\\overrightarrow{', i)) {
        const bracePos = clean.indexOf('{', i);
        const res = extractBraced(clean, bracePos);
        if (res) {
          textBuffer += res.content + '⃗';
          i = res.nextIndex;
          continue;
        }
      }

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
): (TextRun | Math)[] {
  if (!text) return [];

  const repaired = repairVietnameseText(text);
  const parts = repaired.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  const runs: (TextRun | Math)[] = [];

  for (const part of parts) {
    if (!part) continue;

    if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('$') && part.endsWith('$'))) {
      const mathComponents = parseLatexToDocxMath(part);
      runs.push(
        new Math({
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
 */
export async function generateNativeWordDocx(quiz: Quiz, includeAnswers: boolean = true): Promise<Blob> {
  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'BỘ GIÁO DỤC VÀ ĐÀO TẠO',
          font: 'Times New Roman',
          size: 20,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: normalizeFullText(quiz.title || 'ĐỀ THI TRẮC NGHIỆM'),
          font: 'Times New Roman',
          size: 26,
          bold: true,
        }),
      ],
      spacing: { after: 100, before: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Khối: ${quiz.grade !== 'all' ? 'Lớp ' + quiz.grade : 'Tổng hợp'}   |   Thời gian: ${quiz.durationMinutes || 45} phút`,
          font: 'Times New Roman',
          size: 22,
          italics: true,
        }),
      ],
      spacing: { after: 180 },
    }),
  ];

  const contentParagraphs: Paragraph[] = [...headerParagraphs];

  const mcqQs = quiz.questions.filter((q) => q.type === 'mcq');
  const groupTfQs = quiz.questions.filter((q) => q.type === 'group-tf');
  const shortQs = quiz.questions.filter((q) => q.type === 'short');

  // PHẦN 1: MCQ
  if (mcqQs.length > 0) {
    contentParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn',
            font: 'Times New Roman',
            size: 23,
            bold: true,
          }),
        ],
        spacing: { before: 200, after: 80 },
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

    mcqQs.forEach((q, idx) => {
      const qIndex = idx + 1;
      const levelTag = q.level ? `[${q.level.toUpperCase()}] ` : '';

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
                size: 23,
                bold: true,
                color: '1d4ed8',
              }),
            ]
          : []),
        ...parseTextWithMath(q.text, { size: 23 }),
      ];

      contentParagraphs.push(
        new Paragraph({
          children: questionRuns,
          spacing: { before: 100, after: 40 },
        })
      );

      // Options
      if (q.options && q.options.length > 0) {
        q.options.forEach((optText, optIdx) => {
          const optKey = String.fromCharCode(65 + optIdx);
          const isCorrect = includeAnswers && (q.correctAnswer === optText || q.correctAnswer === optKey);
          const optRuns = [
            new TextRun({
              text: `${optKey}. `,
              font: 'Times New Roman',
              size: 23,
              bold: true,
              color: isCorrect ? '15803d' : '000000',
            }),
            ...parseTextWithMath(optText, { size: 23 }),
          ];

          contentParagraphs.push(
            new Paragraph({
              children: optRuns,
              indent: { left: 360 },
              spacing: { before: 25, after: 25 },
            })
          );
        });
      }
    });
  }

  // PHẦN 2: ĐÚNG SAI
  if (groupTfQs.length > 0) {
    contentParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PHẦN II. Câu trắc nghiệm đúng sai',
            font: 'Times New Roman',
            size: 23,
            bold: true,
          }),
        ],
        spacing: { before: 240, after: 80 },
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

    groupTfQs.forEach((q, idx) => {
      const qIndex = idx + 1;
      const levelTag = q.level ? `[${q.level.toUpperCase()}] ` : '';

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
                size: 23,
                bold: true,
                color: '1d4ed8',
              }),
            ]
          : []),
        ...parseTextWithMath(q.text, { size: 23 }),
      ];

      contentParagraphs.push(
        new Paragraph({
          children: questionRuns,
          spacing: { before: 100, after: 40 },
        })
      );

      if (q.subQuestions && q.subQuestions.length > 0) {
        q.subQuestions.forEach((sub, subIdx) => {
          const letter = String.fromCharCode(97 + subIdx);
          const isCorrect = String(sub.correctAnswer).toLowerCase() === 'true' || String(sub.correctAnswer).toLowerCase() === 'đúng';
          const subRuns = [
            new TextRun({
              text: `${letter}) `,
              font: 'Times New Roman',
              size: 23,
              bold: true,
            }),
            ...parseTextWithMath(sub.text, { size: 23 }),
            ...(includeAnswers
              ? [
                  new TextRun({
                    text: ` [${isCorrect ? 'ĐÚNG' : 'SAI'}]`,
                    font: 'Times New Roman',
                    size: 21,
                    bold: true,
                    color: isCorrect ? '15803d' : 'dc2626',
                  }),
                ]
              : []),
          ];

          contentParagraphs.push(
            new Paragraph({
              children: subRuns,
              indent: { left: 360 },
              spacing: { before: 25, after: 25 },
            })
          );
        });
      }
    });
  }

  // PHẦN 3: TRẢ LỜI NGẮN
  if (shortQs.length > 0) {
    contentParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PHẦN III. Câu trắc nghiệm trả lời ngắn',
            font: 'Times New Roman',
            size: 23,
            bold: true,
          }),
        ],
        spacing: { before: 240, after: 80 },
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

    shortQs.forEach((q, idx) => {
      const qIndex = idx + 1;
      const levelTag = q.level ? `[${q.level.toUpperCase()}] ` : '';

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
                size: 23,
                bold: true,
                color: '1d4ed8',
              }),
            ]
          : []),
        ...parseTextWithMath(q.text, { size: 23 }),
        ...(includeAnswers && q.correctAnswer
          ? [
              new TextRun({
                text: ` (Đáp án: ${q.correctAnswer})`,
                font: 'Times New Roman',
                size: 21,
                bold: true,
                color: '1d4ed8',
              }),
            ]
          : []),
      ];

      contentParagraphs.push(
        new Paragraph({
          children: questionRuns,
          spacing: { before: 100, after: 40 },
        })
      );
    });
  }

  // LỜI KẾT
  contentParagraphs.push(
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
        children: contentParagraphs,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
