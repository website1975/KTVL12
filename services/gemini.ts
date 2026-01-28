
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Bạn là chuyên gia soạn đề Toán lớp ${config.grade} Việt Nam.
Sử dụng model: gemini-3-flash-preview.
Chủ đề: ${config.topic}.
Số lượng: ${config.part1Count} câu mcq, ${config.part2Count} câu group-tf, ${config.part3Count} câu short.

QUY TẮC BẮT BUỘC:
1. LaTeX: Mọi biểu thức, con số, biến số toán học BẮT BUỘC nằm trong $...$. Ví dụ: $x = \frac{1}{2}$.
2. Solution (Lời giải): Phải có lời giải chi tiết cho từng câu, bọc công thức toán trong $...$.
3. Cấu trúc Phần I (mcq): 4 phương án.
4. Cấu trúc Phần II (group-tf): 4 ý a,b,c,d chọn True/False.
5. Cấu trúc Phần III (short): Đáp án là số.`;

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
  
  const prompt = `Phân tích file PDF đề thi Toán THPT sau đây.
Sử dụng model: gemini-3-flash-preview.

QUY TẮC NHẬN DIỆN (CỰC KỲ QUAN TRỌNG):
1. PHẦN I (Trắc nghiệm): Tìm dấu "*" ở đầu phương án (VD: *A. Đáp án, *B...). 
   - Nếu thấy dấu "*", phương án đó là correctAnswer. 
   - Khi lưu vào JSON, hãy BỎ dấu "*" đi nhưng lưu text đó vào correctAnswer.
2. LỜI GIẢI (Solution): 
   - Tìm đoạn văn sau chữ "Lời giải:" hoặc "Hướng dẫn giải:".
   - Trích xuất toàn bộ lời giải này.
   - BẮT BUỘC bọc tất cả công thức toán học trong lời giải vào cặp dấu $...$.
3. PHẦN II (Đúng/Sai): Xác định 4 ý a,b,c,d và đáp án True/False.
4. PHẦN III (Ngắn): Lấy nội dung câu hỏi và đáp số.

Mọi ký hiệu toán học ở bất kỳ đâu đều phải dùng LaTeX $...$.`;

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
