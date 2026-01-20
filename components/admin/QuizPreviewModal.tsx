
import React from 'react';
import { X, Download, FileType } from 'lucide-react';
import { Quiz, Question } from '../../types';
import LatexText from '../LatexText';

interface QuizPreviewModalProps {
    quiz: Quiz;
    onClose: () => void;
}

const QuizPreviewModal: React.FC<QuizPreviewModalProps> = ({ quiz, onClose }) => {
    
    // Hàm tính toán số cột dựa trên độ dài các lựa chọn
    const getColumnCount = (options: string[]) => {
        const maxLength = Math.max(...options.map(opt => opt.length));
        if (maxLength > 45) return 1; // Quá dài -> 1 cột
        if (maxLength > 18) return 2; // Hơi dài -> 2 cột
        return 4; // Ngắn -> 4 cột
    };

    // Hàm render bảng đáp án trắc nghiệm chuẩn "canh tab"
    const renderMcqOptions = (q: Question) => {
        if (!q.options) return null;
        const cols = getColumnCount(q.options);
        const rows = [];
        
        for (let i = 0; i < q.options.length; i += cols) {
            rows.push(q.options.slice(i, i + cols));
        }

        return (
            <table className="options-table w-full border-collapse mt-4 ml-8">
                <tbody>
                    {rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                            {row.map((opt, cIdx) => (
                                <td 
                                    key={cIdx} 
                                    style={{ width: `${100 / cols}%` }} 
                                    className="option-cell pr-4 py-1 align-top text-justify"
                                >
                                    <span className="font-bold mr-1">{String.fromCharCode(65 + (rIdx * cols + cIdx))}.</span>
                                    <LatexText text={opt} />
                                </td>
                            ))}
                            {/* Fill empty cells if row not full */}
                            {row.length < cols && Array(cols - row.length).fill(0).map((_, emptyIdx) => (
                                <td key={`empty-${emptyIdx}`} style={{ width: `${100 / cols}%` }}></td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const handleExportWord = () => {
        const content = document.getElementById('quiz-export-content')?.innerHTML;
        if (!content) return alert("Không tìm thấy nội dung để xuất!");

        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                  xmlns:w='urn:schemas-microsoft-com:office:word' 
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>${quiz.title}</title>
                <style>
                    @page { size: 21cm 29.7cm; margin: 1.5cm; }
                    body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; color: black; }
                    .print-header { width: 100%; margin-bottom: 20px; }
                    .section-title { font-weight: bold; margin-top: 25px; font-size: 12pt; text-transform: uppercase; border-bottom: 1.5pt solid black; padding-bottom: 2pt; margin-bottom: 15pt; }
                    .question { margin-top: 15px; margin-bottom: 15px; page-break-inside: avoid; }
                    .q-label { font-weight: bold; font-style: italic; text-decoration: underline; }
                    .options-table { width: 100%; margin-top: 8px; border-collapse: collapse; }
                    .option-cell { padding: 3pt 0; vertical-align: top; font-size: 11pt; }
                    .q-image-container { text-align: center; margin: 15pt 0; }
                    img { max-width: 450px; height: auto; display: block; margin: 5pt auto; border: 0.5pt solid #eee; }
                    .ans-box { border: 1pt solid black; width: 140pt; height: 30pt; text-align: center; margin-top: 10pt; vertical-align: middle; }
                    .footer { text-align: center; margin-top: 40pt; border-top: 1.5pt solid black; font-weight: bold; padding-top: 15pt; }
                    table { border-collapse: collapse; }
                </style>
            </head>
            <body>
        `;
        const footer = "</body></html>";
        const sourceHTML = header + content + footer;
        
        const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${quiz.title.replace(/[/\\?%*:|"<>]/g, '-')}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 z-[2000] flex items-center justify-center p-0 md:p-4 backdrop-blur-xl animate-fade-in">
            <div className="bg-white rounded-[0] md:rounded-[3.5rem] w-full max-w-5xl h-full md:h-[95vh] flex flex-col overflow-hidden shadow-2xl">
                
                {/* Header điều khiển */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
                            <FileType size={24}/>
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight leading-tight">{quiz.title}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                XEM TRƯỚC VÀ XUẤT ĐỀ THI CHUẨN CẤU TRÚC
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleExportWord}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase hover:bg-blue-700 transition-all shadow-xl"
                        >
                            <Download size={16}/> Xuất file Word
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"
                        >
                            <X size={24}/>
                        </button>
                    </div>
                </div>

                {/* Nội dung đề thi */}
                <div className="flex-1 overflow-y-auto p-12 bg-white custom-scrollbar">
                    <div id="quiz-export-content" className="max-w-4xl mx-auto font-serif text-black space-y-12 pb-24">
                        
                        {/* Phần tiêu đề trường/sở */}
                        <div className="mb-10 pb-6">
                            <div className="flex justify-between items-start">
                                <div className="text-center" style={{ width: '40%' }}>
                                    <p className="font-bold text-[10.5pt] uppercase">SỞ GIÁO DỤC VÀ ĐÀO TẠO</p>
                                    <p className="font-bold text-[10.5pt] uppercase underline">TRƯỜNG THPT CHUYÊN AI</p>
                                    <p className="text-[9pt] mt-1 italic">Mã đề: {quiz.id.slice(0, 3).toUpperCase()}</p>
                                </div>
                                <div className="text-center" style={{ width: '55%' }}>
                                    <p className="font-bold text-[11pt] uppercase">KIỂM TRA {quiz.type === 'test' ? 'ĐỊNH KỲ' : 'THƯỜNG XUYÊN'}</p>
                                    <p className="font-bold text-[11pt] uppercase">MÔN: TOÁN - KHỐI {quiz.grade}</p>
                                    <p className="italic text-[10pt] mt-1">Thời gian làm bài: {quiz.durationMinutes} phút</p>
                                </div>
                            </div>
                            <div className="mt-8 border-2 border-black p-4">
                                <p className="font-bold text-[11pt]">Họ và tên thí sinh: ................................................................... SBD: ......................</p>
                            </div>
                            <h2 className="text-center font-black text-xl mt-10 uppercase tracking-widest leading-tight">{quiz.title}</h2>
                        </div>

                        {/* Nội dung câu hỏi */}
                        {['mcq', 'group-tf', 'short'].map((type) => {
                            const typeQs = quiz.questions.filter(q => q.type === type);
                            if (typeQs.length === 0) return null;
                            
                            return (
                                <div key={type} className="section-block">
                                    <div className="section-title">
                                        {type === 'mcq' ? 'PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN' : 
                                         type === 'group-tf' ? 'PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI' : 
                                         'PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN'}
                                    </div>
                                    
                                    <div className="space-y-8">
                                        {typeQs.map((q, idx) => (
                                            <div key={q.id} className="question">
                                                <div className="flex gap-2 items-start">
                                                    <span className="font-bold shrink-0 italic underline q-label">Câu {idx + 1}.</span>
                                                    <div className="flex-1 text-justify leading-relaxed">
                                                        <LatexText text={q.text}/>
                                                    </div>
                                                </div>

                                                {/* Hiển thị hình ảnh đề thi */}
                                                {q.imageUrl && (
                                                    <div className="q-image-container">
                                                        <img src={q.imageUrl} alt={`Hình minh họa câu ${idx + 1}`} />
                                                    </div>
                                                )}

                                                {/* Render tùy chọn Trắc nghiệm (P.I) */}
                                                {q.type === 'mcq' && renderMcqOptions(q)}

                                                {/* Render tùy chọn Đúng/Sai (P.II) */}
                                                {q.type === 'group-tf' && q.subQuestions && (
                                                    <div className="mt-3 ml-8 space-y-1.5">
                                                        {q.subQuestions.map((sq, si) => (
                                                            <div key={si} className="flex gap-3 items-start">
                                                                <span className="font-bold shrink-0">{String.fromCharCode(97 + si)})</span>
                                                                <div className="flex-1 text-justify"><LatexText text={sq.text}/></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Render ô trả lời ngắn (P.III) */}
                                                {q.type === 'short' && (
                                                    <div className="mt-3 ml-8">
                                                        <table className="ans-box">
                                                            <tr>
                                                                <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                                    <span style={{ color: '#ccc', fontStyle: 'italic', fontSize: '9pt' }}>Đáp số: .........</span>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Footer đề thi */}
                        <div className="footer">
                            <p>--- HẾT ---</p>
                            <p className="text-[10pt] italic font-normal mt-2">(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuizPreviewModal;
