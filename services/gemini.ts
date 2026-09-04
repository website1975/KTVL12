
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Grade, QuestionLevel, SubQuestion, QuestionType } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { normalizeFullText } from './vietnameseFixer';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
};

const removeVietnameseAccents = (str: string): string => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
};

export const normalizeLevel = (val: any): QuestionLevel | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    const raw = String(val).trim().toUpperCase();
    const clean = removeVietnameseAccents(raw).replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const compact = clean.replace(/\s+/g, '');

    // 1. Mức 4: Vận dụng cao (VDC / High Apply / Expert / Advance)
    if (
        clean === 'VDC' || 
        compact === 'VDC' ||
        clean === '4' || 
        clean === 'MUC 4' || 
        compact === 'MUC4' ||
        clean === 'LEVEL 4' || 
        compact === 'LEVEL4' ||
        clean === 'LV 4' || 
        clean === 'LV4' ||
        clean === 'L4' ||
        clean.includes('VAN DUNG CAO') || 
        compact.includes('VANDUNGCAO') ||
        clean.includes('VD CAO') || 
        compact.includes('VDCAO') ||
        clean.includes('HIGH APPLY') ||
        compact.includes('HIGHAPPLY') ||
        clean.includes('HIGHER APPLY') ||
        compact.includes('HIGHERAPPLY') ||
        clean.includes('HIGH APPLICATION') ||
        compact.includes('HIGHAPPLICATION') ||
        clean.includes('HIGHER APPLICATION') ||
        (clean.includes('HIGH') && (clean.includes('APPLY') || clean.includes('APP'))) ||
        clean.includes('VERY HARD') || 
        compact.includes('VERYHARD') ||
        clean.includes('VHARD') ||
        clean.includes('V HARD') ||
        clean.includes('ADVANCED') || 
        clean.includes('ADVANCE') || 
        clean.includes('EXPERT') || 
        clean.includes('CREATIVE') ||
        clean.includes('CREATING') ||
        clean.includes('EVALUATE') ||
        clean.includes('EVALUATING')
    ) {
        return 'VDC';
    }

    // 2. Mức 3: Vận dụng (VD / Apply / Application / Hard)
    if (
        clean === 'VD' || 
        compact === 'VD' ||
        clean === '3' || 
        clean === 'MUC 3' || 
        compact === 'MUC3' ||
        clean === 'LEVEL 3' || 
        compact === 'LEVEL3' ||
        clean === 'LV 3' || 
        clean === 'LV3' ||
        clean === 'L3' ||
        clean.includes('VAN DUNG') || 
        compact.includes('VANDUNG') ||
        clean.includes('APPLY') || 
        compact.includes('APPLY') ||
        clean.includes('APPLICATION') || 
        compact.includes('APPLICATION') ||
        clean.includes('APPLYING') ||
        clean.includes('ANALYZE') ||
        clean.includes('ANALYZING') ||
        clean.includes('ANALYSIS') ||
        clean.includes('HARD') || 
        clean.includes('DIFFICULT')
    ) {
        return 'VD';
    }

    // 3. Mức 2: Thông hiểu / Hiểu (H / TH / Understand / Understanding / Medium)
    if (
        clean === 'H' || 
        clean === 'TH' || 
        compact === 'TH' ||
        clean === '2' || 
        clean === 'MUC 2' || 
        compact === 'MUC2' ||
        clean === 'LEVEL 2' || 
        compact === 'LEVEL2' ||
        clean === 'LV 2' || 
        clean === 'LV2' ||
        clean === 'L2' ||
        clean.includes('THONG HIEU') || 
        compact.includes('THONGHIEU') ||
        clean.includes('HIEU') || 
        clean.includes('UNDERSTAND') || 
        compact.includes('UNDERSTAND') ||
        clean.includes('COMPREHEND') || 
        clean.includes('COMPREHENSION') || 
        clean.includes('MEDIUM') || 
        clean.includes('MED') ||
        clean.includes('MODERATE') || 
        clean.includes('INTERMEDIATE') ||
        clean.includes('AVERAGE')
    ) {
        return 'H';
    }

    // 4. Mức 1: Nhận biết / Biết (B / NB / Know / Knowledge / Remember / Easy)
    if (
        clean === 'B' || 
        clean === 'NB' || 
        compact === 'NB' ||
        clean === '1' || 
        clean === 'MUC 1' || 
        compact === 'MUC1' ||
        clean === 'LEVEL 1' || 
        compact === 'LEVEL1' ||
        clean === 'LV 1' || 
        clean === 'LV1' ||
        clean === 'L1' ||
        clean.includes('NHAN BIET') || 
        compact.includes('NHANBIET') ||
        clean.includes('BIET') || 
        clean.includes('KNOW') || 
        compact.includes('KNOW') ||
        clean.includes('REMEMBER') || 
        compact.includes('REMEMBER') ||
        clean.includes('RECOGN') || 
        clean.includes('RECALL') ||
        clean.includes('EASY') || 
        clean.includes('EZ') ||
        clean.includes('BASIC') || 
        clean.includes('ELEMENTARY') ||
        clean.includes('BEGINNER') ||
        clean.includes('SIMPLE')
    ) {
        return 'B';
    }

    return undefined;
};

export const extractLevelFromText = (text: string): { cleanText: string; level?: QuestionLevel } => {
    if (!text) return { cleanText: "" };
    let cleanText = text;
    let level: QuestionLevel | undefined = undefined;

    // Pattern: [B], (B), <B>, 【B】, [NB], [H], [TH], [VD], [VDC], [Nhận biết], [Thông hiểu], [Vận dụng], [Vận dụng cao], [Biết], [Hiểu], [Mức 1], [Mức 2], [Mức 3], [Mức 4]
    const levelRegex = /(?:\[|\(|\<|【|\{)\s*(VDC|VD\s*CAO|VẬN\s*DỤNG\s*CAO|VAN\s*DUNG\s*CAO|VD|VẬN\s*DỤNG|VAN\s*DUNG|TH|THÔNG\s*HIỂU|THONG\s*HIEU|H|HIỂU|HIEU|NB|NHẬN\s*BIẾT|NHAN\s*BIET|B|BIẾT|BIET|MỨC\s*[1-4]|MUC\s*[1-4]|LEVEL\s*[1-4])\s*(?:\]|\)|\>|】|\})/i;
    
    const match = cleanText.match(levelRegex);
    if (match) {
        level = normalizeLevel(match[1]);
        cleanText = cleanText.replace(match[0], "").trim();
    }
    return { cleanText, level };
};

const stripOptionLabel = (text: string): string => {
    if (!text) return "";
    // Chuẩn hóa dấu tiếng Việt và LaTeX trước
    let cleaned = normalizeFullText(text.trim());
    // Xử lý đệ quy để xóa nhiều lớp nhãn (VD: "A. A. Nội dung")
    const labelRegex = /^(\*?[A-Za-z0-9][\.\)\/\-:\s]\s*)/g;
    
    while (labelRegex.test(cleaned)) {
        cleaned = cleaned.replace(labelRegex, "").trim();
    }
    return cleaned;
};

const EXTRACTION_INSTRUCTION = `Bạn là chuyên gia trích xuất và phân loại đề thi THPT quốc gia Việt Nam (Toán, Lý, Hóa, Sinh,...).
NHIỆM VỤ: Chuyển đổi nội dung được cung cấp thành danh sách JSON chuẩn theo cấu trúc phân loại mức độ nhận thức.

QUY TẮC PHÂN LOẠI MỨC ĐỘ NHẬN THỨC (level: "B" | "H" | "VD" | "VDC") - BẮT BUỘC:
Mỗi câu hỏi và mỗi ý con a, b, c, d của câu Đúng/Sai BẮT BUỘC phải có trường 'level' thuộc một trong 4 mức độ:
1. "B" (Biết / Nhận biết): Nhận diện định nghĩa, khái niệm, công thức, định luật trực tiếp, áp dụng công thức 1 bước đơn giản.
2. "H" (Hiểu / Thông hiểu): Hiểu bản chất vấn đề, giải thích hiện tượng, đọc đồ thị/bảng biến thiên/hình vẽ cơ bản, tính toán 1-2 bước.
3. "VD" (Vận dụng): Tổng hợp kiến thức, liên hệ thực tiễn, tính toán nhiều bước, biến đổi toán học/vật lý phức tạp.
4. "VDC" (Vận dụng cao): Bài toán cực trị, phân hóa điểm 9-10, tình huống thực nghiệm sáng tạo, tư duy liên chương/tổng hợp cao.

QUY TẮC TRÍCH XUẤT ĐẶC BIỆT:
- Nếu tài liệu gốc có sẵn nhãn mức độ như [B], [NB], [H], [TH], [VD], [VDC], (Biết), (Hiểu)... -> Trích xuất chính xác level và xóa nhãn đó khỏi nội dung 'text'.
- Nếu tài liệu gốc KHÔNG CÓ nhãn mức độ -> AI BẮT BUỘC TỰ ĐÁNH GIÁ và GÁN 'level' chuẩn xác ("B", "H", "VD", "VDC") cho câu hỏi và từng ý con a, b, c, d.

QUY TẮC CẤU TRÚC CHI TIẾT:
1. MCQ (Trắc nghiệm 4 lựa chọn):
   - 'type': "mcq"
   - 'level': "B" | "H" | "VD" | "VDC"
   - 'options': Mảng 4 phương án đã làm sạch (xóa "A.", "B.", "C.", "D.").
   - 'correctAnswer': BẮT BUỘC điền nội dung của phương án đúng (không kèm nhãn A, B, C, D).
2. GROUP-TF (Trắc nghiệm Đúng/Sai):
   - 'type': "group-tf"
   - 'level': Mức độ chung của câu ("B" | "H" | "VD" | "VDC").
   - 'subQuestions': Mảng 4 ý (a, b, c, d), mỗi ý có:
     + 'text': Nội dung ý (đã xóa nhãn "a)", "b)").
     + 'correctAnswer': "True" hoặc "False".
     + 'level': Mức độ của riêng ý đó ("B" | "H" | "VD" | "VDC"). Thông thường ý a: "B", ý b: "H", ý c: "VD", ý d: "VDC" hoặc theo nội dung câu.
   - 'solution': Lời giải chi tiết giải thích cho cả 4 ý: a) Đúng vì... b) Sai vì...
3. SHORT (Trả lời ngắn):
   - 'type': "short"
   - 'level': "B" | "H" | "VD" | "VDC" (thường là "VD" hoặc "VDC")
   - 'correctAnswer': Giá trị số hoặc biểu thức ngắn (VD: "12.5", "-4")
   - 'options': null
4. LaTeX & Công thức: Mọi ký hiệu, công thức toán/lý/hóa BẮT BUỘC bọc trong cặp dấu $...$ (VD: $x^2 + y^2 = 4$).
`;

const processAIQuestions = (rawData: any[]): Question[] => {
    return rawData.map((item: any) => {
        const type = item.type?.toLowerCase() || 'mcq';
        const strippedOptions = item.options ? item.options.map((opt: string) => stripOptionLabel(opt)) : (type === 'mcq' ? [] : undefined);
        let finalCorrectAnswer = item.correctAnswer;

        // Xử lý trích xuất level từ mọi trường hoặc từ text câu hỏi
        const rawLevel = item.level ?? item.muc_do ?? item.mucdo ?? item.mucDo ?? item.do_kho ?? item.dokho ?? item.doKho ?? item.difficulty ?? item.bloom ?? item.bloomLevel ?? item.level_code ?? item.cognitiveLevel ?? item.cognitive_level ?? item.rank ?? item.phan_loai;
        let extractedMain = extractLevelFromText(item.text || "");
        let finalLevel = normalizeLevel(rawLevel) || extractedMain.level;
        let cleanedText = extractedMain.cleanText;

        if (type === 'mcq' && item.correctAnswer && item.options) {
            let ansText = item.correctAnswer.trim();
            const matchLabel = ansText.match(/(?:Đáp án|Chọn|Câu\s*\d+[:\s]*|^)\s*([A-D])(?:\.|\s|$)/i);
            
            if (matchLabel) {
                const label = matchLabel[1].toUpperCase();
                const index = label.charCodeAt(0) - 65;
                if (item.options[index]) {
                    finalCorrectAnswer = stripOptionLabel(item.options[index]);
                }
            } else {
                finalCorrectAnswer = stripOptionLabel(ansText);
            }
        }

        // Đảm bảo correctAnswer của MCQ luôn khớp với một trong các options sau khi đã strip
        if (type === 'mcq' && strippedOptions && finalCorrectAnswer) {
            const cleanAns = stripOptionLabel(finalCorrectAnswer);
            const exactMatch = strippedOptions.find((opt: string) => stripOptionLabel(opt) === cleanAns);
            if (exactMatch) {
                finalCorrectAnswer = exactMatch;
            } else {
                const fuzzyMatch = strippedOptions.find((opt: string) => {
                    const cleanOpt = stripOptionLabel(opt);
                    return cleanOpt.includes(cleanAns) || cleanAns.includes(cleanOpt);
                });
                if (fuzzyMatch) finalCorrectAnswer = fuzzyMatch;
            }
        }

        if (type === 'short') {
            finalCorrectAnswer = item.correctAnswer?.toString().trim() || "";
        }

        return {
            ...item,
            type,
            id: item.id || uuidv4(),
            chapterName: item.chapterName ? String(item.chapterName).trim() : undefined,
            chapterId: item.chapterId ? String(item.chapterId).trim() : undefined,
            context: item.context ? String(item.context).trim() : undefined,
            text: cleanedText,
            level: finalLevel,
            points: item.points || (type === 'mcq' ? 0.25 : type === 'group-tf' ? 1.0 : 0.5),
            options: strippedOptions,
            correctAnswer: finalCorrectAnswer,
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => {
                const sqRawLevel = sq.level ?? sq.muc_do ?? sq.mucdo ?? sq.mucDo ?? sq.do_kho ?? sq.dokho ?? sq.doKho ?? sq.difficulty ?? sq.bloom ?? sq.bloomLevel ?? sq.level_code ?? sq.cognitiveLevel;
                const sqExtract = extractLevelFromText(sq.text || "");
                return { 
                    ...sq, 
                    id: uuidv4(),
                    text: stripOptionLabel(sqExtract.cleanText),
                    level: normalizeLevel(sqRawLevel) || sqExtract.level,
                    correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ' || sq.correctAnswer === 'T' || sq.correctAnswer === 'true' || sq.correctAnswer === '1') ? 'True' : 'False'
                };
            }) : undefined
        };
    });
};

export const getAIKey = (): string => {
    let key = '';

    // 1. Literal replacement by Vite define
    try {
        if (process.env.GEMINI_API_KEY) key = process.env.GEMINI_API_KEY;
        else if (process.env.API_KEY) key = process.env.API_KEY;
    } catch {
        // Ignore in environments where process is not replaced
    }

    // 2. Vite import.meta.env
    if (!key && typeof import.meta !== 'undefined' && (import.meta as any).env) {
        key = (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.VITE_API_KEY || '';
    }

    // 3. Fallback: window or localStorage
    if (!key && typeof window !== 'undefined') {
        try {
            key = (window as any).GEMINI_API_KEY || 
                  localStorage.getItem('gemini_api_key') || 
                  localStorage.getItem('GEMINI_API_KEY') || 
                  '';
        } catch {
            // Ignore security/localStorage restrictions
        }
    }

    if (key && (key === 'undefined' || key === 'null' || key === '""')) {
        return '';
    }

    return key ? key.trim() : '';
};

const getAIClient = (): GoogleGenAI => {
    const key = getAIKey();
    if (!key) {
        throw new Error("Chưa có API key Google Gemini. Vui lòng kiểm tra lại cấu hình GEMINI_API_KEY trong hệ thống.");
    }
    return new GoogleGenAI({ apiKey: key });
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = getAIClient();
    
    let matrixPrompt = "";
    if (config.matrix) {
        matrixPrompt = `
MA TRẬN ĐỘ KHÓ (PHÂN BỔ THEO % TỔNG SỐ CÂU):
- Nhận biết (Easy/Knowledge): ${config.matrix.easy}% 
- Thông hiểu (Medium/Understanding): ${config.matrix.medium}%
- Vận dụng (Hard/Application): ${config.matrix.hard}%
- Vận dụng cao (Very Hard/High Application): ${config.matrix.vhard}%
Hãy phân bổ độ khó cho các câu hỏi sao cho tỉ lệ các mức độ sát với ma trận này nhất có thể.
`;
    }

    const sourceInstruction = config.pdfBase64 
        ? "NGUỒN DỮ LIỆU: Hãy đọc kỹ file PDF được cung cấp. BẮT BUỘC chỉ được lấy dữ liệu, ý tưởng hoặc trích xuất trực tiếp các câu hỏi từ nội dung trong file PDF này để soạn đề. Không được tự ý chế tác nội dung nằm ngoài phạm vi tài liệu PDF trừ khi cần thiết để hoàn thiện cấu trúc câu hỏi."
        : "NGUỒN DỮ LIỆU: Sử dụng kho tri thức chuyên sâu của bạn về chương trình giáo dục phổ thông Việt Nam để soạn đề.";

    const prompt = `Bạn là chuyên gia soạn đề thi THPT quốc gia Việt Nam môn Toán/Lý/Hóa.
Sử dụng model: gemini-3-flash-preview.
${sourceInstruction}

YÊU CẦU CHI TIẾT:
- Chủ đề: ${config.topic}.
- Khối lớp: ${config.grade}.
- Cấu trúc: ${config.part1Count} câu trắc nghiệm 4 lựa chọn (MCQ), ${config.part2Count} câu trắc nghiệm Đúng/Sai (Group-TF), ${config.part3Count} câu trả lời ngắn (Short).
${matrixPrompt}

QUY TẮC KỸ THUẬT BẮT BUỘC:
1. LaTeX: Mọi biểu thức, công thức, ký hiệu toán/lý/hóa (VD: $\Delta\Phi$, $\Omega$, $x^2$, $\vec{v}$) BẮT BUỘC phải nằm trong cặp dấu $...$. Quy tắc này áp dụng cho NỘI DUNG CÂU HỎI, CÁC PHƯƠNG ÁN (Options), và LỜI GIẢI (Solution).
2. Solution (Lời giải): Phải có lời giải chi tiết, sư phạm cho từng câu.
3. MCQ: 'correctAnswer' phải là nội dung của phương án đúng (không kèm nhãn A, B, C, D).
4. GROUP-TF: 
   - 'subQuestions' phải có chính xác 4 ý (a, b, c, d).
   - 'solution' phải giải thích chi tiết cho từng ý theo mẫu:
     a) [Đúng/Sai] : Vì [Lý do chi tiết]
     ... (tương tự cho b, c, d)
5. Options: Tuyệt đối KHÔNG bao gồm nhãn "A.", "B.", "C.", "D." vào nội dung phương án.
6. JSON: Trả về kết quả dưới dạng mảng JSON chuẩn xác theo schema đã định.`;

    try {
        const contents = config.pdfBase64 
            ? {
                parts: [
                    { inlineData: { mimeType: "application/pdf", data: config.pdfBase64 } },
                    { text: prompt }
                ]
            }
            : prompt;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING },
                            text: { type: Type.STRING },
                            level: { type: Type.STRING, nullable: true },
                            points: { type: Type.NUMBER },
                            options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                            correctAnswer: { type: Type.STRING, nullable: true },
                            solution: { type: Type.STRING },
                            subQuestions: {
                                type: Type.ARRAY,
                                nullable: true,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        text: { type: Type.STRING },
                                        correctAnswer: { type: Type.STRING },
                                        level: { type: Type.STRING, nullable: true }
                                    },
                                    required: ["text", "correctAnswer"]
                                }
                            }
                        },
                        required: ["type", "text", "points", "solution"]
                    }
                }
            }
        });

        const textOutput = response.text || "[]";
        const rawData = JSON.parse(cleanJsonString(textOutput));
        
        return processAIQuestions(rawData);
    } catch (error: any) {
        throw new Error("AI không thể tạo đề: " + error.message);
    }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = getAIClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
          parts: [
              { inlineData: { mimeType: "application/pdf", data: base64Data } },
              { text: EXTRACTION_INSTRUCTION }
          ]
      },
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING },
                    text: { type: Type.STRING },
                    level: { type: Type.STRING, nullable: true },
                    points: { type: Type.NUMBER },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                    correctAnswer: { type: Type.STRING, nullable: true },
                    solution: { type: Type.STRING },
                    subQuestions: {
                        type: Type.ARRAY,
                        nullable: true,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                correctAnswer: { type: Type.STRING },
                                level: { type: Type.STRING, nullable: true }
                            },
                            required: ["text", "correctAnswer"]
                        }
                    }
                },
                required: ["type", "text", "solution"]
            }
        }
      }
    });

    const textOutput = response.text || "[]";
    const rawData = JSON.parse(cleanJsonString(textOutput));
    
    return processAIQuestions(rawData);
  } catch (error: any) {
    throw new Error("Lỗi đọc PDF: " + error.message);
  }
};

export const parseQuestionsFromJSON = (input: string | any): { questions: Question[]; quizTitle?: string; grade?: Grade; category?: string; durationMinutes?: number } => {
    let parsed: any;
    if (typeof input === 'string') {
        try {
            const cleanStr = cleanJsonString(input);
            parsed = JSON.parse(cleanStr);
        } catch (e: any) {
            throw new Error("Cấu trúc file hoặc chuỗi JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp JSON!");
        }
    } else {
        parsed = input;
    }

    let rawQuestions: any[] = [];
    let quizTitle: string | undefined;
    let grade: Grade | undefined;
    let category: string | undefined;
    let durationMinutes: number | undefined;

    if (Array.isArray(parsed)) {
        rawQuestions = parsed;
    } else if (parsed && typeof parsed === 'object') {
        const infoObj = parsed.exam_info || parsed.info || parsed.metadata || parsed;
        
        if (infoObj.title || infoObj.quizTitle || infoObj.name || parsed.title || parsed.quizTitle || parsed.name) {
            quizTitle = infoObj.title || infoObj.quizTitle || infoObj.name || parsed.title || parsed.quizTitle || parsed.name;
        }
        if (infoObj.grade || parsed.grade) grade = String(infoObj.grade || parsed.grade) as Grade;
        if (infoObj.category || infoObj.subject || parsed.category || parsed.subject) category = infoObj.category || infoObj.subject || parsed.category || parsed.subject;
        
        const rawDur = infoObj.durationMinutes || infoObj.duration || infoObj.timeLimit || parsed.durationMinutes || parsed.duration || parsed.timeLimit;
        if (rawDur) {
            if (typeof rawDur === 'number') {
                durationMinutes = rawDur;
            } else if (typeof rawDur === 'string') {
                const match = rawDur.match(/\d+/);
                if (match) durationMinutes = parseInt(match[0], 10);
            }
        }

        // Extract questions from parts array or root questions arrays
        if (Array.isArray(parsed.parts)) {
            parsed.parts.forEach((part: any) => {
                if (Array.isArray(part.questions)) {
                    rawQuestions.push(...part.questions);
                } else if (Array.isArray(part.data)) {
                    rawQuestions.push(...part.data);
                } else if (Array.isArray(part.items)) {
                    rawQuestions.push(...part.items);
                }
            });
        }
        
        if (rawQuestions.length === 0) {
            if (Array.isArray(parsed.questions)) {
                rawQuestions = parsed.questions;
            } else if (Array.isArray(parsed.data)) {
                rawQuestions = parsed.data;
            } else if (Array.isArray(parsed.items)) {
                rawQuestions = parsed.items;
            } else if (parsed.quiz && Array.isArray(parsed.quiz.questions)) {
                rawQuestions = parsed.quiz.questions;
            } else {
                const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
                if (possibleArray) {
                    rawQuestions = possibleArray as any[];
                }
            }
        }
    }

    if (!rawQuestions || rawQuestions.length === 0) {
        throw new Error("Không tìm thấy danh sách câu hỏi hợp lệ trong dữ liệu JSON!");
    }

    const normalizedRaw = rawQuestions.map((q: any) => {
        let typeStr = (q.type || q.qtype || q.questionType || q.question_type || '').toLowerCase().trim();
        let type = 'mcq';
        if (typeStr === 'mc' || typeStr === 'part1' || typeStr.includes('mcq') || typeStr.includes('trac_nghiem') || typeStr.includes('multiple')) {
            type = 'mcq';
        } else if (typeStr === 'tf' || typeStr === 'part2' || typeStr.includes('group') || typeStr.includes('dung_sai') || typeStr.includes('true_false')) {
            type = 'group-tf';
        } else if (typeStr === 'sa' || typeStr === 'part3' || typeStr.includes('short') || typeStr.includes('ngan') || typeStr.includes('tra_loi')) {
            type = 'short';
        } else {
            if (q.subQuestions || q.sub_questions || q.statements || q.y_con) {
                type = 'group-tf';
            } else if (q.options || q.choices || q.phuong_an) {
                type = 'mcq';
            } else {
                type = 'short';
            }
        }

        // Raw options: can be Array or Object (e.g. { "A": "...", "B": "..." })
        const rawOptions = q.options || q.choices || q.phuong_an || q.dap_an_lua_chon || q.answers;
        let optionsObj: Record<string, any> | null = null;
        let rawOptionsArray: any[] | null = null;

        if (Array.isArray(rawOptions)) {
            rawOptionsArray = rawOptions;
        } else if (rawOptions && typeof rawOptions === 'object') {
            optionsObj = rawOptions;
            rawOptionsArray = Object.values(rawOptions);
        }

        let subQuestions = q.subQuestions || q.sub_questions || q.statements || q.y_con;
        
        // Trường hợp câu hỏi Đúng/Sai (TF) mà danh sách mệnh đề nằm trong q.options
        if (type === 'group-tf' && !subQuestions && rawOptionsArray && Array.isArray(rawOptionsArray)) {
            subQuestions = rawOptionsArray;
        }

        if (Array.isArray(subQuestions)) {
            subQuestions = subQuestions.map((sq: any) => {
                let ans = sq.correctAnswer ?? sq.answer ?? sq.dap_an ?? sq.isTrue ?? sq.isCorrect ?? sq.correct ?? sq.correct_answer;
                if (ans === true || ans === 'True' || ans === 'true' || ans === 'Đ' || ans === 'Đúng' || ans === '1') {
                    ans = 'True';
                } else {
                    ans = 'False';
                }
                const sqText = sq.text || sq.content || sq.noi_dung || sq.question || '';
                const sqRawLevel = sq.level ?? sq.muc_do ?? sq.mucdo ?? sq.mucDo ?? sq.do_kho ?? sq.dokho ?? sq.doKho ?? sq.difficulty ?? sq.bloom ?? sq.bloomLevel ?? sq.level_code ?? sq.cognitiveLevel ?? sq.cognitive_level ?? sq.rank ?? sq.phan_loai ?? sq.phanLoai ?? sq.tier ?? sq.grade_level;
                const sqLevel = normalizeLevel(sqRawLevel);
                return {
                    text: sqText.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$'),
                    correctAnswer: ans,
                    level: sqLevel
                };
            });
        }

        let rawCorrectVal = q.correct_answer ?? q.correctAnswer ?? q.answer ?? q.correct ?? q.dap_an_dung ?? q.dap_an ?? q.correctOptionIndex ?? q.correct_option_index ?? q.correctIndex ?? q.correct_index ?? q.answerIndex;

        let options: string[] | undefined = undefined;
        let correctAnswer = '';

        if (type === 'mcq' && rawOptionsArray) {
            options = rawOptionsArray.map((opt: any) => {
                const str = typeof opt === 'string' ? opt : (opt.text || opt.content || opt.label || String(opt));
                return str.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$');
            });

            // 1. Tìm trong thuộc tính isCorrect của option object
            const correctObj = rawOptionsArray.find((opt: any) => typeof opt === 'object' && (opt.isCorrect === true || opt.is_correct === true || opt.correct === true));
            if (correctObj) {
                const str = typeof correctObj === 'string' ? correctObj : (correctObj.text || correctObj.content || correctObj.label || String(correctObj));
                correctAnswer = str.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$');
            } else if (rawCorrectVal !== undefined && rawCorrectVal !== null && rawCorrectVal !== '') {
                // 2. Nếu optionsObj dạng { "A": "...", "B": "..." } và rawCorrectVal = "A" hay "D"
                if (optionsObj && typeof rawCorrectVal === 'string' && optionsObj[rawCorrectVal.trim()] !== undefined) {
                    const matchedVal = optionsObj[rawCorrectVal.trim()];
                    const str = typeof matchedVal === 'string' ? matchedVal : (matchedVal.text || matchedVal.content || String(matchedVal));
                    correctAnswer = str.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$');
                } else if (typeof rawCorrectVal === 'number') {
                    if (rawCorrectVal >= 0 && rawCorrectVal < options.length) {
                        correctAnswer = options[rawCorrectVal];
                    } else {
                        correctAnswer = String(rawCorrectVal);
                    }
                } else if (typeof rawCorrectVal === 'string') {
                    const trimmed = rawCorrectVal.trim();
                    if (/^\d+$/.test(trimmed)) {
                        const idx = parseInt(trimmed, 10);
                        if (idx >= 0 && idx < options.length) {
                            correctAnswer = options[idx];
                        } else {
                            correctAnswer = trimmed;
                        }
                    } else if (/^[A-Da-d][\.\:\s]*$/.test(trimmed)) {
                        const letter = trimmed.charAt(0).toUpperCase();
                        const idx = letter.charCodeAt(0) - 65;
                        if (idx >= 0 && idx < options.length) {
                            correctAnswer = options[idx];
                        } else {
                            correctAnswer = trimmed;
                        }
                    } else {
                        correctAnswer = trimmed;
                    }
                }
            }
        } else {
            if (rawCorrectVal !== undefined && rawCorrectVal !== null) {
                correctAnswer = String(rawCorrectVal).trim();
            }
        }

        // Question context & text:
        const contextStr = q.context || q.loi_dan || q.dan_nhap || q.doan_van || q.bai_doc || '';
        const mainTextStr = q.text || q.question || q.content || q.cau_hoi || q.title || '';

        const rawSolution = q.solution || q.explanation || q.loi_giai || q.huong_dan_giai || q.guide || '';
        const rawLevel = q.level ?? q.muc_do ?? q.mucdo ?? q.mucDo ?? q.do_kho ?? q.dokho ?? q.doKho ?? q.difficulty ?? q.bloom ?? q.bloomLevel ?? q.level_code ?? q.cognitiveLevel ?? q.cognitive_level ?? q.rank ?? q.phan_loai ?? q.phanLoai ?? q.tier ?? q.grade_level;

        // Trích xuất chương học từ file JSON nếu có
        const rawChapterName = q.chapterName || q.chapter || q.chuong || q.ten_chuong || q.tenChuong || q.chapter_name || q.quizCategory || q.category;
        const rawChapterId = q.chapterId || q.chapter_id;

        return {
            ...q,
            type,
            level: normalizeLevel(rawLevel),
            chapterName: rawChapterName ? String(rawChapterName).trim() : undefined,
            chapterId: rawChapterId ? String(rawChapterId).trim() : undefined,
            context: contextStr ? contextStr.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$') : undefined,
            text: mainTextStr.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$'),
            options: type === 'mcq' ? options : undefined,
            correctAnswer: typeof correctAnswer === 'string' ? correctAnswer.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$') : String(correctAnswer),
            solution: rawSolution.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$'),
            points: q.points || q.score || q.diem || (type === 'mcq' ? 0.25 : 1.0),
            subQuestions: type === 'group-tf' ? subQuestions : undefined
        };
    });

    const questions = processAIQuestions(normalizedRaw);

    return {
        questions,
        quizTitle,
        grade,
        category,
        durationMinutes
    };
};

export const parseQuestionsFromText = async (rawText: string): Promise<Question[]> => {
    const ai = getAIClient();
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `${EXTRACTION_INSTRUCTION}\n\nNỘI DUNG VĂN BẢN CẦN TRÍCH XUẤT VÀ PHÂN LOẠI MỨC ĐỘ:\n${rawText}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING },
                            text: { type: Type.STRING },
                            level: { type: Type.STRING, nullable: true },
                            points: { type: Type.NUMBER },
                            options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                            correctAnswer: { type: Type.STRING, nullable: true },
                            solution: { type: Type.STRING },
                            subQuestions: {
                                type: Type.ARRAY,
                                nullable: true,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        text: { type: Type.STRING },
                                        correctAnswer: { type: Type.STRING },
                                        level: { type: Type.STRING, nullable: true }
                                    },
                                    required: ["text", "correctAnswer"]
                                }
                            }
                        },
                        required: ["type", "text", "solution"]
                    }
                }
            }
        });

        const textOutput = response.text || "[]";
        const rawData = JSON.parse(cleanJsonString(textOutput));
        
        return processAIQuestions(rawData);
    } catch (error: any) {
        throw new Error("Lỗi bóc tách văn bản: " + error.message);
    }
};

/**
 * AI tự động đọc nội dung câu hỏi và gán vào Chương học phù hợp nhất
 * Hỗ trợ chia nhỏ lô câu hỏi (chunks) để xử lý nhanh và tránh lỗi quá tải
 */
export const autoCategorizeChaptersWithAI = async (
    questions: Question[],
    chapters: { id: string; name: string }[]
): Promise<{ id: string; chapterId?: string; chapterName: string }[]> => {
    if (!questions || questions.length === 0 || !chapters || chapters.length === 0) {
        return [];
    }
    const ai = getAIClient();
    
    const chapterListText = chapters.map((c, idx) => `${idx + 1}. [Mã: "${c.id}"] - Tên chương: "${c.name}"`).join('\n');
    
    // Chia câu hỏi thành các lô nhỏ tối đa 15 câu/lô để AI phản hồi trong vài giây
    const CHUNK_SIZE = 15;
    const chunks: Question[][] = [];
    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
        chunks.push(questions.slice(i, i + CHUNK_SIZE));
    }

    const processChunk = async (chunkQuestions: Question[]) => {
        const questionsPayload = chunkQuestions.map((q, idx) => ({
            id: q.id,
            index: idx + 1,
            text: (q.text || '').slice(0, 300)
        }));

        const prompt = `Bạn là chuyên gia giáo dục và giáo viên Vật lý THPT giàu kinh nghiệm theo chương trình GDPT 2018.
DƯỚI ĐÂY LÀ DANH SÁCH CÁC CHƯƠNG HỌC:
${chapterListText}

DƯỚI ĐÂY LÀ DANH SÁCH CÂU HỎI CẦN PHÂN LOẠI:
${JSON.stringify(questionsPayload, null, 2)}

NHIỆM VỤ:
1. Đọc kỹ nội dung kiến thức, công thức và chủ đề của từng câu hỏi.
2. Xác định câu hỏi đó thuộc CHƯƠNG HỌC nào phù hợp nhất trong danh sách các chương trên.
3. Chỉ chọn chính xác tên chương và mã chương có trong danh sách trên.
4. Trả về mảng JSON thuần túy (không kèm giải thích):
[
  { "id": "id_câu_hỏi", "chapterId": "mã_chương", "chapterName": "tên_chương_chính_xác" }
]
`;

        const generateWithFallback = async (modelName: string) => {
            return await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                chapterId: { type: Type.STRING },
                                chapterName: { type: Type.STRING }
                            },
                            required: ["id", "chapterName"]
                        }
                    }
                }
            });
        };

        let response;
        try {
            response = await generateWithFallback('gemini-3-flash-preview');
        } catch (e1: any) {
            console.warn("gemini-3-flash-preview lỗi, chuyển sang gemini-2.5-flash:", e1?.message);
            response = await generateWithFallback('gemini-2.5-flash');
        }

        const textOutput = response.text || "[]";
        const result = JSON.parse(cleanJsonString(textOutput));
        return Array.isArray(result) ? result : [];
    };

    try {
        const chunkResults = await Promise.all(chunks.map(chunk => processChunk(chunk)));
        return chunkResults.flat();
    } catch (err: any) {
        console.error("Lỗi AI phân loại chương:", err);
        throw new Error("Không thể phân loại chương bằng AI: " + (err.message || "Lỗi kết nối AI"));
    }
};

/**
 * AI tự động tạo bổ sung câu hỏi cho một Chương và Mức độ cụ thể khi Ngân hàng câu hỏi bị thiếu
 */
export const generateMissingQuestionsForChapter = async (
    grade: string,
    chapterName: string,
    level: 'B' | 'H' | 'VD' | 'VDC',
    count: number,
    existingSampleTexts: string[] = [],
    questionType: QuestionType = 'mcq'
): Promise<Question[]> => {
    if (count <= 0) return [];
    const ai = getAIClient();

    const levelTextMap: Record<string, string> = {
        'B': 'Nhận biết (dễ, kiểm tra định nghĩa, công thức cơ bản)',
        'H': 'Thông hiểu (trung bình, giải thích hiện tượng, biến đổi công thức đơn giản)',
        'VD': 'Vận dụng (bài tập tính toán, áp dụng công thức 1-2 bước)',
        'VDC': 'Vận dụng cao (bài toán thực tiễn, phân tích đồ thị, bài toán tổng hợp nhiều bước)'
    };

    const levelName = levelTextMap[level] || 'Thông hiểu';

    let typePromptDesc = '';
    let jsonFormatDesc = '';

    if (questionType === 'group-tf') {
        typePromptDesc = `Dạng câu hỏi: Trắc nghiệm Đúng / Sai (Phần II cấu trúc Bộ GD&ĐT 2025/2018).
Mỗi câu hỏi có 1 phần dẫn chung (text) và đúng 4 ý con a, b, c, d (subQuestions), mỗi ý chỉ định correctAnswer là 'True' hoặc 'False'.`;
        jsonFormatDesc = `[
  {
    "type": "group-tf",
    "text": "Lời dẫn hoặc bối cảnh thí nghiệm/bài toán...",
    "level": "${level}",
    "subQuestions": [
      { "text": "Ý a...", "correctAnswer": "True" },
      { "text": "Ý b...", "correctAnswer": "False" },
      { "text": "Ý c...", "correctAnswer": "True" },
      { "text": "Ý d...", "correctAnswer": "False" }
    ],
    "solution": "Lời giải chi tiết từng ý a, b, c, d...",
    "chapterName": "${chapterName}"
  }
]`;
    } else if (questionType === 'short') {
        typePromptDesc = `Dạng câu hỏi: Trắc nghiệm Trả lời ngắn (Phần III cấu trúc Bộ GD&ĐT 2025/2018).
Học sinh phải điền đáp án số hoặc kết quả ngắn gọn vào ô (correctAnswer là giá trị số, ví dụ "15" hoặc "2.5" hoặc "-4").`;
        jsonFormatDesc = `[
  {
    "type": "short",
    "text": "Nội dung bài toán yêu cầu tìm giá trị đại lượng...",
    "level": "${level}",
    "correctAnswer": "12.5",
    "solution": "Lời giải chi tiết các bước tính toán...",
    "chapterName": "${chapterName}"
  }
]`;
    } else {
        typePromptDesc = `Dạng câu hỏi: Trắc nghiệm 4 lựa chọn A, B, C, D (Phần I cấu trúc Bộ GD&ĐT).
Có đúng 4 phương án A, B, C, D, chỉ có duy nhất 1 phương án đúng.`;
        jsonFormatDesc = `[
  {
    "type": "mcq",
    "text": "Nội dung câu hỏi...",
    "level": "${level}",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A",
    "solution": "Lời giải chi tiết...",
    "chapterName": "${chapterName}"
  }
]`;
    }

    const prompt = `Bạn là giáo viên chuyên gia Vật lý THPT Việt Nam theo chương trình GDPT 2018.
HÃY SOẠN ĐÚNG ${count} CÂU HỎI VẬT LÝ VỚI YÊU CẦU:
- Khối lớp: Lớp ${grade}
- Chương kiến thức: ${chapterName}
- ${typePromptDesc}
- Mức độ nhận thức: ${levelName} (Mã: "${level}")
- Yêu cầu kỹ thuật:
  1. Sử dụng ký hiệu công thức LaTeX chuẩn đặt trong dấu $...$ (VD: $v = \\omega A$, $\\lambda = \\frac{v}{f}$).
  2. Có đáp án chính xác rõ ràng và lời giải chi tiết, chuẩn xác về mặt khoa học.
  3. Tránh trùng lặp với các câu hỏi sau: ${JSON.stringify(existingSampleTexts.slice(0, 5))}

TRẢ VỀ MẢNG JSON CẤU TRÚC:
${jsonFormatDesc}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const textOutput = response.text || "[]";
        const rawData = JSON.parse(cleanJsonString(textOutput));
        const processed = processAIQuestions(rawData);
        return processed.map(q => ({
            ...q,
            type: questionType,
            chapterName: chapterName,
            level: level,
            quizGrade: grade as Grade
        }));
    } catch (err: any) {
        console.error("Lỗi AI sinh bù câu hỏi cho ma trận:", err);
        return [];
    }
};

