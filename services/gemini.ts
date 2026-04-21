
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
