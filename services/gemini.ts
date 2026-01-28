
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Bạn là chuyên gia soạn đề Toán lớp ${config.grade} Việt Nam theo cấu trúc mới của Bộ GD&ĐT.
Chủ đề: ${config.topic}.
Yêu cầu số lượng: ${config.part1Count} câu mcq (Phần I), ${config.part2Count} câu group-tf (Phần II), ${config.part3Count} câu short (Phần III).

Quy tắc bắt buộc:
1. Công thức Toán học: Luôn nằm trong cặp dấu $...$ (LaTeX). Ví dụ: $x^2 + \sqrt{y}$.
2. Dạng mcq (Phần I): 4 phương án, 1 đáp án đúng duy nhất.
3. Dạng group-tf (Phần II): Mỗi câu có 4 ý con (a, b, c, d), mỗi ý chọn "True" (Đúng) hoặc "False" (Sai).
4. Dạng short (Phần III): Đáp án đúng phải là một con số cụ thể.
5. Giải thích: Cung cấp giải thích ngắn gọn vào trường solution.

Trả về một mảng JSON các đối tượng câu hỏi.`;

    try {
        // Thống nhất sử dụng gemini-3-flash-preview theo yêu cầu
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
                            type: { 
                                type: Type.STRING, 
                                description: "Kiểu câu hỏi: 'mcq' cho phần I, 'group-tf' cho phần II, 'short' cho phần III" 
                            },
                            text: { type: Type.STRING, description: "Nội dung câu hỏi, chứa LaTeX $...$" },
                            points: { type: Type.NUMBER },
                            options: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING }, 
                                description: "Mảng 4 phương án cho mcq",
                                nullable: true 
                            },
                            correctAnswer: { 
                                type: Type.STRING, 
                                description: "Đáp án đúng cho mcq (text phương án) hoặc giá trị số cho short",
                                nullable: true 
                            },
                            solution: { type: Type.STRING, description: "Lời giải chi tiết chứa LaTeX" },
                            subQuestions: {
                                type: Type.ARRAY,
                                description: "Dành cho group-tf, mảng 4 ý a,b,c,d",
                                nullable: true,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        text: { type: Type.STRING },
                                        correctAnswer: { 
                                            type: Type.STRING, 
                                            description: "Giá trị bắt buộc là 'True' hoặc 'False'" 
                                        }
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
        
        return rawData.map((item: any) => ({
            ...item,
            id: uuidv4(),
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
                ...sq, 
                id: uuidv4(),
                // Đảm bảo correctAnswer luôn là True/False chuẩn
                correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === true || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
            })) : undefined
        }));
    } catch (error: any) {
        console.error("Lỗi Gemini Generate:", error);
        throw new Error(error.message || "AI gặp lỗi khi tạo câu hỏi. Hãy thử lại.");
    }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Bạn là một trợ lý phân tích đề thi Toán chuyên nghiệp. Hãy trích xuất dữ liệu từ file PDF đề thi Toán sau đây sang định dạng JSON mảng câu hỏi.

Quy tắc nhận diện cấu trúc đề Toán Việt Nam:
1. PHẦN I (Trắc nghiệm nhiều lựa chọn):
   - Nhận diện các phương án A, B, C, D.
   - Nếu có ký hiệu đặc biệt như dấu sao (*), in đậm, hoặc gạch chân tại một phương án (ví dụ *A., B., C., D.), hãy hiểu đó là correctAnswer.
   - Gán type = "mcq".

2. PHẦN II (Trắc nghiệm Đúng/Sai):
   - Mỗi câu gồm 4 ý a), b), c), d).
   - Xác định xem mỗi ý là Đúng (True) hay Sai (False).
   - Gán type = "group-tf".

3. PHẦN III (Trả lời ngắn):
   - Trích xuất câu hỏi và tìm đáp án số ở cuối bài.
   - Gán type = "short".

Yêu cầu kỹ thuật:
- Sử dụng LaTeX $...$ cho tất cả các công thức toán học.
- Đảm bảo JSON đầu ra tuân thủ nghiêm ngặt schema đã định nghĩa.`;

  try {
    // Chuyển sang sử dụng gemini-3-flash-preview
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
          parts: [
              { inlineData: { mimeType: "application/pdf", data: base64Data } },
              { text: prompt }
          ]
      },
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, description: "'mcq' | 'group-tf' | 'short'" },
                    text: { type: Type.STRING },
                    points: { type: Type.NUMBER },
                    options: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING }, 
                        nullable: true 
                    },
                    correctAnswer: { type: Type.STRING, nullable: true },
                    solution: { type: Type.STRING, nullable: true },
                    subQuestions: {
                        type: Type.ARRAY,
                        nullable: true,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                correctAnswer: { type: Type.STRING, description: "Phải là 'True' hoặc 'False'" }
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
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error("AI không tìm thấy hoặc không thể đọc được nội dung câu hỏi từ PDF này.");
    }

    return rawData.map((item: any) => ({
        ...item,
        id: uuidv4(),
        // Gán điểm mặc định nếu AI không trích xuất được
        points: item.points || (item.type === 'mcq' ? 0.25 : 1.0),
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
            ...sq, 
            id: uuidv4(),
            correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === true || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
        })) : undefined
    }));
  } catch (error: any) {
    console.error("Lỗi Gemini PDF:", error);
    if (error.message?.includes('429')) {
        throw new Error("Hạn mức AI miễn phí tạm thời hết. Vui lòng đợi 1 phút.");
    }
    throw new Error(error.message || "Lỗi khi xử lý PDF.");
  }
};
