import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question } from '../../types';
import { 
  X, Image as ImageIcon, ImagePlus, Upload, Link2, 
  ClipboardPaste, Check, Layers, AlertCircle, Loader2, 
  Sparkles, Sliders, LayoutGrid, Columns, Rows, Trash2, Eye, Plus
} from 'lucide-react';
import { uploadQuizImageWithResult } from '../../services/storage';
import { buildImageTag, buildMultiImageGridTag, getAllQuestionImages } from '../../services/imageUtils';

export interface InsertImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetField: 'context' | 'text' | 'solution';
  targetQuestionId: string | null;
  targetQuestionLabel?: string;
  questions: Question[];
  onInsert: (qId: string, field: 'context' | 'text' | 'solution', insertedHtml: string) => void;
}

interface ImageUploadItem {
  id: string;
  file?: File;
  previewUrl: string;
  caption: string;
  uploadedUrl?: string;
}

export default function InsertImageModal({
  isOpen,
  onClose,
  targetField,
  targetQuestionId,
  targetQuestionLabel,
  questions,
  onInsert
}: InsertImageModalProps) {
  // Tabs: 'upload' | 'clipboard' | 'url' | 'gallery'
  const [activeTab, setActiveTab] = useState<'upload' | 'clipboard' | 'url' | 'gallery'>('upload');
  
  // Upload files state
  const [uploadItems, setUploadItems] = useState<ImageUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  
  // Options
  const [layoutMode, setLayoutMode] = useState<'grid' | 'stacked'>('grid');
  const [imageHeight, setImageHeight] = useState<number>(250);
  
  // URL tab
  const [directUrl, setDirectUrl] = useState('');
  const [urlCaption, setUrlCaption] = useState('');
  const [urlPreviewValid, setUrlPreviewValid] = useState<boolean | null>(null);

  // Clipboard tab
  const [clipboardPreview, setClipboardPreview] = useState<{ file: File; dataUrl: string } | null>(null);
  const [clipboardCaption, setClipboardCaption] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setUploadItems([]);
      setDirectUrl('');
      setUrlCaption('');
      setUrlPreviewValid(null);
      setClipboardPreview(null);
      setClipboardCaption('');
      setIsUploading(false);
      setUploadProgress('');
    }
  }, [isOpen]);

  // Aggregate all unique images in this quiz
  const quizImages = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      getAllQuestionImages(q).forEach(u => set.add(u));
    });
    return Array.from(set);
  }, [questions]);

  if (!isOpen || !targetQuestionId) return null;

  const fieldLabel = targetField === 'context' 
    ? 'Lời dẫn / Dữ liệu dùng chung' 
    : targetField === 'text' 
      ? 'Nội dung câu hỏi' 
      : 'Lời giải chi tiết';

  const isContext = targetField === 'context';

  // Handle files selected from computer
  const handleFilesSelected = (files: FileList | File[]) => {
    const newItems: ImageUploadItem[] = [];
    const currentCount = uploadItems.length;

    Array.from(files).forEach((file, idx) => {
      if (!file.type.startsWith('image/')) return;
      const previewUrl = URL.createObjectURL(file);
      const num = currentCount + idx + 1;
      newItems.push({
        id: `img_${Date.now()}_${idx}`,
        file,
        previewUrl,
        caption: `Hình ${num}`
      });
    });

    if (newItems.length > 0) {
      setUploadItems(prev => [...prev, ...newItems]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleRemoveUploadItem = (id: string) => {
    setUploadItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateCaption = (id: string, caption: string) => {
    setUploadItems(prev => prev.map(item => item.id === id ? { ...item, caption } : item));
  };

  // Perform upload and insert for Upload Tab
  const handleExecuteUploadAndInsert = async () => {
    if (uploadItems.length === 0) return;
    setIsUploading(true);
    setUploadProgress(`Đang chuẩn bị tải ${uploadItems.length} hình ảnh...`);

    try {
      const results: { url: string; caption?: string }[] = [];

      for (let i = 0; i < uploadItems.length; i++) {
        const item = uploadItems[i];
        setUploadProgress(`Đang tải ảnh ${i + 1}/${uploadItems.length}...`);

        let finalUrl = item.uploadedUrl;
        if (!finalUrl && item.file) {
          const res = await uploadQuizImageWithResult(item.file);
          finalUrl = res.url;
        }

        if (finalUrl) {
          results.push({
            url: finalUrl,
            caption: item.caption.trim() || undefined
          });
        }
      }

      if (results.length === 0) {
        alert("Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối mạng!");
        return;
      }

      // Generate HTML tag
      let htmlTag = '';
      if (layoutMode === 'grid' && results.length > 1) {
        htmlTag = buildMultiImageGridTag(results, imageHeight);
      } else {
        htmlTag = results.map(r => buildImageTag({
          url: r.url,
          caption: r.caption,
          maxHeight: imageHeight,
          align: 'center'
        })).join('\n');
      }

      onInsert(targetQuestionId, targetField, htmlTag);
      onClose();
    } catch (err: any) {
      console.error("Lỗi khi tải ảnh:", err);
      alert("Đã xảy ra lỗi khi tải ảnh: " + (err.message || 'Không xác định'));
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Direct Clipboard reading
  const handleReadClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        alert("Vui lòng click vào vùng bên dưới và bấm tổ hợp phím Ctrl + V để dán ảnh!");
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const file = new File([blob], `clipboard_${Date.now()}.${imgType.split('/')[1] || 'png'}`, { type: imgType });
          const dataUrl = URL.createObjectURL(file);
          setClipboardPreview({ file, dataUrl });
          setClipboardCaption('Hình minh họa');
          return;
        }
      }
      alert("Không tìm thấy hình ảnh nào trong Clipboard!\n\nHãy chụp ảnh bằng Win + Shift + S hoặc sao chép ảnh trước rồi bấm vào đây.");
    } catch (e) {
      alert("Hãy bấm phím Ctrl + V trực tiếp trên bàn phím để dán ảnh!");
    }
  };

  const handleClipboardPasteEvent = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const dataUrl = URL.createObjectURL(file);
          setClipboardPreview({ file, dataUrl });
          setClipboardCaption('Hình minh họa');
          return;
        }
      }
    }
  };

  const handleInsertClipboardImage = async () => {
    if (!clipboardPreview) return;
    setIsUploading(true);
    setUploadProgress('Đang tải ảnh từ Clipboard lên máy chủ...');
    try {
      const res = await uploadQuizImageWithResult(clipboardPreview.file);
      const htmlTag = buildImageTag({
        url: res.url,
        caption: clipboardCaption.trim() || undefined,
        maxHeight: imageHeight,
        align: 'center'
      });
      onInsert(targetQuestionId, targetField, htmlTag);
      onClose();
    } catch (err: any) {
      alert("Lỗi khi tải ảnh: " + (err.message || 'Không xác định'));
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleInsertDirectUrl = () => {
    if (!directUrl.trim()) return;
    const htmlTag = buildImageTag({
      url: directUrl.trim(),
      caption: urlCaption.trim() || undefined,
      maxHeight: imageHeight,
      align: 'center'
    });
    onInsert(targetQuestionId, targetField, htmlTag);
    onClose();
  };

  const handleInsertFromQuizGallery = (imageUrl: string) => {
    const htmlTag = buildImageTag({
      url: imageUrl,
      caption: 'Hình minh họa',
      maxHeight: imageHeight,
      align: 'center'
    });
    onInsert(targetQuestionId, targetField, htmlTag);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-200"
        onPaste={activeTab === 'clipboard' ? handleClipboardPasteEvent : undefined}
      >
        {/* Header */}
        <div className={`p-5 px-6 border-b flex items-center justify-between text-white ${
          isContext 
            ? 'bg-gradient-to-r from-amber-600 to-orange-600' 
            : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
              <ImagePlus size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base uppercase tracking-tight">
                  Chèn hình ảnh vào {targetField === 'context' ? 'Lời dẫn' : 'Câu hỏi'}
                </h3>
                <span className="text-[10px] bg-white/25 px-2.5 py-0.5 rounded-full font-bold">
                  {targetQuestionLabel || 'Câu hỏi'}
                </span>
              </div>
              <p className="text-white/85 text-xs font-medium">
                Vị trí chèn: <span className="font-bold underline">{fieldLabel}</span> (Hỗ trợ chèn 1, 2, 3 hình hoặc bố cục cạnh nhau)
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/25 flex items-center justify-center transition-all text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex items-center bg-slate-100 p-1.5 gap-1 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'upload' 
                ? 'bg-white text-blue-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload size={14} />
            <span>Tải từ máy tính</span>
            {uploadItems.length > 0 && (
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-[10px] flex items-center justify-center">
                {uploadItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clipboard')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'clipboard' 
                ? 'bg-white text-emerald-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardPaste size={14} />
            <span>Dán Clipboard (Ctrl+V)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'url' 
                ? 'bg-white text-indigo-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 size={14} />
            <span>Link URL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'gallery' 
                ? 'bg-white text-purple-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>Kho ảnh đề ({quizImages.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: UPLOAD TỪ MÁY */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/60 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                />
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
                  <Upload size={26} />
                </div>
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Nhấp để chọn ảnh từ máy hoặc kéo thả file vào đây
                </p>
                <p className="text-slate-500 text-xs">
                  Hỗ trợ JPG, PNG, GIF, WebP. <span className="font-bold text-blue-600">Có thể chọn nhiều ảnh cùng lúc</span> (Hình 1, Hình 2...)
                </p>
              </div>

              {/* Danh sách ảnh đã chọn */}
              {uploadItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                      Ảnh đã chọn ({uploadItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setUploadItems([])}
                      className="text-xs text-red-500 hover:text-red-700 font-bold"
                    >
                      Xóa tất cả
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {uploadItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <img 
                          src={item.previewUrl} 
                          alt="preview" 
                          className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0 bg-white" 
                        />
                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                            Chú thích ảnh {idx + 1}:
                          </label>
                          <input
                            type="text"
                            value={item.caption}
                            onChange={(e) => handleUpdateCaption(item.id, e.target.value)}
                            placeholder={`VD: Hình ${idx + 1}: Đồ thị vận tốc...`}
                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveUploadItem(item.id)}
                          className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shrink-0 transition-colors"
                          title="Bỏ ảnh này"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Cấu hình hiển thị nếu có >= 2 ảnh */}
                  {uploadItems.length > 1 && (
                    <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2">
                        <LayoutGrid size={15} className="text-purple-600" />
                        <span className="text-xs font-black text-purple-900 uppercase">
                          Bố cục khi chèn {uploadItems.length} ảnh
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setLayoutMode('grid')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            layoutMode === 'grid' 
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                              : 'bg-white text-slate-700 border-purple-200 hover:bg-purple-100/50'
                          }`}
                        >
                          <Columns size={15} />
                          <span>Xếp cạnh nhau (Hàng ngang)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLayoutMode('stacked')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            layoutMode === 'stacked' 
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                              : 'bg-white text-slate-700 border-purple-200 hover:bg-purple-100/50'
                          }`}
                        >
                          <Rows size={15} />
                          <span>Xếp dọc (Từng dòng)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLIPBOARD */}
          {activeTab === 'clipboard' && (
            <div className="space-y-4">
              <div 
                onClick={handleReadClipboard}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
                  <ClipboardPaste size={28} />
                </div>
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Click vào đây để dán ảnh đã chụp (hoặc ấn Ctrl + V)
                </p>
                <p className="text-slate-500 text-xs">
                  Mẹo: Dùng <span className="font-bold text-emerald-700">Win + Shift + S</span> (Windows) hoặc <span className="font-bold text-emerald-700">Cmd + Shift + 4</span> (Mac) để cắt ảnh rồi dán vào đây!
                </p>
              </div>

              {clipboardPreview && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-700 flex items-center gap-1.5">
                      <Check size={14} /> Đã nhận ảnh từ Clipboard
                    </span>
                    <button
                      type="button"
                      onClick={() => setClipboardPreview(null)}
                      className="text-xs text-red-500 hover:text-red-700 font-bold"
                    >
                      Bỏ ảnh
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <img 
                      src={clipboardPreview.dataUrl} 
                      alt="clipboard preview" 
                      className="max-h-36 max-w-[200px] object-contain rounded-xl border border-slate-200 bg-white" 
                    />
                    <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                        Chú thích ảnh:
                      </label>
                      <input
                        type="text"
                        value={clipboardCaption}
                        onChange={(e) => setClipboardCaption(e.target.value)}
                        placeholder="VD: Hình minh họa thí nghiệm..."
                        className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: URL LINK */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-500 block mb-1.5">
                  Đường dẫn liên kết hình ảnh (URL):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={directUrl}
                    onChange={(e) => {
                      setDirectUrl(e.target.value);
                      setUrlPreviewValid(null);
                    }}
                    placeholder="https://example.com/hinh-anh.png"
                    className="flex-1 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-500 block mb-1.5">
                  Chú thích ảnh (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={urlCaption}
                  onChange={(e) => setUrlCaption(e.target.value)}
                  placeholder="VD: Hình 1: Đồ thị quá trình biến đổi trạng thái..."
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 outline-none focus:border-indigo-400"
                />
              </div>

              {/* Preview image */}
              {directUrl.trim() && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">Xem trước ảnh:</span>
                  <img
                    src={directUrl.trim()}
                    alt="Preview"
                    onLoad={() => setUrlPreviewValid(true)}
                    onError={() => setUrlPreviewValid(false)}
                    className="max-h-44 max-w-full rounded-xl object-contain border border-slate-200 bg-white"
                  />
                  {urlPreviewValid === false && (
                    <span className="text-xs text-red-500 font-bold mt-2">
                      ⚠️ Không tải được ảnh từ đường dẫn này, vui lòng kiểm tra lại URL.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: KHO ẢNH ĐỀ THI */}
          {activeTab === 'gallery' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-medium">
                Chọn một hình ảnh đã có trong đề thi này để chèn ngay vào {fieldLabel}:
              </p>
              {quizImages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium text-xs bg-slate-50 rounded-2xl">
                  Chưa có hình ảnh nào trong đề thi này. Hãy dùng tab "Tải từ máy tính" hoặc "Dán Clipboard".
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto pr-1">
                  {quizImages.map((url, i) => (
                    <div
                      key={i}
                      onClick={() => handleInsertFromQuizGallery(url)}
                      className="group relative bg-white border border-slate-200 hover:border-purple-500 rounded-2xl p-2 cursor-pointer transition-all hover:shadow-md flex flex-col items-center"
                      title="Nhấn để chèn ảnh này"
                    >
                      <img
                        src={url}
                        alt="quiz item"
                        className="w-full h-24 object-contain rounded-xl bg-slate-50"
                      />
                      <span className="text-[10px] font-black text-purple-700 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        + Chọn chèn
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chiều cao hiển thị ảnh chung */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Sliders size={14} className="text-slate-400" />
              Chiều cao ảnh:
            </span>
            <div className="flex items-center gap-1">
              {[
                { label: 'Nhỏ (160px)', val: 160 },
                { label: 'Vừa (250px)', val: 250 },
                { label: 'Lớn (340px)', val: 340 }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setImageHeight(opt.val)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
                    imageHeight === opt.val 
                      ? 'bg-slate-800 text-white' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-colors"
          >
            Đóng
          </button>

          {activeTab === 'upload' && (
            <button
              type="button"
              onClick={handleExecuteUploadAndInsert}
              disabled={isUploading || uploadItems.length === 0}
              className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-md transition-all ${
                isUploading || uploadItems.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{uploadProgress || 'Đang tải ảnh...'}</span>
                </>
              ) : (
                <>
                  <ImagePlus size={16} />
                  <span>Chèn {uploadItems.length > 0 ? `${uploadItems.length} ảnh` : ''} vào {targetField === 'context' ? 'Lời dẫn' : 'Câu hỏi'}</span>
                </>
              )}
            </button>
          )}

          {activeTab === 'clipboard' && (
            <button
              type="button"
              onClick={handleInsertClipboardImage}
              disabled={isUploading || !clipboardPreview}
              className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-md transition-all ${
                isUploading || !clipboardPreview
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 active:scale-95'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{uploadProgress || 'Đang xử lý...'}</span>
                </>
              ) : (
                <>
                  <ClipboardPaste size={16} />
                  <span>Chèn ảnh Clipboard</span>
                </>
              )}
            </button>
          )}

          {activeTab === 'url' && (
            <button
              type="button"
              onClick={handleInsertDirectUrl}
              disabled={!directUrl.trim() || urlPreviewValid === false}
              className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-md transition-all ${
                !directUrl.trim() || urlPreviewValid === false
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'
              }`}
            >
              <Check size={16} />
              <span>Chèn ảnh từ URL</span>
            </button>
          )}

          {activeTab === 'gallery' && (
            <span className="text-[11px] font-bold text-slate-400 italic">
              Nhấp trực tiếp vào ảnh ở trên để chèn
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
