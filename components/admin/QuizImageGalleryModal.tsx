import React, { useState, useMemo } from 'react';
import { Question } from '../../types';
import { 
  X, Copy, Check, ExternalLink, Image as ImageIcon, Link2, 
  Layers, CheckSquare, Square, Eye, ImagePlus, ArrowRight, Sparkles
} from 'lucide-react';

export interface QuizImageItem {
  url: string;
  usedInQuestionIds: string[];
  usedInQuestionLabels: string[];
}

interface QuizImageGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  onSelectImageForQuestion?: (qId: string, imageUrl: string) => void;
  onBatchApplyImage?: (sourceImageUrl: string, targetQuestionIds: string[]) => void;
  targetQuestionId?: string | null;
}

export default function QuizImageGalleryModal({
  isOpen,
  onClose,
  questions,
  onSelectImageForQuestion,
  onBatchApplyImage,
  targetQuestionId
}: QuizImageGalleryModalProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [previewLargeUrl, setPreviewLargeUrl] = useState<string | null>(null);
  
  // Tab: 'gallery' (xem/chọn ảnh) hoặc 'batch' (gán hàng loạt) hoặc 'direct_url' (nhập link)
  const [activeTab, setActiveTab] = useState<'gallery' | 'direct_url' | 'batch'>('gallery');
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [batchSourceUrl, setBatchSourceUrl] = useState<string | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);

  // Tổng hợp tất cả ảnh unique trong đề
  const uniqueImages: QuizImageItem[] = useMemo(() => {
    const map = new Map<string, { qIds: string[]; labels: string[] }>();

    // Đánh số thứ tự các câu theo từng phần
    let mcqCount = 0;
    let tfCount = 0;
    let shortCount = 0;

    questions.forEach((q) => {
      let label = '';
      if (q.type === 'mcq') {
        mcqCount++;
        label = `Câu ${mcqCount} (P.I)`;
      } else if (q.type === 'group-tf') {
        tfCount++;
        label = `Câu ${tfCount} (P.II)`;
      } else {
        shortCount++;
        label = `Câu ${shortCount} (P.III)`;
      }

      if (q.imageUrl && q.imageUrl.trim()) {
        const u = q.imageUrl.trim();
        if (!map.has(u)) {
          map.set(u, { qIds: [], labels: [] });
        }
        const item = map.get(u)!;
        item.qIds.push(q.id);
        item.labels.push(label);
      }
    });

    const result: QuizImageItem[] = [];
    map.forEach((value, url) => {
      result.push({
        url,
        usedInQuestionIds: value.qIds,
        usedInQuestionLabels: value.labels
      });
    });
    return result;
  }, [questions]);

  // Target question label nếu có
  const targetQuestionLabel = useMemo(() => {
    if (!targetQuestionId) return null;
    let mcqCount = 0;
    let tfCount = 0;
    let shortCount = 0;
    for (const q of questions) {
      if (q.type === 'mcq') mcqCount++;
      else if (q.type === 'group-tf') tfCount++;
      else shortCount++;

      if (q.id === targetQuestionId) {
        if (q.type === 'mcq') return `Câu ${mcqCount} (Phần I - Trắc nghiệm)`;
        if (q.type === 'group-tf') return `Câu ${tfCount} (Phần II - Đúng Sai)`;
        return `Câu ${shortCount} (Phần III - Trả lời ngắn)`;
      }
    }
    return 'câu hỏi đang chọn';
  }, [questions, targetQuestionId]);

  if (!isOpen) return null;

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleApplyDirectUrl = () => {
    const trimmed = directUrlInput.trim();
    if (!trimmed) {
      alert("Vui lòng nhập đường dẫn hình ảnh (URL)");
      return;
    }
    if (targetQuestionId && onSelectImageForQuestion) {
      onSelectImageForQuestion(targetQuestionId, trimmed);
      onClose();
    }
  };

  const handleOpenBatchForImage = (url: string) => {
    setBatchSourceUrl(url);
    // Mặc định chọn các câu chưa có ảnh này
    const currentlyUsing = new Set(
      questions.filter(q => q.imageUrl === url).map(q => q.id)
    );
    setSelectedTargetIds(questions.filter(q => !currentlyUsing.has(q.id)).map(q => q.id).slice(0, 3));
    setActiveTab('batch');
  };

  const handleConfirmBatchApply = () => {
    if (!batchSourceUrl) return;
    if (selectedTargetIds.length === 0) {
      alert("Vui lòng chọn ít nhất 1 câu hỏi để gán ảnh!");
      return;
    }
    if (onBatchApplyImage) {
      onBatchApplyImage(batchSourceUrl, selectedTargetIds);
      alert(`Đã gán thành công link ảnh cho ${selectedTargetIds.length} câu hỏi!`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[3500] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border flex flex-col overflow-hidden animate-scale-up">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">
                Kho ảnh & Tái sử dụng link ảnh đề thi
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {targetQuestionLabel ? `Đang thao tác cho: ${targetQuestionLabel}` : `Đề thi có ${uniqueImages.length} ảnh độc lập`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 bg-white/10 hover:bg-red-600 rounded-xl text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 p-2 gap-2 border-b shrink-0">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${
              activeTab === 'gallery' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ImageIcon size={15} /> Ảnh đã có trong đề ({uniqueImages.length})
          </button>
          
          <button
            onClick={() => setActiveTab('direct_url')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${
              activeTab === 'direct_url' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Link2 size={15} /> Dán / Nhập link ảnh (URL)
          </button>

          {uniqueImages.length > 0 && (
            <button
              onClick={() => {
                if (!batchSourceUrl && uniqueImages.length > 0) {
                  setBatchSourceUrl(uniqueImages[0].url);
                }
                setActiveTab('batch');
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${
                activeTab === 'batch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers size={15} /> Gán ảnh cho nhiều câu
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
          
          {/* TAB 1: GALLERY CÁC ẢNH ĐÃ CÓ */}
          {activeTab === 'gallery' && (
            <div className="space-y-6">
              {uniqueImages.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 space-y-4">
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                    <ImageIcon size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase">Chưa có ảnh nào trong đề thi này</h4>
                    <p className="text-xs text-slate-400 font-bold mt-1 max-w-md mx-auto">
                      Hãy tải lên ảnh đầu tiên từ máy tính hoặc bấm sang tab <strong>"Dán link ảnh"</strong> để sử dụng đường dẫn hình ảnh có sẵn.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('direct_url')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-md hover:bg-black transition-all"
                  >
                    Dán link ảnh ngay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uniqueImages.map((imgItem, idx) => (
                    <div 
                      key={idx}
                      className="bg-white p-4 rounded-3xl border-2 border-slate-200 hover:border-blue-300 transition-all flex flex-col justify-between shadow-sm hover:shadow-md"
                    >
                      <div className="flex gap-4">
                        <div 
                          className="w-28 h-28 shrink-0 bg-slate-100 rounded-2xl overflow-hidden border relative group cursor-pointer"
                          onClick={() => setPreviewLargeUrl(imgItem.url)}
                          title="Click để phóng to ảnh"
                        >
                          <img 
                            src={imgItem.url} 
                            alt="quiz-asset" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye size={20} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                                {imgItem.usedInQuestionIds.length} câu đang dùng
                              </span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-600 line-clamp-2 leading-tight">
                              📌 {imgItem.usedInQuestionLabels.join(', ')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <button
                              onClick={() => handleCopyUrl(imgItem.url)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all border ${
                                copiedUrl === imgItem.url 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                              title="Sao chép đường dẫn ảnh này"
                            >
                              {copiedUrl === imgItem.url ? <Check size={13}/> : <Copy size={13}/>}
                              {copiedUrl === imgItem.url ? 'ĐÃ CHÉP!' : 'COPY LINK'}
                            </button>

                            <button
                              onClick={() => handleOpenBatchForImage(imgItem.url)}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1"
                              title="Gán ảnh này cho nhiều câu khác trong đề"
                            >
                              <Layers size={13} /> Gán tiếp...
                            </button>
                          </div>
                        </div>
                      </div>

                      {targetQuestionId && onSelectImageForQuestion && (
                        <button
                          onClick={() => {
                            onSelectImageForQuestion(targetQuestionId, imgItem.url);
                            onClose();
                          }}
                          className="mt-3 w-full py-2.5 bg-blue-600 text-white hover:bg-black rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <CheckSquare size={14} /> CHỌN ẢNH NÀY CHO {targetQuestionLabel || 'CÂU HIỆN TẠI'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DÁN / NHẬP LINK ẢNH TRỰC TIẾP */}
          {activeTab === 'direct_url' && (
            <div className="space-y-6 max-w-xl mx-auto py-4">
              <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase block mb-1.5">
                    Đường dẫn hình ảnh (URL)
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="url"
                      placeholder="https://... hoặc link ảnh Supabase vừa copy"
                      value={directUrlInput}
                      onChange={(e) => setDirectUrlInput(e.target.value)}
                      className="flex-1 p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setDirectUrlInput(text.trim());
                        } catch (e) {
                          alert("Trình duyệt không cho phép đọc clipboard tự động. Vui lòng bấm Ctrl+V để dán!");
                        }
                      }}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase shrink-0 transition-colors"
                    >
                      Dán từ Clipboard
                    </button>
                  </div>
                </div>

                {directUrlInput.trim() && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Xem thử ảnh:</span>
                    <div className="h-48 bg-slate-50 rounded-2xl border overflow-hidden flex items-center justify-center p-2">
                      <img 
                        src={directUrlInput.trim()} 
                        alt="preview" 
                        className="max-h-full max-w-full object-contain rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).alt = 'Không thể tải ảnh từ đường dẫn này';
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleApplyDirectUrl}
                    disabled={!directUrlInput.trim()}
                    className="flex-[2] py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-black transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Gán ảnh cho câu hỏi
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GÁN HÀNG LOẠT CHO NHIỀU CÂU */}
          {activeTab === 'batch' && (
            <div className="space-y-6">
              {/* Chọn ảnh nguồn */}
              <div className="bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="w-24 h-24 bg-slate-100 rounded-2xl border overflow-hidden shrink-0">
                  {batchSourceUrl ? (
                    <img src={batchSourceUrl} alt="batch-src" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
                    Ảnh đang được chọn để gán chung:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {uniqueImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setBatchSourceUrl(img.url)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                          batchSourceUrl === img.url 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Ảnh {i + 1} ({img.usedInQuestionIds.length} câu)
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Danh sách câu hỏi để tick chọn */}
              <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800">
                      Chọn các câu hỏi sẽ dùng chung ảnh này ({selectedTargetIds.length} câu được chọn)
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Tất cả các câu được tick sẽ tự động nhận link ảnh này mà không cần tải lại file
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTargetIds(questions.map(q => q.id))}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase transition-colors"
                    >
                      Chọn tất cả ({questions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTargetIds([])}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase transition-colors"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Grid danh sách câu hỏi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto custom-scrollbar p-1">
                  {questions.map((q, qIndex) => {
                    const isSelected = selectedTargetIds.includes(q.id);
                    const isAlreadyUsing = q.imageUrl === batchSourceUrl;
                    
                    let qLabel = `Câu ${qIndex + 1}`;
                    if (q.type === 'mcq') qLabel += ' (P.I)';
                    else if (q.type === 'group-tf') qLabel += ' (P.II)';
                    else qLabel += ' (P.III)';

                    return (
                      <div
                        key={q.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTargetIds(selectedTargetIds.filter(id => id !== q.id));
                          } else {
                            setSelectedTargetIds([...selectedTargetIds, q.id]);
                          }
                        }}
                        className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          isSelected 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                            : isAlreadyUsing
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isSelected ? (
                            <CheckSquare size={16} className="text-white shrink-0" />
                          ) : (
                            <Square size={16} className="text-slate-300 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-black text-xs block">{qLabel}</span>
                            <span className={`text-[9px] font-bold block truncate ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                              {q.text || '(Chưa có nội dung)'}
                            </span>
                          </div>
                        </div>

                        {isAlreadyUsing && !isSelected && (
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded">
                            Đang dùng
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleConfirmBatchApply}
                    disabled={selectedTargetIds.length === 0 || !batchSourceUrl}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-black transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check size={16} /> Áp dụng ảnh cho {selectedTargetIds.length} câu
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Large Image Preview Modal */}
      {previewLargeUrl && (
        <div 
          className="fixed inset-0 bg-black/80 z-[4000] flex items-center justify-center p-4"
          onClick={() => setPreviewLargeUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2">
            <img src={previewLargeUrl} alt="large-preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button 
              onClick={() => setPreviewLargeUrl(null)}
              className="absolute top-4 right-4 p-2 bg-slate-900/80 hover:bg-red-600 text-white rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
