
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Grade } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
};

const stripOptionLabel = (text: string): string => {
    if (!text) return "";
    // Xử lý đệ quy để xóa nhiều lớp nhãn (VD: "A. A. Nội dung")
    let cleaned = text.trim();
    const labelRegex = /^(\*?[A-Za-z0-9][\.\)\/\-:\s]\s*)/g;
    
    while (labelRegex.test(cleaned)) {
        cleaned = cleaned.replace(labelRegex, "").trim();
    }
    return cleaned;
};

const EXTRACTION_INSTRUCTION = `Bạn là chuyên gia trích xuất đề thi THPT quốc gia Việt Nam (Toán, Lý, Hóa).
NHIỆM VỤ: Chuyển đổi nội dung được cung cấp thành danh sách JSON chuẩn.

QUY TẮC TRÍCH XUẤT (CỰC KỲ QUAN TRỌNG):
1. PHÂN TÍCH ĐÁP ÁN: Quét toàn bộ nội dung để tìm bảng đáp án (thường ở cuối).
2. MCQ (Trắc nghiệm 4 lựa chọn):
   - 'correctAnswer': BẮT BUỘC điền nội dung của phương án đúng (không kèm nhãn A, B...).
   - LaTeX: Mọi phương án nếu chứa ký hiệu toán học BẮT BUỘC phải bọc trong $...$. (VD: "$x^2$").
3. GROUP-TF (Đúng/Sai):
   - 'subQuestions': Phải có đủ 4 ý.
   - 'solution': BẮT BUỘC giải thích chi tiết cho cả 4 ý theo mẫu: a) Đúng... b) Sai...
4. SHORT (Trả lời ngắn):
   - 'type': BẮT BUỘC là "short".
   - 'correctAnswer': BẮT BUỘC là giá trị số (VD: "12", "0.5").
   - 'options': Để null hoặc [].
5. LaTeX: Mọi công thức toán học phải bọc trong $...$ (VD: $x^2 + y^2 = R^2$). Giữ nguyên dấu $ trong cả nội dung câu hỏi và các phương án.
6. LÀM SẠCH: Xóa nhãn "A.", "B.", "a)", "b)" ở đầu nội dung nhưng giữ lại dấu $ của LaTeX.

VÍ DỤ CẤU TRÚC:
- MCQ: {"type": "mcq", "text": "Câu 1...", "options": ["$1$", "$2$", "$3$", "$4$"], "correctAnswer": "$1$", "solution": "..."}
- GROUP-TF: {"type": "group-tf", "text": "Câu 2...", "subQuestions": [{"text": "...", "correctAnswer": "True"}, ...], "solution": "a) Đúng... b) Sai..."}
- SHORT: {"type": "short", "text": "Câu 3...", "correctAnswer": "12.5", "solution": "..."}
`;

const processAIQuestions = (rawData: any[]): Question[] => {
    return rawData.map((item: any) => {
        const type = item.type?.toLowerCase() || 'mcq';
        const strippedOptions = item.options ? item.options.map((opt: string) => stripOptionLabel(opt)) : (type === 'mcq' ? [] : undefined);
        let finalCorrectAnswer = item.correctAnswer;

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
            id: uuidv4(),
            points: item.points || (type === 'mcq' ? 0.25 : type === 'group-tf' ? 1.0 : 0.5),
            options: strippedOptions,
            correctAnswer: finalCorrectAnswer,
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
                ...sq, 
                id: uuidv4(),
                text: stripOptionLabel(sq.text),
                correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ' || sq.correctAnswer === 'T' || sq.correctAnswer === 'true' || sq.correctAnswer === '1') ? 'True' : 'False'
            })) : undefined
        };
    });
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
                                        correctAnswer: { type: Type.STRING }
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
                                correctAnswer: { type: Type.STRING }
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
        if (parsed.title || parsed.quizTitle || parsed.name) {
            quizTitle = parsed.title || parsed.quizTitle || parsed.name;
        }
        if (parsed.grade) grade = String(parsed.grade) as Grade;
        if (parsed.category || parsed.subject) category = parsed.category || parsed.subject;
        if (parsed.durationMinutes || parsed.duration || parsed.timeLimit) durationMinutes = Number(parsed.durationMinutes || parsed.duration || parsed.timeLimit);

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

    if (!rawQuestions || rawQuestions.length === 0) {
        throw new Error("Không tìm thấy danh sách câu hỏi hợp lệ trong dữ liệu JSON!");
    }

    const normalizedRaw = rawQuestions.map((q: any) => {
        let typeStr = (q.type || q.questionType || '').toLowerCase().trim();
        let type = 'mcq';
        if (typeStr === 'mc' || typeStr.includes('mcq') || typeStr.includes('trac_nghiem') || typeStr.includes('multiple')) {
            type = 'mcq';
        } else if (typeStr === 'tf' || typeStr.includes('group') || typeStr.includes('dung_sai') || typeStr.includes('true_false')) {
            type = 'group-tf';
        } else if (typeStr === 'sa' || typeStr.includes('short') || typeStr.includes('ngan') || typeStr.includes('tra_loi')) {
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

        const rawOptionsArray = q.options || q.choices || q.phuong_an || q.dap_an_lua_chon || q.answers;

        let subQuestions = q.subQuestions || q.sub_questions || q.statements || q.y_con;
        
        // Trường hợp câu hỏi Đúng/Sai (TF) mà danh sách mệnh đề nằm trong q.options
        if (type === 'group-tf' && !subQuestions && Array.isArray(rawOptionsArray)) {
            subQuestions = rawOptionsArray;
        }

        if (Array.isArray(subQuestions)) {
            subQuestions = subQuestions.map((sq: any) => {
                let ans = sq.correctAnswer ?? sq.answer ?? sq.dap_an ?? sq.isTrue ?? sq.isCorrect ?? sq.correct;
                if (ans === true || ans === 'True' || ans === 'true' || ans === 'Đ' || ans === 'Đúng' || ans === '1') {
                    ans = 'True';
                } else {
                    ans = 'False';
                }
                const sqText = sq.text || sq.content || sq.noi_dung || '';
                return {
                    text: sqText.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$'),
                    correctAnswer: ans
                };
            });
        }

        let options: string[] | undefined = undefined;
        let correctAnswer = q.correctAnswer || q.answer || q.correct || q.dap_an_dung || q.dap_an || '';

        if (type === 'mcq' && Array.isArray(rawOptionsArray)) {
            options = rawOptionsArray.map((opt: any) => {
                const str = typeof opt === 'string' ? opt : (opt.text || opt.content || opt.label || String(opt));
                return str.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$');
            });

            // Tìm đáp án đúng nếu nằm trong thuộc tính isCorrect của option object
            if (!correctAnswer) {
                const correctObj = rawOptionsArray.find((opt: any) => typeof opt === 'object' && (opt.isCorrect === true || opt.is_correct === true || opt.correct === true));
                if (correctObj) {
                    const str = typeof correctObj === 'string' ? correctObj : (correctObj.text || correctObj.content || correctObj.label || String(correctObj));
                    correctAnswer = str.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$');
                } else {
                    const idx = q.correctOptionIndex ?? q.correct_option_index ?? q.correctIndex ?? q.correct_index ?? q.answerIndex;
                    if (typeof idx === 'number' && idx >= 0 && idx < options.length) {
                        correctAnswer = options[idx];
                    }
                }
            }
        }

        const rawText = q.text || q.question || q.content || q.cau_hoi || q.title || '';
        const rawSolution = q.solution || q.explanation || q.loi_giai || q.huong_dan_giai || q.guide || '';

        return {
            ...q,
            type,
            text: rawText.replace(/\\\(|\\\)/g, '$').replace(/\\\[|\\\]/g, '$$'),
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `${EXTRACTION_INSTRUCTION}\n\nNỘI DUNG VĂN BẢN CẦN TRÍCH XUẤT:\n${rawText}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING },
                            text: { type: Type.STRING },
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
                                        correctAnswer: { type: Type.STRING }
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
