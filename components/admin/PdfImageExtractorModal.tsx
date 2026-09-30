import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Question } from '../../types';
import { 
  X, Image as ImageIcon, UploadCloud, Check, CheckCircle2, 
  Crop, Sparkles, RefreshCw, Loader2, AlertCircle, FileUp, 
  Maximize2, Scissors, Plus, Trash2, Zap, Undo2
} from 'lucide-react';
import { uploadQuizImageWithResult, uploadToImgbb, getImageStorageConfig } from '../../services/storage';

export interface ExtractedPdfImage {
  id: string;
  pageNumber: number;
  dataUrl: string; // base64 data url
  width: number;
  height: number;
  uploadedUrl?: string; // Khi đã upload lên ImgBB / Supabase
  isUploading?: boolean;
  assignedQuestionId?: string; // ID câu hỏi được gán
  assignedSlot?: 'question' | 'solution' | 'optA' | 'optB' | 'optC' | 'optD'; // Vị trí gán
  sourceType: 'embedded' | 'crop' | 'upload';
}

interface PdfImageExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  onAssignImageToQuestion: (
    questionId: string, 
    imageUrl: string, 
    slot?: 'question' | 'solution' | 'optA' | 'optB' | 'optC' | 'optD'
  ) => void;
  targetQuestionId?: string | null;
  currentPdfFile?: File | null;
}

// Cấu hình load pdf.js an toàn từ CDN
const loadPdfJs = async (): Promise<any> => {
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('pdfjs-cdn-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(lib);
        } else {
          reject(new Error("Không thể khởi tạo pdfjsLib"));
        }
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'pdfjs-cdn-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(lib);
      } else {
        reject(new Error("Không tìm thấy window.pdfjsLib"));
      }
    };
    script.onerror = () => reject(new Error("Không thể tải thư viện PDF từ CDN"));
    document.head.appendChild(script);
  });
};

// Chuyển dataURL base64 sang Blob để upload
const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/png';
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
};

// Đọc nhị phân hình ảnh XObject / ImageBitmap từ pdf.js
const extractImageDataUrl = (imgObj: any): { dataUrl: string; width: number; height: number } | null => {
  if (!imgObj) return null;
  const w = imgObj.width;
  const h = imgObj.height;
  if (!w || !h || w < 20 || h < 20) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (imgObj.bitmap && typeof ctx.drawImage === 'function') {
      ctx.drawImage(imgObj.bitmap, 0, 0);
      return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
    }

    if (imgObj.data) {
      const src = imgObj.data;
      const imgData = ctx.createImageData(w, h);
      const dest = imgData.data;

      if (src.length === w * h * 4) {
        dest.set(src);
      } else if (src.length === w * h * 3) {
        let j = 0;
        for (let k = 0; k < src.length; k += 3) {
          dest[j] = src[k];
          dest[j + 1] = src[k + 1];
          dest[j + 2] = src[k + 2];
          dest[j + 3] = 255;
          j += 4;
        }
      } else if (src.length === w * h) {
        let j = 0;
        for (let k = 0; k < src.length; k++) {
          const v = src[k];
          dest[j] = v;
          dest[j + 1] = v;
          dest[j + 2] = v;
          dest[j + 3] = 255;
          j += 4;
        }
      } else {
        // Xử lý an toàn cho các định dạng khác
        let j = 0;
        for (let k = 0; k < Math.min(src.length, w * h * 4); k += 4) {
          dest[j] = src[k] || 0;
          dest[j + 1] = src[k + 1] || 0;
          dest[j + 2] = src[k + 2] || 0;
          dest[j + 3] = 255;
          j += 4;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
    }
  } catch (err) {
    console.warn("Lỗi vẽ data ảnh PDF:", err);
  }

  return null;
};

// Helper lấy image object bất đồng bộ
const getPdfImageObj = (page: any, key: string): Promise<any> => {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 2000);

    try {
      if (page.objs && page.objs.has(key)) {
        page.objs.get(key, (obj: any) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve(obj);
          }
        });
        const syncObj = page.objs.get(key);
        if (syncObj && !resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(syncObj);
        }
      } else if (page.commonObjs && page.commonObjs.has(key)) {
        page.commonObjs.get(key, (obj: any) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve(obj);
          }
        });
        const syncObj = page.commonObjs.get(key);
        if (syncObj && !resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(syncObj);
        }
      } else {
        clearTimeout(timer);
        resolve(null);
      }
    } catch (e) {
      clearTimeout(timer);
      resolve(null);
    }
  });
};

const SESSION_EXTRACTED_IMAGES_KEY = 'eduquiz_pdf_extracted_images_cache_v3';

export default function PdfImageExtractorModal({
  isOpen,
  onClose,
  questions,
  onAssignImageToQuestion,
  targetQuestionId,
  currentPdfFile
}: PdfImageExtractorModalProps) {
  const [activeTab, setActiveTab] = useState<'gallery' | 'crop'>('gallery');
  const [pdfFile, setPdfFile] = useState<File | null>(currentPdfFile || null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  
  // Trạng thái trích xuất
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<string>('');
  const [extractedImages, setExtractedImages] = useState<ExtractedPdfImage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Trạng thái kéo chuột cắt vùng ảnh (Tab Crop)
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [pageRendering, setPageRendering] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropOverlayRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Zoom và xem ảnh phóng to
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadSuccessMap, setUploadSuccessMap] = useState<Record<string, string>>({}); // imgId -> success message

  // Tải lại cache từ session khi modal mở
  useEffect(() => {
    if (isOpen && extractedImages.length === 0) {
      try {
        const cached = sessionStorage.getItem(SESSION_EXTRACTED_IMAGES_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setExtractedImages(parsed);
          }
        }
      } catch (e) {
        console.warn("Không thể tải cache ảnh PDF:", e);
      }
    }
  }, [isOpen]);

  // Lưu lại cache khi danh sách ảnh thay đổi
  useEffect(() => {
    if (extractedImages.length > 0) {
      try {
        const toSave = extractedImages.slice(0, 50);
        sessionStorage.setItem(SESSION_EXTRACTED_IMAGES_KEY, JSON.stringify(toSave));
      } catch (e) {
        console.warn("Lưu cache ảnh PDF thất bại:", e);
      }
    }
  }, [extractedImages]);

  // Cập nhật khi currentPdfFile thay đổi
  useEffect(() => {
    if (isOpen && currentPdfFile && (!pdfFile || pdfFile.name !== currentPdfFile.name)) {
      setPdfFile(currentPdfFile);
    }
  }, [isOpen, currentPdfFile]);

  // Khi có file PDF mới và chưa bóc tách -> Tự động nạp tài liệu và quét ảnh
  useEffect(() => {
    if (isOpen && pdfFile) {
      loadAndExtractPdf(pdfFile);
    }
  }, [pdfFile, isOpen]);

  // Vẽ trang PDF lên canvas khi chuyển qua tab Crop hoặc đổi trang
  useEffect(() => {
    if (activeTab === 'crop' && pdfDoc && currentPageNum >= 1 && currentPageNum <= totalPages) {
      renderPdfPage(currentPageNum);
    }
  }, [activeTab, pdfDoc, currentPageNum, totalPages]);

  // Hỗ trợ bắt sự kiện Paste (Ctrl + V) ảnh trực tiếp vào modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePasteEvent = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                const newImg: ExtractedPdfImage = {
                  id: `pasted_${Date.now()}`,
                  pageNumber: 1,
                  dataUrl,
                  width: 400,
                  height: 300,
                  sourceType: 'upload'
                };
                setExtractedImages(prev => [newImg, ...prev]);
                setUploadSuccessMap(prev => ({ ...prev, [newImg.id]: 'Đã dán ảnh thành công!' }));
                setTimeout(() => {
                  setUploadSuccessMap(prev => {
                    const next = { ...prev };
                    delete next[newImg.id];
                    return next;
                  });
                }, 3000);
              }
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [isOpen]);

  // Xử lý nạp file PDF và bóc tách toàn bộ ảnh tự động
  const loadAndExtractPdf = async (file: File) => {
    setIsExtracting(true);
    setErrorMessage(null);
    setExtractProgress('Đang nạp thư viện đọc PDF...');
    setCropRect(null);

    try {
      const pdfjs = await loadPdfJs();
      setExtractProgress('Đang đọc cấu trúc tài liệu PDF...');
      
      const fileArrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: fileArrayBuffer });
      const loadedDoc = await loadingTask.promise;
      setPdfDoc(loadedDoc);
      setTotalPages(loadedDoc.numPages);

      const foundImages: ExtractedPdfImage[] = [];
      const seenHashes = new Set<string>();

      // Duyệt qua từng trang PDF để tìm các ảnh nhúng (XObject Images)
      for (let p = 1; p <= loadedDoc.numPages; p++) {
        setExtractProgress(`Đang quét hình ảnh trang ${p}/${loadedDoc.numPages}...`);
        const page = await loadedDoc.getPage(p);
        const operatorList = await page.getOperatorList();
        const validFn = pdfjs.OPS.paintImageXObject || 82;
        const validFnInline = pdfjs.OPS.paintInlineImageXObject || 83;

        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i];
          if (fn === validFn || fn === validFnInline) {
            const imgKey = operatorList.argsArray[i][0];
            try {
              const imgObj = await getPdfImageObj(page, imgKey);
              if (imgObj) {
                const extracted = extractImageDataUrl(imgObj);
                if (extracted) {
                  const { dataUrl, width, height } = extracted;
                  // Lọc bỏ icon li ti, đường kẻ mảnh
                  if (width >= 35 && height >= 35 && (width > 60 || height > 60)) {
                    const quickHash = `${width}x${height}_${dataUrl.slice(30, 90)}`;
                    if (!seenHashes.has(quickHash)) {
                      seenHashes.add(quickHash);
                      foundImages.push({
                        id: `img_p${p}_${foundImages.length + 1}_${Date.now()}`,
                        pageNumber: p,
                        dataUrl,
                        width,
                        height,
                        sourceType: 'embedded'
                      });
                    }
                  }
                }
              }
            } catch (err) {
              console.warn(`Không thể đọc ảnh ${imgKey} trang ${p}:`, err);
            }
          }
        }
      }

      setExtractedImages(prev => {
        const existingDataUrls = new Set(prev.map(img => img.dataUrl.slice(0, 100)));
        const newUnique = foundImages.filter(img => !existingDataUrls.has(img.dataUrl.slice(0, 100)));
        return [...newUnique, ...prev];
      });

      setExtractProgress('');
      if (foundImages.length === 0 && extractedImages.length === 0) {
        setActiveTab('crop');
      } else {
        setActiveTab('gallery');
      }
    } catch (err: any) {
      console.error("Lỗi trích xuất PDF:", err);
      setErrorMessage("Không thể trích xuất ảnh tự động từ file PDF này: " + (err.message || "Lỗi định dạng"));
    } finally {
      setIsExtracting(false);
    }
  };

  // Render trang PDF chất lượng cao để người dùng kéo chuột cắt
  const renderPdfPage = async (pageNum: number) => {
    if (!pdfDoc) return;
    setPageRendering(true);
    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 1.8 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
    } catch (err) {
      console.error(`Lỗi render trang ${pageNum}:`, err);
    } finally {
      setPageRendering(false);
    }
  };

  // Bắt đầu kéo chuột cắt hình (Tab Crop)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cropOverlayRef.current) return;
    const rect = cropOverlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setCropStart({ x, y });
    setCropRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !cropStart || !cropOverlayRef.current) return;
    const rect = cropOverlayRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const width = Math.abs(currentX - cropStart.x);
    const height = Math.abs(currentY - cropStart.y);

    setCropRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // Lưu vùng đã cắt từ canvas vào kho ảnh
  const handleSaveCroppedArea = () => {
    if (!canvasRef.current || !cropRect || cropRect.width < 10 || cropRect.height < 10) {
      alert("Vui lòng kéo chuột khoanh vùng hình vẽ cần cắt!");
      return;
    }

    const sourceCanvas = canvasRef.current;
    const overlay = cropOverlayRef.current;
    if (!overlay) return;

    const scaleX = sourceCanvas.width / overlay.clientWidth;
    const scaleY = sourceCanvas.height / overlay.clientHeight;

    const cropX = cropRect.x * scaleX;
    const cropY = cropRect.y * scaleY;
    const cropW = cropRect.width * scaleX;
    const cropH = cropRect.height * scaleY;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const dataUrl = cropCanvas.toDataURL('image/png');

    const newImg: ExtractedPdfImage = {
      id: `crop_p${currentPageNum}_${Date.now()}`,
      pageNumber: currentPageNum,
      dataUrl,
      width: Math.round(cropW),
      height: Math.round(cropH),
      sourceType: 'crop'
    };

    setExtractedImages(prev => [newImg, ...prev]);
    setCropRect(null);
    setActiveTab('gallery');
    setUploadSuccessMap(prev => ({ ...prev, [newImg.id]: 'Đã cắt & lưu vào kho ảnh!' }));
    setTimeout(() => {
      setUploadSuccessMap(prev => {
        const next = { ...prev };
        delete next[newImg.id];
        return next;
      });
    }, 3000);
  };

  // Tải ảnh lên ImgBB / Cloud và lấy URL trực tiếp
  const handleUploadImage = async (img: ExtractedPdfImage): Promise<string> => {
    if (img.uploadedUrl) return img.uploadedUrl;

    setExtractedImages(prev => prev.map(item => item.id === img.id ? { ...item, isUploading: true } : item));

    try {
      const blob = dataUrlToBlob(img.dataUrl);
      const file = new File([blob], `quiz_img_p${img.pageNumber}_${img.id.slice(-6)}.png`, { type: 'image/png' });
      
      // Ưu tiên tải trực tiếp lên ImgBB
      let finalUrl = '';
      try {
        finalUrl = await uploadToImgbb(file);
      } catch (e) {
        const res = await uploadQuizImageWithResult(file);
        finalUrl = res.url;
      }
      
      setExtractedImages(prev => prev.map(item => item.id === img.id ? { 
        ...item, 
        uploadedUrl: finalUrl, 
        isUploading: false 
      } : item));

      return finalUrl;
    } catch (err: any) {
      setExtractedImages(prev => prev.map(item => item.id === img.id ? { ...item, isUploading: false } : item));
      console.warn("Lỗi upload cloud, sử dụng dataUrl:", err);
      return img.dataUrl;
    }
  };

  // Gán trực tiếp ảnh vào câu hỏi được chọn
  const handleAssignToQuestion = async (
    img: ExtractedPdfImage, 
    questionId: string, 
    slot: 'question' | 'solution' | 'optA' | 'optB' | 'optC' | 'optD' = 'question'
  ) => {
    if (!questionId) return;

    try {
      let url = img.uploadedUrl;
      if (!url) {
        url = await handleUploadImage(img);
      }

      onAssignImageToQuestion(questionId, url || img.dataUrl, slot);
      
      setExtractedImages(prev => prev.map(item => item.id === img.id ? { 
        ...item, 
        assignedQuestionId: questionId,
        assignedSlot: slot
      } : item));
      
      const qIndex = questions.findIndex(q => q.id === questionId);
      const qLabel = qIndex >= 0 ? `Câu ${qIndex + 1}` : 'Câu hỏi';
      
      setUploadSuccessMap(prev => ({ 
        ...prev, 
        [img.id]: `✓ Đã gán vào ${qLabel}` 
      }));

      setTimeout(() => {
        setUploadSuccessMap(prev => {
          const next = { ...prev };
          delete next[img.id];
          return next;
        });
      }, 3500);
    } catch (err) {
      console.error("Lỗi khi gán ảnh vào câu hỏi:", err);
    }
  };

  // Xóa ảnh khỏi kho
  const handleDeleteImage = (imgId: string) => {
    setExtractedImages(prev => prev.filter(img => img.id !== imgId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[3500] flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-slate-50 w-full max-w-6xl max-h-[95vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* HEADER MODAL */}
        <div className="bg-[#0f172a] text-white px-6 sm:px-8 py-4 flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <ImageIcon size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white truncate">
                  BỘ BÓC TÁCH ẢNH PDF & TẢI LÊN IMGBB
                </h3>
                <span className="bg-purple-900/60 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                  TỰ ĐỘNG
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-300">
                <span className="truncate max-w-[220px] sm:max-w-md font-medium text-slate-300">
                  Tệp: {pdfFile ? pdfFile.name : 'Chưa chọn file PDF'}
                </span>
                <label className="text-blue-400 hover:text-blue-300 font-black cursor-pointer uppercase underline underline-offset-2 text-[11px] shrink-0 ml-1">
                  ĐỔI FILE PDF KHÁC
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPdfFile(file);
                        loadAndExtractPdf(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-purple-950/80 text-purple-200 border border-purple-700/50 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs">
              <UploadCloud size={14} className="text-purple-400" />
              <span>Đã kết nối ImgBB</span>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Đóng cửa sổ"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* TOOLBAR NAVIGATION TABS */}
        <div className="bg-slate-100/90 px-6 sm:px-8 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                activeTab === 'gallery'
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Sparkles size={14} className="text-blue-500" />
              <span>ẢNH NHÚNG TỰ ĐỘNG ({extractedImages.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('crop')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                activeTab === 'crop'
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Scissors size={14} className="text-slate-500" />
              <span>KÉO CHUỘT CẮT VÙNG ẢNH (ĐỒ THỊ/HÌNH VẼ)</span>
            </button>
          </div>

          <div className="text-xs font-bold text-slate-500">
            Tổng {questions.length} câu hỏi trong đề
          </div>
        </div>

        {/* BODY CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* TRƯỜNG HỢP ĐANG BÓC TÁCH */}
          {isExtracting && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
                <ImageIcon className="absolute inset-0 m-auto text-blue-600" size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-800 uppercase">Đang quét toàn bộ hình ảnh từ PDF...</h4>
                <p className="text-xs text-slate-500 font-medium">{extractProgress}</p>
              </div>
            </div>
          )}

          {/* BÁO LỖI NẾU CÓ */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-700 font-bold">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => pdfFile && loadAndExtractPdf(pdfFile)}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-xl uppercase text-[10px] font-black shrink-0 hover:bg-rose-700"
              >
                Quét lại
              </button>
            </div>
          )}

          {/* TAB 1: KHO ẢNH NHÚNG TỰ ĐỘNG */}
          {activeTab === 'gallery' && !isExtracting && (
            <div className="space-y-4">
              
              {/* THANH THỐNG KÊ VÀ QUÉT LẠI */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-bold text-slate-700">
                  Đã trích xuất thành công <span className="text-blue-600 font-black text-sm">{extractedImages.length}</span> ảnh từ tài liệu. Chọn câu hỏi để gán ảnh trực tiếp:
                </p>
                <button
                  type="button"
                  onClick={() => pdfFile && loadAndExtractPdf(pdfFile)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase transition-all border border-slate-200 active:scale-95"
                >
                  <RefreshCw size={13} className={isExtracting ? "animate-spin" : ""} />
                  <span>QUÉT LẠI</span>
                </button>
              </div>

              {/* LƯỚI THẺ ẢNH (3 CỘT) */}
              {extractedImages.length === 0 ? (
                <div className="py-16 text-center space-y-4 bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8">
                  <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <ImageIcon size={32} />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <h4 className="text-sm font-black text-slate-800 uppercase">Chưa có ảnh nào trong kho</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Chọn file PDF để hệ thống tự động quét ảnh nhị phân, hoặc chuyển sang tab <strong>"Kéo chuột cắt vùng ảnh"</strong> để cắt hình đồ thị/hình học!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {extractedImages.map((img, idx) => {
                    const isAssigned = !!img.assignedQuestionId;
                    const isUploaded = !!img.uploadedUrl;

                    return (
                      <div 
                        key={img.id}
                        className="bg-white rounded-[2rem] border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative"
                      >
                        {/* KHUNG HIỂN THỊ ẢNH */}
                        <div className="relative bg-slate-100 rounded-2xl aspect-[4/3] flex items-center justify-center p-3 overflow-hidden border border-slate-100">
                          <img 
                            src={img.dataUrl} 
                            alt={`Ảnh ${idx + 1}`} 
                            className="max-h-full max-w-full object-contain rounded-md transition-transform group-hover:scale-105 duration-300"
                          />
                          
                          {/* BADGE: Trang X • WxH */}
                          <div className="absolute top-2.5 left-2.5">
                            <span className="bg-slate-900/90 text-white font-black text-[11px] px-2.5 py-1 rounded-lg backdrop-blur-xs shadow-xs">
                              Trang {img.pageNumber} • {img.width}x{img.height}
                            </span>
                          </div>

                          {/* THAO TÁC ZOOM VÀ XÓA */}
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setPreviewImage(img.dataUrl)}
                              className="p-1.5 bg-slate-900/70 hover:bg-slate-900 text-white rounded-lg shadow-xs"
                              title="Xem ảnh phóng to"
                            >
                              <Maximize2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(img.id)}
                              className="p-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg shadow-xs"
                              title="Xóa ảnh này"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* BANNER THÔNG BÁO KHI GÁN */}
                          {uploadSuccessMap[img.id] && (
                            <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-xs text-white flex flex-col items-center justify-center p-4 text-center animate-fade-in z-10 rounded-2xl">
                              <CheckCircle2 size={32} className="mb-1 text-white" />
                              <p className="text-xs font-black uppercase">{uploadSuccessMap[img.id]}</p>
                            </div>
                          )}
                        </div>

                        {/* HÀNG NÚT THAO TÁC: [LÊN IMGBB]  [👉 Gán vào câu hỏi... ▾] */}
                        <div className="pt-3.5 flex items-center justify-between gap-2">
                          {/* Nút Lên ImgBB */}
                          <button
                            type="button"
                            onClick={() => handleUploadImage(img)}
                            disabled={img.isUploading || isUploaded}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black uppercase transition-all shrink-0 ${
                              isUploaded
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                : img.isUploading
                                ? 'bg-purple-100 text-purple-700 border border-purple-200 cursor-wait'
                                : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 active:scale-95'
                            }`}
                            title={isUploaded ? "Ảnh đã được tải lên Cloud CDN" : "Tải ảnh lên ImgBB"}
                          >
                            {img.isUploading ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : isUploaded ? (
                              <Check size={13} className="text-emerald-600" />
                            ) : (
                              <UploadCloud size={13} className="text-purple-600" />
                            )}
                            <span>{isUploaded ? 'Đã lên Cloud' : img.isUploading ? 'Đang tải...' : 'LÊN IMGBB'}</span>
                          </button>

                          {/* Menu Gán vào câu hỏi */}
                          <div className="relative flex-1 min-w-0">
                            <select
                              value={img.assignedQuestionId || ''}
                              onChange={(e) => {
                                const qId = e.target.value;
                                if (qId) {
                                  handleAssignToQuestion(img, qId, 'question');
                                }
                              }}
                              disabled={img.isUploading}
                              className={`w-full appearance-none pl-3 pr-7 py-2 rounded-2xl text-[11px] font-black outline-none transition-all cursor-pointer truncate border ${
                                isAssigned
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <option value="">👉 Gán vào câu hỏi...</option>
                              {questions.map((q, qIdx) => {
                                const partName = q.type === 'mcq' ? 'P.I' : q.type === 'group-tf' ? 'P.II' : 'P.III';
                                const hasImg = !!q.imageUrl;
                                const isThis = q.id === img.assignedQuestionId;
                                return (
                                  <option key={q.id} value={q.id}>
                                    {isThis ? '✓ ' : ''}Câu {qIdx + 1} ({partName}) {hasImg && !isThis ? '[Đã có ảnh]' : ''}
                                  </option>
                                );
                              })}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                              ▼
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KÉO CHUỘT CẮT VÙNG ẢNH TRÊN TRANG PDF */}
          {activeTab === 'crop' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">Trang PDF:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPageNum(p => Math.max(1, p - 1))}
                      disabled={currentPageNum <= 1 || pageRendering}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black disabled:opacity-40"
                    >
                      ◀
                    </button>
                    <span className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-800">
                      {currentPageNum} / {totalPages || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPageNum(p => Math.min(totalPages, p + 1))}
                      disabled={currentPageNum >= totalPages || pageRendering}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black disabled:opacity-40"
                    >
                      ▶
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveCroppedArea}
                    disabled={!cropRect || cropRect.width < 10}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Scissors size={14} />
                    <span>Lưu vùng đã cắt vào kho</span>
                  </button>
                </div>
              </div>

              {/* VÙNG CANVAS HIỂN THỊ TRANG PDF ĐỂ KÉO CẮT */}
              <div className="relative bg-slate-200 rounded-2xl p-4 flex items-center justify-center overflow-auto max-h-[60vh] border border-slate-300">
                {pageRendering && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
                    <Loader2 size={32} className="animate-spin text-blue-600" />
                  </div>
                )}
                
                <div 
                  ref={cropOverlayRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="relative cursor-crosshair shadow-lg bg-white select-none inline-block"
                >
                  <canvas ref={canvasRef} className="block max-w-full h-auto" />

                  {/* KHUNG CHỮ NHẬT KHI ĐANG KÉO CHUỘT */}
                  {cropRect && (
                    <div 
                      className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
                      style={{
                        left: `${cropRect.x}px`,
                        top: `${cropRect.y}px`,
                        width: `${cropRect.width}px`,
                        height: `${cropRect.height}px`
                      }}
                    >
                      <span className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
                        {Math.round(cropRect.width)} x {Math.round(cropRect.height)} px
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* MODAL XEM PHÓNG TO ẢNH */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 z-[3600] flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 p-2">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 text-white rounded-full hover:bg-slate-700 z-10"
            >
              <X size={20} />
            </button>
            <img src={previewImage} alt="Preview" className="max-h-[85vh] max-w-full object-contain mx-auto rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
