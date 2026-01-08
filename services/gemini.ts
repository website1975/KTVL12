
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/g, "").replace(/```/g, "").trim();
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Nhiệm vụ: Chuyển đổi đề thi Toán từ nội dung PDF sang định dạng JSON mảng.
    Cấu trúc yêu cầu cho mỗi đối tượng trong mảng JSON:
    {
      "type": "mcq" | "group-tf" | "short",
      "text": "Nội dung câu hỏi (sử dụng LaTeX $...$ cho công thức)",
      "points": 0.25,
      "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"], 
      "correctAnswer": "nội dung chính xác của đáp án", 
      "solution": "Hướng dẫn giải chi tiết",
      "subQuestions": [ 
        { "text": "Nội dung ý a", "correctAnswer": "True" | "False" },
        { "text": "Nội dung ý b", "correctAnswer": "True" | "False" },
        { "text": "Nội dung ý c", "correctAnswer": "True" | "False" },
        { "text": "Nội dung ý d", "correctAnswer": "True" | "False" }
      ]
    }
    
    Quy tắc quan trọng nhất để hiển thị được trên UI:
    1. TRƯỜNG 'type': CHỈ được phép là một trong ba giá trị viết thường: "mcq", "group-tf", hoặc "short". 
       - Nếu là câu chọn 1 đáp án A,B,C,D -> dùng "mcq".
       - Nếu là câu Đúng/Sai có 4 ý -> dùng "group-tf".
       - Nếu là câu điền số/trả lời ngắn -> dùng "short".
    2. TRƯỜNG 'text': Không bao gồm tiền tố "Câu 1:", "Bài 1:".
    3. Công thức Toán phải bọc trong cặp dấu $ ví dụ: $x^2 + 2x + 1 = 0$.
    4. Phải đảm bảo trả về ĐÚNG cấu trúc JSON mảng.
    TRẢ VỀ DUY NHẤT MẢNG JSON, KHÔNG GIẢI THÍCH THÊM.
  `;

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
        responseMimeType: "application/json"
      }
    });

    const textOutput = response.text || "[]";
    let rawData = JSON.parse(cleanJsonString(textOutput));
    
    if (!Array.isArray(rawData)) {
        if (rawData.questions && Array.isArray(rawData.questions)) {
            rawData = rawData.questions;
        } else {
            return [];
        }
    }

    // Chuẩn hóa dữ liệu để đảm bảo khớp với QuestionSection filter
    return rawData.map((item: any) => {
        // Ánh xạ type về giá trị chuẩn nếu AI trả về sai (ví dụ 'multiple-choice' -> 'mcq')
        let normalizedType = String(item.type).toLowerCase();
        if (normalizedType.includes('choice') || normalizedType === 'mc') normalizedType = 'mcq';
        if (normalizedType.includes('true') || normalizedType.includes('false') || normalizedType === 'tf') normalizedType = 'group-tf';
        if (normalizedType.includes('short') || normalizedType === 'fill') normalizedType = 'short';

        // Đảm bảo type chỉ nằm trong 3 giá trị cho phép
        if (!['mcq', 'group-tf', 'short'].includes(normalizedType)) {
            normalizedType = 'mcq'; // Mặc định nếu không xác định được
        }

        return {
            ...item,
            id: uuidv4(),
            type: normalizedType,
            points: item.points || (normalizedType === 'mcq' ? 0.25 : normalizedType === 'group-tf' ? 1.0 : 0.5),
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
                ...sq, 
                id: uuidv4(),
                correctAnswer: (sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'True' || sq.correctAnswer === true) ? 'True' : 'False'
            })) : undefined
        };
    });
  } catch (error) {
    console.error("Lỗi parseQuestionsFromPDF:", error);
    throw error;
  }
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        Soạn đề thi Toán lớp ${config.grade} - Chủ đề: ${config.topic}.
        Yêu cầu:
        - ${config.part1Count} câu trắc nghiệm (mcq).
        - ${config.part2Count} câu Đúng/Sai (group-tf) - mỗi câu 4 ý a,b,c,d.
        - ${config.part3Count} câu trả lời ngắn (short).
        Tất cả phải có giải thích (solution) và dùng LaTeX $.
    `;

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
                                    }
                                }
                            }
                        },
                        required: ["type", "text", "solution"]
                    }
                }
            }
        });

        const rawData = JSON.parse(cleanJsonString(response.text || "[]"));
        return rawData.map((item: any) => ({
            id: uuidv4(),
            ...item,
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ ...sq, id: uuidv4() })) : undefined
        }));
    } catch (error) {
        console.error("Lỗi AI Soạn đề:", error);
        throw error;
    }
};
