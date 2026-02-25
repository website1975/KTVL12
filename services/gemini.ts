
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
};

const stripOptionLabel = (text: string): string => {
    if (!text) return "";
    return text.replace(/^(\*?[A-Za-z0-9][\.\)\/\-]\s*)/g, "").trim();
};

const EXTRACTION_INSTRUCTION = `Bạn là chuyên gia trích xuất đề thi THPT quốc gia Việt Nam (Toán, Lý, Hóa).
NHIỆM VỤ: Chuyển đổi nội dung được cung cấp thành danh sách JSON chuẩn 3 phần:
1. 'mcq': Trắc nghiệm 4 lựa chọn.
2. 'group-tf': Trắc nghiệm Đúng/Sai (thường có 4 ý a,b,c,d).
3. 'short': Trắc nghiệm trả lời ngắn (điền số).

QUY TẮC TRÍCH XUẤT ĐÁP ÁN VÀ LỜI GIẢI (CỰC KỲ QUAN TRỌNG):
- ƯU TIÊN TUYỆT ĐỐI ĐÁP ÁN CÓ SẴN: Quét toàn bộ nội dung để tìm đáp án hoặc lời giải của tác giả (VD: "Đáp án: A", "Chọn A", "1-A, 2-C...", "Lời giải:...", "Giải:...", "Hướng dẫn:...").
- Nếu tìm thấy đáp án/lời giải trong tài liệu, BẮT BUỘC phải lấy dữ liệu đó. Tuyệt đối không được tự ý giải lại nếu tài liệu đã có đáp án.
- CHỈ KHI KHÔNG CÓ ĐÁP ÁN: Nếu tài liệu hoàn toàn không đề cập đến đáp án hay hướng dẫn giải, bạn mới được thực hiện giải toán và cung cấp lời giải của riêng mình.
- LaTeX: Mọi công thức, ký hiệu toán học phải bọc trong $...$.
- LÀM SẠCH: Xóa bỏ các nhãn "A.", "B.", "a)", "b)" ở đầu nội dung phương án/ý hỏi.

QUY TẮC RIÊNG CHO TỪNG LOẠI CÂU HỎI:
- MCQ: BẮT BUỘC phải có 'correctAnswer'. Nếu tài liệu không đánh dấu trực tiếp (như dấu sao *), hãy dựa vào 'solution' hoặc nội dung câu hỏi để xác định đáp án đúng và điền vào 'correctAnswer'.
- GROUP-TF: BẮT BUỘC phải có 'solution' chi tiết cho từng ý a, b, c, d. Lời giải phải trình bày theo định dạng sau:
  a) [Đúng/Sai] : Vì [Giải thích chi tiết]
  b) [Đúng/Sai] : Vì [Giải thích chi tiết]
  c) [Đúng/Sai] : Vì [Giải thích chi tiết]
  d) [Đúng/Sai] : Vì [Giải thích chi tiết]
- SHORT: 'correctAnswer' phải là con số cụ thể.`;

const processAIQuestions = (rawData: any[]): Question[] => {
    return rawData.map((item: any) => {
        const strippedOptions = item.options ? item.options.map((opt: string) => stripOptionLabel(opt)) : undefined;
        let finalCorrectAnswer = item.correctAnswer;

        if (item.type === 'mcq' && item.correctAnswer && item.options) {
            const label = item.correctAnswer.trim().toUpperCase().replace(/[\.\)\:\s]/g, "");
            // Nếu AI trả về nhãn (A, B, C, D) thay vì nội dung đầy đủ
            if (label.length === 1 && /^[A-D]$/.test(label)) {
                const index = label.charCodeAt(0) - 65;
                if (item.options[index]) {
                    finalCorrectAnswer = stripOptionLabel(item.options[index]);
                }
            } else {
                finalCorrectAnswer = stripOptionLabel(item.correctAnswer);
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
                correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ' || sq.correctAnswer === 'T' || sq.correctAnswer === 'true') ? 'True' : 'False'
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
1. LaTeX: Mọi biểu thức, ký hiệu toán/lý (VD: $\Delta\Phi$, $\Omega$, $x^2$) BẮT BUỘC nằm trong $...$. 
2. Solution (Lời giải): Phải có lời giải chi tiết cho từng câu, bọc công thức trong $...$.
3. MCQ: Phải xác định rõ 'correctAnswer' và điền vào.
4. GROUP-TF: 'solution' phải giải thích chi tiết cho từng ý a, b, c, d theo định dạng:
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
                    solution: { type: Type.STRING, nullable: true },
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
                required: ["type", "text"]
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
                            solution: { type: Type.STRING, nullable: true },
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
                        required: ["type", "text"]
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
