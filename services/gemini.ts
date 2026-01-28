
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
1. Công thức Toán học: Mọi ký hiệu toán học, biến số (x, y, z...), con số trong biểu thức, các phép toán BẮT BUỘC phải nằm trong cặp dấu $...$ (LaTeX). Ví dụ: $x = 2$, $f(x) = x^2 + 1$.
2. Dạng mcq (Phần I): 4 phương án, 1 đáp án đúng duy nhất.
3. Dạng group-tf (Phần II): Mỗi câu có 4 ý con (a, b, c, d), mỗi ý chọn "True" (Đúng) hoặc "False" (Sai).
4. Dạng short (Phần III): Đáp án đúng phải là một con số cụ thể.
5. Giải thích (solution): Cung cấp lời giải chi tiết, mọi công thức trong lời giải phải nằm trong $...$.

Trả về một mảng JSON các đối tượng câu hỏi.`;

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
                            options: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING }, 
                                nullable: true 
                            },
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
                correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === true || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
            })) : undefined
        }));
    } catch (error: any) {
        throw new Error(error.message || "AI gặp lỗi khi tạo câu hỏi.");
    }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Bạn là trợ lý phân tích đề thi Toán THPT Việt Nam. Hãy trích xuất file PDF này sang JSON.

QUY TẮC NHẬN DIỆN ĐÁP ÁN ĐÚNG (CỰC KỲ QUAN TRỌNG):
1. Với Trắc nghiệm (Phần I): 
   - Nếu thấy một phương án bắt đầu bằng dấu sao (Ví dụ: *A. Nội dung, *B, *C., *D), hãy hiểu đó là ĐÁP ÁN ĐÚNG.
   - Trích xuất nội dung phương án đó (bỏ dấu *) vào correctAnswer.
   - Giữ nguyên các phương án còn lại trong mảng options.
2. Với Đúng/Sai (Phần II):
   - Trích xuất nội dung 4 ý a, b, c, d và xác định Đúng (True) / Sai (False).
3. Lời giải (Solution):
   - Nếu trong PDF có phần "Lời giải" hoặc "Giải thích", hãy trích xuất toàn bộ.
   - Mọi công thức toán trong lời giải BẮT BUỘC phải bọc trong $...$.

Yêu cầu kỹ thuật:
- Sử dụng LaTeX $...$ cho tất cả ký hiệu toán học ở mọi trường dữ liệu.
- Phân loại đúng type: 'mcq', 'group-tf', 'short'.`;

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
        // Áp dụng điểm mặc định chuẩn theo yêu cầu của bác nếu AI không lấy được
        points: item.points || (item.type === 'mcq' ? 0.25 : 1.0),
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
            ...sq, 
            id: uuidv4(),
            correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === true || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
        })) : undefined
    }));
  } catch (error: any) {
    throw new Error(error.message || "Lỗi xử lý PDF.");
  }
};
