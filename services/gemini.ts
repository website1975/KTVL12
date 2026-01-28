
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
  
  const prompt = `HÃY PHÂN TÍCH TOÀN BỘ FILE PDF ĐỀ THI VẬT LÝ/TOÁN HỌC NÀY.
Đây là đề thi chuẩn cấu trúc mới của Bộ GD&ĐT Việt Nam.

QUY TẮC TRÍCH XUẤT (BẮT BUỘC):
1. PHẦN I (4 lựa chọn): Nhận diện dấu hiệu "*" ở đầu phương án để xác định correctAnswer (VD: *D. Lực từ...).
2. PHẦN II (Đúng/Sai): Nhận diện ký hiệu (Đ) hoặc (S) ở cuối mỗi ý a,b,c,d để gán correctAnswer là "True" hoặc "False".
3. PHẦN III (Trả lời ngắn): Tìm nội dung sau chữ "Đáp án:" hoặc "Kết quả:".
4. LATEX: Bọc tất cả công thức vật lý ($\Delta\Phi$, $\pi$, $\Omega$, $10^{-7}$) vào dấu $...$.
5. LỜI GIẢI: Trích xuất toàn bộ lời giải chi tiết nếu có trong file.

HÃY ĐẢM BẢO KHÔNG BỎ SÓT BẤT KỲ CÂU NÀO TRONG TẤT CẢ CÁC TRANG.`;

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
                    type: { type: Type.STRING, description: "Phải là 'mcq', 'group-tf' hoặc 'short'" },
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
                                correctAnswer: { type: Type.STRING, description: "Chỉ được là 'True' hoặc 'False'" }
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
        points: item.points || (item.type === 'mcq' ? 0.25 : item.type === 'group-tf' ? 1.0 : 0.5),
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
            ...sq, 
            id: uuidv4(),
            correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ' || sq.correctAnswer === 'true') ? 'True' : 'False'
        })) : undefined
    }));
  } catch (error: any) {
    console.error("Lỗi AI trích xuất:", error);
    throw new Error("Lỗi đọc PDF: " + error.message);
  }
};
