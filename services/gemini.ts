
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
};

/**
 * Hàm xóa các nhãn đầu dòng như "A. ", "B. ", "a) ", "1. "...
 * Giúp tránh lặp nhãn khi hiển thị trên giao diện
 */
const stripOptionLabel = (text: string): string => {
    if (!text) return "";
    // Regex này xóa các ký tự ở đầu như: A. , A/ , A) , 1. , a. , a) , *A.
    return text.replace(/^(\*?[A-Za-z0-9][\.\)\/\-]\s*)/g, "").trim();
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
3. Options: Tuyệt đối KHÔNG bao gồm nhãn "A.", "B." vào nội dung phương án.
4. Cấu trúc JSON phải chuẩn xác.`;

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
            options: item.options ? item.options.map((opt: string) => stripOptionLabel(opt)) : undefined,
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
                ...sq, 
                id: uuidv4(),
                text: stripOptionLabel(sq.text),
                correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
            })) : undefined
        }));
    } catch (error: any) {
        throw new Error("AI không thể tạo đề: " + error.message);
    }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `PHÂN TÍCH FILE PDF ĐỀ THI VẬT LÝ/TOÁN HỌC. 
QUY TẮC PHÂN LOẠI VÀ LÀM SẠCH DỮ LIỆU:

1. PHẦN I (Trắc nghiệm 4 lựa chọn): 
   - Nhận diện "Câu 1", "Câu 2"...
   - QUAN TRỌNG: Khi trích xuất các phương án, hãy XÓA BỎ các nhãn "A.", "B.", "C.", "D." ở đầu phương án. Chỉ lấy nội dung.
   - Ví dụ: "A. Lực từ" -> lấy "Lực từ".
   - Nhận diện dấu "*" ở đầu nhãn (VD: *D.) để biết đáp án đúng, sau đó cũng xóa nhãn đó đi.

2. PHẦN II (Trắc nghiệm Đúng/Sai):
   - Gom 4 ý a,b,c,d vào 'subQuestions'.
   - XÓA BỎ nhãn "a)", "b)", "c)", "d)" ở đầu mỗi ý.

3. PHẦN III (Trả lời ngắn):
   - Nhận diện câu yêu cầu điền số.

4. ĐỊNH DẠNG:
   - Bọc công thức vật lý vào $...$.

HÃY ĐẢM BẢO CÁC PHƯƠNG ÁN TRẢ VỀ LÀ NỘI DUNG THUẦN, KHÔNG CÓ NHÃN THỰC TỰ.`;

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
        options: item.options ? item.options.map((opt: string) => stripOptionLabel(opt)) : undefined,
        // Nếu là MCQ, đáp án đúng cũng cần được làm sạch nhãn nếu AI trả về nhãn thay vì nội dung
        correctAnswer: (item.type === 'mcq' && item.correctAnswer) ? stripOptionLabel(item.correctAnswer) : item.correctAnswer,
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
            ...sq, 
            id: uuidv4(),
            text: stripOptionLabel(sq.text),
            correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ' || sq.correctAnswer === 'true') ? 'True' : 'False'
        })) : undefined
    }));
  } catch (error: any) {
    console.error("Lỗi AI trích xuất:", error);
    throw new Error("Lỗi đọc PDF: " + error.message);
  }
};
