
import React from 'react';
import { X, Download, FileType } from 'lucide-react';
import { Quiz, Question } from '../../types';
import LatexText from '../LatexText';

interface QuizPreviewModalProps {
    quiz: Quiz;
    onClose: () => void;
}

const QuizPreviewModal: React.FC<QuizPreviewModalProps> = ({ quiz, onClose }) => {
    
    // Tính toán số cột (Tab) linh hoạt dựa trên độ dài đáp án
    const getColumnCount = (options: string[]) => {
        const maxLength = Math.max(...options.map(opt => opt.length));
        if (maxLength > 40) return 1;
        if (maxLength > 15) return 2;
        return 4;
    };

    // Render các phương án theo dạng bảng để đảm bảo căn lề chuẩn
    const renderOptionsTable = (q: Question) => {
        if (!q.options) return null;
        const cols = getColumnCount(q.options);
        const rows = [];
        for (let i = 0; i < q.options.length; i += cols) {
            rows.push(q.options.slice(i, i + cols));
        }

        return (
            <table className="options-table w-full border-collapse mt-3 ml-6" style={{ width: '100%', textAlign: 'left', tableLayout: 'fixed' }}>
                <tbody>
                    {rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                            {row.map((opt, cIdx) => (
                                <td 
                                    key={cIdx} 
                                    style={{ 
                                        width: `${100 / cols}%`, 
                                        textAlign: 'left', 
                                        padding: '4px 8px 4px 0',
                                        verticalAlign: 'top',
                                        wordBreak: 'break-word'
                                    }} 
                                    className="option-cell"
                                >
                                    <span style={{ fontWeight: 'bold', marginRight: '4px', whiteSpace: 'nowrap' }}>
                                        {String.fromCharCode(65 + (rIdx * cols + cIdx))}.
                                    </span>
                                    <LatexText text={opt} />
                                </td>
                            ))}
                            {row.length < cols && Array(cols - row.length).fill(0).map((_, i) => (
                                <td key={`empty-${i}`} style={{ width: `${100 / cols}%` }}></td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const handleExportWord = () => {
        const content = document.getElementById('quiz-export-content')?.innerHTML;
        if (!content) return alert("Không tìm thấy nội dung!");

        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                  xmlns:w='urn:schemas-microsoft-com:office:word' 
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>${quiz.title}</title>
                <style>
                    @page { size: 21cm 29.7cm; margin: 2cm; }
                    body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; color: black; text-align: left; }
                    .section-title { font-weight: bold; margin-top: 20px; font-size: 12pt; text-transform: uppercase; border-bottom: 1.5pt solid black; padding-bottom: 2pt; text-align: left; }
                    .question { margin-top: 15px; margin-bottom: 10px; page-break-inside: avoid; text-align: left; }
                    .q-label { font-weight: bold; font-style: italic; text-decoration: underline; text-align: left; }
                    .options-table { width: 100%; margin-top: 5px; border-collapse: collapse; text-align: left; }
                    .option-cell { padding: 2pt 0; vertical-align: top; text-align: left; }
                    .q-image-container { text-align: center; margin: 15pt 0; display: block; }
                    img { max-width: 450px; height: auto; display: block; margin: 5pt auto; }
                    .footer { text-align: center; margin-top: 40pt; border-top: 1pt solid black; padding-top: 10pt; font-weight: bold; }
                    table { border-collapse: collapse; width: 100%; text-align: left; }
                    td { vertical-align: top; text-align: left; }
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
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
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
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase hover:bg-blue-700 transition-all shadow-xl active:scale-95"
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

                {/* Nội dung đề thi - Sử dụng font không chân (Sans-serif) cho web để tránh lỗi font tiếng Việt */}
                <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white custom-scrollbar">
                    <div 
                        id="quiz-export-content" 
                        className="max-w-4xl mx-auto space-y-12 pb-24" 
                        style={{ 
                            textAlign: 'left', 
                            fontFamily: "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                            color: '#1a1a1a',
                            lineHeight: '1.6'
                        }}
                    >
                        
                        {/* Phần tiêu đề đề thi */}
                        <div className="mb-10" style={{ textAlign: 'left' }}>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '45%', textAlign: 'center', padding: '10px' }}>
                                            <p style={{ fontWeight: 'bold', textTransform: 'uppercase', margin: '2px 0', fontSize: '11pt' }}>SỞ GD&ĐT EDUQUIZ VN</p>
                                            <p style={{ fontWeight: 'bold', textTransform: 'uppercase', textDecoration: 'underline', margin: '2px 0', fontSize: '11pt' }}>TRƯỜNG THPT CHUYÊN AI</p>
                                            <p style={{ fontSize: '9pt', fontStyle: 'italic', margin: '5px 0' }}>Mã đề: {quiz.id.slice(0, 3).toUpperCase()}</p>
                                        </td>
                                        <td style={{ width: '55%', textAlign: 'center', padding: '10px' }}>
                                            <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: '2px 0' }}>ĐỀ THI {quiz.type === 'test' ? 'CHÍNH THỨC' : 'LUYỆN TẬP'}</p>
                                            <p style={{ fontWeight: 'bold', margin: '2px 0', fontSize: '11pt' }}>MÔN: TOÁN - KHỐI {quiz.grade}</p>
                                            <p style={{ fontStyle: 'italic', margin: '2px 0', fontSize: '10pt' }}>Thời gian: {quiz.durationMinutes} phút</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div style={{ border: '1.5pt solid black', padding: '12px', marginTop: '20px', textAlign: 'left' }}>
                                <p style={{ fontWeight: 'bold', margin: 0, fontSize: '11pt' }}>Họ và tên thí sinh: ................................................................... SBD: ......................</p>
                            </div>
                            <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15pt', marginTop: '30px', textTransform: 'uppercase', color: '#000' }}>{quiz.title}</h2>
                        </div>

                        {/* Nội dung câu hỏi */}
                        {['mcq', 'group-tf', 'short'].map((type) => {
                            const typeQs = quiz.questions.filter(q => q.type === type);
                            if (typeQs.length === 0) return null;
                            
                            return (
                                <div key={type} className="section-block" style={{ marginBottom: '40px', textAlign: 'left' }}>
                                    <div className="section-title" style={{ fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '2pt solid black', marginBottom: '20px', paddingBottom: '5px', textAlign: 'left', fontSize: '11pt', color: '#000' }}>
                                        {type === 'mcq' ? 'PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN' : 
                                         type === 'group-tf' ? 'PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI' : 
                                         'PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN'}
                                    </div>
                                    
                                    <div className="space-y-10">
                                        {typeQs.map((q, idx) => (
                                            <div key={q.id} className="question" style={{ marginBottom: '25px', textAlign: 'left', pageBreakInside: 'avoid' }}>
                                                <div style={{ display: 'flex', width: '100%', textAlign: 'left', gap: '8px' }}>
                                                    <div style={{ fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline', textAlign: 'left', minWidth: '60px', flexShrink: 0 }}>Câu {idx + 1}.</div>
                                                    <div style={{ textAlign: 'left', flexGrow: 1 }}>
                                                        <LatexText text={q.text}/>
                                                    </div>
                                                </div>

                                                {/* Ảnh đề thi - Căn giữa tuyệt đối */}
                                                {q.imageUrl && (
                                                    <div className="q-image-container" style={{ textAlign: 'center', margin: '20px auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
                                                        <img 
                                                            src={q.imageUrl} 
                                                            alt={`Hình ${idx + 1}`} 
                                                            style={{ 
                                                                maxWidth: '90%', 
                                                                maxHeight: '400px', 
                                                                border: '1px solid #eee', 
                                                                borderRadius: '8px',
                                                                display: 'block'
                                                            }} 
                                                        />
                                                    </div>
                                                )}

                                                {/* Các phương án P.I */}
                                                {q.type === 'mcq' && renderOptionsTable(q)}

                                                {/* Phần II: Đúng/Sai */}
                                                {q.type === 'group-tf' && q.subQuestions && (
                                                    <div style={{ marginLeft: '40px', marginTop: '8px', textAlign: 'left' }}>
                                                        {q.subQuestions.map((sq, si) => (
                                                            <div key={si} style={{ display: 'flex', width: '100%', marginBottom: '6px', textAlign: 'left', gap: '10px' }}>
                                                                <div style={{ fontWeight: 'bold', textAlign: 'left', minWidth: '25px' }}>{String.fromCharCode(97 + si)})</div>
                                                                <div style={{ textAlign: 'left' }}><LatexText text={sq.text}/></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Phần III: Trả lời ngắn */}
                                                {q.type === 'short' && (
                                                    <div style={{ marginLeft: '40px', marginTop: '15px', textAlign: 'left' }}>
                                                        <div style={{ border: '1.5pt solid black', width: '180px', height: '40px', textAlign: 'center', lineHeight: '40px', color: '#999', fontStyle: 'italic', fontSize: '10pt', borderRadius: '4px' }}>
                                                            Đáp số: .........
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="footer" style={{ textAlign: 'center', marginTop: '60px', borderTop: '1pt solid #eee', paddingTop: '20px', fontWeight: 'bold' }}>
                            <p style={{ fontSize: '12pt', margin: '10px 0' }}>--- HẾT ---</p>
                            <p style={{ fontSize: '9pt', fontWeight: 'normal', fontStyle: 'italic', color: '#666' }}>(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuizPreviewModal;
