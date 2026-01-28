
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
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
2. Solution (Lời giải): Phải có lời giải chi tiết, bọc công thức trong $...$.
3. Cấu trúc JSON phải chuẩn xác.`;

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
        
        return rawData.map((item: any) => ({
            ...item,
            id: uuidv4(),
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
                ...sq, 
                id: uuidv4(),
                correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
            })) : undefined
        }));
    } catch (error: any) {
        throw new Error("AI không thể tạo đề: " + error.message);
    }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Hãy đóng vai chuyên gia trích xuất đề thi THPT môn Vật Lý/Toán học.
Phân tích file PDF này và trả về JSON chuẩn.

QUY TẮC NHẬN DIỆN ĐÁP ÁN ĐÚNG:
1. Trong file PDF, phương án nào bắt đầu bằng dấu "*" (Ví dụ: *D. lực từ..., *A. 2,5 cm) thì đó là đáp án ĐÚNG (correctAnswer).
2. Hãy lấy nội dung phương án đó (bỏ dấu *) lưu vào correctAnswer.
3. Nếu là câu Đúng/Sai (Phần II), xác định Đ/S cho từng ý a,b,c,d.
4. Mọi ký hiệu khoa học ($B$, $r$, $10^{-7}$, $\pi$, $\Omega$) phải bọc trong LaTeX $...$.
5. Trích xuất cả phần "Lời giải" nếu có.`;

  try {
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
    
    return rawData.map((item: any) => ({
        ...item,
        id: uuidv4(),
        points: item.points || (item.type === 'mcq' ? 0.25 : 1.0),
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
            ...sq, 
            id: uuidv4(),
            correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
        })) : undefined
    }));
  } catch (error: any) {
    throw new Error("Lỗi đọc PDF: " + error.message);
  }
};
