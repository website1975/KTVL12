
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
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
   - Nếu tài liệu chỉ ghi "1.A", hãy lấy nội dung của phương án A gán vào 'correctAnswer'.
3. GROUP-TF (Đúng/Sai):
   - 'subQuestions': Phải có đủ 4 ý.
   - 'solution': BẮT BUỘC giải thích chi tiết cho cả 4 ý theo mẫu:
     a) [Đúng/Sai] : Vì [Giải thích]
     b) [Đúng/Sai] : Vì [Giải thích]
     c) [Đúng/Sai] : Vì [Giải thích]
     d) [Đúng/Sai] : Vì [Giải thích]
4. LaTeX: Mọi công thức toán học phải bọc trong $...$ (VD: $x^2 + y^2 = R^2$). Giữ nguyên dấu $ trong cả nội dung câu hỏi và các phương án.
5. LÀM SẠCH: Xóa nhãn "A.", "B.", "a)", "b)" ở đầu nội dung nhưng giữ lại dấu $ của LaTeX.

VÍ DỤ CẤU TRÚC GROUP-TF:
{
  "type": "group-tf",
  "text": "Cho hàm số $y=f(x)$...",
  "subQuestions": [
    {"text": "Hàm số đồng biến trên...", "correctAnswer": "True"},
    {"text": "Hàm số có cực đại tại...", "correctAnswer": "False"}
  ],
  "solution": "a) Đúng : Vì đạo hàm $f'(x) > 0$...\\nb) Sai : Vì tại $x=1$ là điểm cực tiểu..."
}`;

const processAIQuestions = (rawData: any[]): Question[] => {
    return rawData.map((item: any) => {
        const strippedOptions = item.options ? item.options.map((opt: string) => stripOptionLabel(opt)) : undefined;
        let finalCorrectAnswer = item.correctAnswer;

        if (item.type === 'mcq' && item.correctAnswer && item.options) {
            let ansText = item.correctAnswer.trim();
            
            // Tìm nhãn A, B, C, D trong chuỗi đáp án
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
        if (item.type === 'mcq' && strippedOptions && finalCorrectAnswer) {
            const cleanAns = stripOptionLabel(finalCorrectAnswer);
            // Ưu tiên khớp chính xác
            const exactMatch = strippedOptions.find((opt: string) => stripOptionLabel(opt) === cleanAns);
            if (exactMatch) {
                finalCorrectAnswer = exactMatch;
            } else {
                // Khớp mờ nếu không tìm thấy chính xác
                const fuzzyMatch = strippedOptions.find((opt: string) => {
                    const cleanOpt = stripOptionLabel(opt);
                    return cleanOpt.includes(cleanAns) || cleanAns.includes(cleanOpt);
                });
                if (fuzzyMatch) finalCorrectAnswer = fuzzyMatch;
            }
        }

        return {
            ...item,
            id: uuidv4(),
            points: item.points || (item.type === 'mcq' ? 0.25 : item.type === 'group-tf' ? 1.0 : 0.5),
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
    
    const prompt = `Bạn là chuyên gia soạn đề thi THPT quốc gia Việt Nam môn Toán/Lý/Hóa.
Sử dụng model: gemini-3-flash-preview.
Chủ đề: ${config.topic}.
Khối: ${config.grade}.
Số lượng: ${config.part1Count} câu mcq, ${config.part2Count} câu group-tf, ${config.part3Count} câu short.

QUY TẮC BẮT BUỘC:
1. LaTeX: Mọi biểu thức, ký hiệu toán/lý (VD: $\Delta\Phi$, $\Omega$, $x^2$) BẮT BUỘC nằm trong $...$. Quy tắc này áp dụng cho cả nội dung câu hỏi, LỜI GIẢI và CÁC PHƯƠNG ÁN (Options).
2. Solution (Lời giải): Phải có lời giải chi tiết cho từng câu, bọc công thức trong $...$.
3. MCQ: Phải xác định rõ 'correctAnswer' (A, B, C hoặc D) và điền nội dung tương ứng vào 'correctAnswer'.
4. GROUP-TF: 
   - 'subQuestions' phải có 4 ý.
   - 'solution' phải giải thích chi tiết cho từng ý a, b, c, d theo định dạng:
     a) [Đúng/Sai] : Vì [Giải thích]
     b) [Đúng/Sai] : Vì [Giải thích]
     c) [Đúng/Sai] : Vì [Giải thích]
     d) [Đúng/Sai] : Vì [Giải thích]
5. Options: Tuyệt đối KHÔNG bao gồm nhãn "A.", "B." vào nội dung phương án.
6. Cấu trúc JSON phải chuẩn xác theo schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
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
