import React, { useState, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, ShieldCheck, Key, 
  Layers, ExternalLink, RefreshCw, Zap, Cloud, Sparkles 
} from 'lucide-react';
import { 
  ImageStorageProvider, 
  DEFAULT_IMGBB_KEY, 
  getImageStorageConfig, 
  saveImageStorageConfig, 
  uploadToImgbb 
} from '../../services/storage';

interface ImageStorageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export default function ImageStorageSettingsModal({
  isOpen,
  onClose,
  onConfigChanged
}: ImageStorageSettingsModalProps) {
  const [provider, setProvider] = useState<ImageStorageProvider>('auto');
  const [apiKey, setApiKey] = useState(DEFAULT_IMGBB_KEY);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    url?: string;
  } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getImageStorageConfig();
      setProvider(cfg.provider);
      setApiKey(cfg.imgbbApiKey || DEFAULT_IMGBB_KEY);
      setTestResult(null);
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveImageStorageConfig({
      provider,
      imgbbApiKey: apiKey.trim()
    });
    setIsSaved(true);
    if (onConfigChanged) onConfigChanged();
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: 'Vui lòng nhập ImgBB API Key trước khi kiểm tra!'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Tạo 1 ảnh test 2x2 px dạng Blob PNG siêu nhẹ (~70 bytes)
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(0, 0, 2, 2);
      }
      
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Không thể tạo dữ liệu ảnh test"));
        }, 'image/png');
      });

      const startTime = Date.now();
      const testUrl = await uploadToImgbb(blob, apiKey.trim());
      const duration = Date.now() - startTime;

      setTestResult({
        success: true,
        message: `Kết nối ImgBB API thành công! Tốc độ phản hồi: ${duration}ms`,
        url: testUrl
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Lỗi kết nối ImgBB: ${err.message || 'Không xác định'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetDefaultKey = () => {
    setApiKey(DEFAULT_IMGBB_KEY);
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[6000] flex items-center justify-center p-4">
      <div className="bg-white max-w-xl w-full rounded-3xl border border-slate-100 shadow-2xl p-6 sm:p-8 overflow-hidden animate-scale-up space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Zap size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase text-slate-800 tracking-tight">Cấu hình Lưu trữ Hình ảnh</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Tối ưu tốc độ tải & Tiết kiệm 100% băng thông</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Lựa chọn phương thức lưu trữ */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
            <Layers size={14} className="text-blue-500" />
            Lựa chọn cơ chế lưu trữ
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            {/* 1. Tự động (Ưu tiên ImgBB -> Supabase) */}
            <div 
              onClick={() => setProvider('auto')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                provider === 'auto' 
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input 
                type="radio" 
                name="image_provider" 
                checked={provider === 'auto'} 
                onChange={() => setProvider('auto')}
                className="mt-1 w-4 h-4 accent-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-800">Ưu tiên ImgBB CDN + Fallback Supabase</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-black text-[9px] rounded-md uppercase">Khuyên dùng</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tải ảnh lên <strong>ImgBB CDN</strong> để học sinh tải nhanh tức thì và không tốn băng thông Supabase. Nếu ImgBB bận hoặc lỗi, tự động lưu vào <strong>Supabase Storage</strong> làm dự phòng.
                </p>
              </div>
            </div>

            {/* 2. Chỉ ImgBB */}
            <div 
              onClick={() => setProvider('imgbb')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                provider === 'imgbb' 
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input 
                type="radio" 
                name="image_provider" 
                checked={provider === 'imgbb'} 
                onChange={() => setProvider('imgbb')}
                className="mt-1 w-4 h-4 accent-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-800">Chỉ sử dụng ImgBB CDN</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-black text-[9px] rounded-md uppercase">Tiết kiệm 100%</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tất cả hình ảnh đề thi được lưu độc lập trên ImgBB. Hoàn toàn không chiếm dung lượng/băng thông Supabase.
                </p>
              </div>
            </div>

            {/* 3. Chỉ Supabase Storage */}
            <div 
              onClick={() => setProvider('supabase')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                provider === 'supabase' 
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input 
                type="radio" 
                name="image_provider" 
                checked={provider === 'supabase'} 
                onChange={() => setProvider('supabase')}
                className="mt-1 w-4 h-4 accent-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-800">Chỉ sử dụng Supabase Storage</span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-black text-[9px] rounded-md uppercase">Bucket quiz-images</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Lưu file trực tiếp vào Bucket Supabase của hệ thống.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cấu hình ImgBB API Key */}
        {(provider === 'auto' || provider === 'imgbb') && (
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <Key size={14} className="text-amber-500" />
                ImgBB API Key
              </label>
              <button
                type="button"
                onClick={handleResetDefaultKey}
                className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
              >
                Dùng key mặc định
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="Nhập ImgBB API Key..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-700"
                >
                  {showKey ? 'Ẩn' : 'Hiện'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !apiKey.trim()}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 shrink-0"
              >
                {isTesting ? <RefreshCw size={14} className="animate-spin text-blue-500" /> : <ShieldCheck size={14} className="text-emerald-500" />}
                {isTesting ? 'Đang test...' : 'Kiểm tra'}
              </button>
            </div>

            {/* Test result status */}
            {testResult && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {testResult.success ? <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-bold">{testResult.message}</p>
                  {testResult.url && (
                    <a 
                      href={testResult.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-emerald-600 font-mono underline hover:text-emerald-800 flex items-center gap-1 mt-1"
                    >
                      Xem ảnh test: {testResult.url.slice(0, 45)}... <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <Sparkles size={12} className="text-amber-500" />
            <span>Tự động đồng bộ trên thiết bị này</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase transition-all"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md shadow-blue-200 flex items-center gap-1.5"
            >
              {isSaved ? <Check size={14} /> : <Zap size={14} />}
              {isSaved ? 'Đã lưu!' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
