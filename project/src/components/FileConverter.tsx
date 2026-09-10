import { useCallback, useEffect, useRef, useState, memo } from 'react';
import {
  Image, FileText, Minimize2, Upload, Download, Trash2,
  Check, Loader2, ChevronDown, X, ArrowRight, PackageOpen
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Custom Dropdown (dark theme native)                                */
/* ------------------------------------------------------------------ */
function CustomDropdown({ value, options, onChange }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="converter-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(v => !v)} className="converter-dropdown-trigger">
        <span>{selected?.label || value}</span>
        <ChevronDown size={12} style={{ opacity: 0.5, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
      </button>
      {open && (
        <div className="converter-dropdown-menu">
          {options.map(o => (
            <button key={o.value} type="button"
              className={`converter-dropdown-item ${o.value === value ? 'active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}
              {o.value === value && <Check size={12} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type ConverterTab = 'images' | 'text' | 'compress';

interface ConvertedFile {
  id: string;
  originalName: string;
  originalSize: number;
  originalType: string;
  previewUrl?: string;
  file: File;
  status: 'pending' | 'converting' | 'done' | 'error';
  outputBlob?: Blob;
  outputName?: string;
  outputSize?: number;
  error?: string;
}

const IMAGE_FORMATS = ['png', 'jpeg', 'webp', 'bmp', 'gif', 'ico'] as const;
type ImageFormat = (typeof IMAGE_FORMATS)[number];

const TEXT_CONVERSIONS = [
  { label: 'TXT → PDF', from: '.txt', to: 'pdf' },
  { label: 'CSV → JSON', from: '.csv', to: 'json' },
  { label: 'JSON → CSV', from: '.json', to: 'csv' },
  { label: 'Markdown → HTML', from: '.md', to: 'html' },
] as const;

const formatLabel = (f: string) => f === 'jpeg' ? 'JPG' : f.toUpperCase();
const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------------ */
/*  Image conversion via Canvas API                                    */
/* ------------------------------------------------------------------ */
async function convertImage(
  file: File, targetFormat: ImageFormat, quality: number, maxWidth: number, maxHeight: number
): Promise<{ blob: Blob; name: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (maxWidth > 0 && w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
      if (maxHeight > 0 && h > maxHeight) { w = Math.round(w * (maxHeight / h)); h = maxHeight; }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // For JPEG/BMP fill white background (no transparency)
      if (targetFormat === 'jpeg' || targetFormat === 'bmp') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);

      const mimeMap: Record<string, string> = {
        png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp',
        bmp: 'image/bmp', gif: 'image/gif', ico: 'image/png',
      };
      const mime = mimeMap[targetFormat] || 'image/png';
      const q = (targetFormat === 'jpeg' || targetFormat === 'webp') ? quality / 100 : undefined;

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas export failed'));
          const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
          const base = file.name.replace(/\.[^.]+$/, '');
          resolve({ blob, name: `${base}.${ext}` });
        },
        mime, q
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/* ------------------------------------------------------------------ */
/*  Text conversions                                                   */
/* ------------------------------------------------------------------ */
async function convertText(
  file: File, conversionType: string
): Promise<{ blob: Blob; name: string }> {
  const text = await file.text();
  const base = file.name.replace(/\.[^.]+$/, '');

  switch (conversionType) {
    case 'pdf': {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 15;
      const pageW = doc.internal.pageSize.getWidth() - margin * 2;
      const lines = doc.splitTextToSize(text, pageW);
      let y = margin;
      const lineH = 5;
      doc.setFont('helvetica');
      doc.setFontSize(11);
      for (const line of lines) {
        if (y + lineH > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineH;
      }
      const blob = doc.output('blob');
      return { blob, name: `${base}.pdf` };
    }
    case 'json': {
      // CSV → JSON
      const rows = text.trim().split('\n');
      if (rows.length < 2) throw new Error('CSV must have a header row');
      const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const data = rows.slice(1).map(row => {
        const vals = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
        return obj;
      });
      const jsonStr = JSON.stringify(data, null, 2);
      return { blob: new Blob([jsonStr], { type: 'application/json' }), name: `${base}.json` };
    }
    case 'csv': {
      // JSON → CSV
      const arr = JSON.parse(text);
      if (!Array.isArray(arr) || arr.length === 0) throw new Error('JSON must be an array of objects');
      const headers = Object.keys(arr[0]);
      const csvLines = [
        headers.join(','),
        ...arr.map((obj: any) => headers.map(h => `"${String(obj[h] ?? '').replace(/"/g, '""')}"`).join(','))
      ];
      return { blob: new Blob([csvLines.join('\n')], { type: 'text/csv' }), name: `${base}.csv` };
    }
    case 'html': {
      // Markdown → HTML (basic)
      let html = text
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br/>');
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${base}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#333}
code{background:#f4f4f4;padding:2px 6px;border-radius:4px}h1,h2,h3{margin-top:1.5em}</style></head><body><p>${html}</p></body></html>`;
      return { blob: new Blob([html], { type: 'text/html' }), name: `${base}.html` };
    }
    default:
      throw new Error(`Unknown conversion: ${conversionType}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Compress image                                                     */
/* ------------------------------------------------------------------ */
async function compressImage(
  file: File, quality: number, maxWidth: number, maxHeight: number
): Promise<{ blob: Blob; name: string }> {
  // Determine output format - keep original or fallback to jpeg for compression
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const format = (['png', 'webp'].includes(ext) ? ext : 'jpeg') as ImageFormat;
  return convertImage(file, format, quality, maxWidth, maxHeight);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export const FileConverter = memo(function FileConverter() {
  const [tab, setTab] = useState<ConverterTab>('images');
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState<ConvertedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Image settings
  const [imgFormat, setImgFormat] = useState<ImageFormat>('png');
  const [imgQuality, setImgQuality] = useState(85);
  const [imgMaxW, setImgMaxW] = useState(0);
  const [imgMaxH, setImgMaxH] = useState(0);

  // Text settings
  const [textConv, setTextConv] = useState(TEXT_CONVERSIONS[0].to);

  // Compress settings
  const [compQuality, setCompQuality] = useState(60);
  const [compMaxW, setCompMaxW] = useState(1920);
  const [compMaxH, setCompMaxH] = useState(1080);

  const acceptMap: Record<ConverterTab, string> = {
    images: 'image/png,image/jpeg,image/webp,image/bmp,image/gif',
    text: '.txt,.csv,.json,.md',
    compress: 'image/png,image/jpeg,image/webp,image/bmp',
  };

  /* -- File handling -- */
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).slice(0, 20);
    const newFiles: ConvertedFile[] = arr.map(f => ({
      id: uid(), originalName: f.name, originalSize: f.size,
      originalType: f.type, file: f, status: 'pending',
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }));
    setFiles(prev => [...prev, ...newFiles].slice(0, 20));
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setFiles([]);
  };

  /* -- Drag & Drop -- */
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };

  /* -- Convert -- */
  const convertAll = async () => {
    const pending = files.filter(f => f.status === 'pending' || f.status === 'error');
    const results: ConvertedFile[] = [];

    for (const cf of pending) {
      setFiles(prev => prev.map(f => f.id === cf.id ? { ...f, status: 'converting' } : f));
      try {
        let result: { blob: Blob; name: string };
        if (tab === 'images') {
          result = await convertImage(cf.file, imgFormat, imgQuality, imgMaxW, imgMaxH);
        } else if (tab === 'text') {
          result = await convertText(cf.file, textConv);
        } else {
          result = await compressImage(cf.file, compQuality, compMaxW, compMaxH);
        }
        const updatedCf = {
          ...cf, status: 'done' as const, outputBlob: result.blob,
          outputName: result.name, outputSize: result.blob.size
        };
        results.push(updatedCf);
        setFiles(prev => prev.map(f => f.id === cf.id ? updatedCf : f));
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.id === cf.id ? {
          ...f, status: 'error', error: err?.message || 'Conversion failed'
        } : f));
      }
    }

    // Auto-download after all pending are processed
    const doneNow = results.filter(f => f.status === 'done');
    if (doneNow.length === 1) {
      downloadOne(doneNow[0]);
    } else if (doneNow.length > 1) {
      downloadAllZip(doneNow);
    }
  };

  /* -- Download -- */
  const downloadOne = (cf: ConvertedFile) => {
    if (!cf.outputBlob || !cf.outputName) return;
    const url = URL.createObjectURL(cf.outputBlob);
    const a = document.createElement('a');
    a.href = url; a.download = cf.outputName; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllZip = async (specificFiles?: ConvertedFile[]) => {
    const done = specificFiles || files.filter(f => f.status === 'done' && f.outputBlob);
    if (done.length === 0) return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    done.forEach(f => { if (f.outputBlob && f.outputName) zip.file(f.outputName, f.outputBlob); });
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url; a.download = 'tfy-converted.zip'; a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = files.filter(f => f.status === 'done').length;
  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'error').length;
  const isConverting = files.some(f => f.status === 'converting');

  const tabs: { key: ConverterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'images', label: 'Images', icon: <Image size={15} /> },
    { key: 'text', label: 'Text / Docs', icon: <FileText size={15} /> },
    { key: 'compress', label: 'Compress', icon: <Minimize2 size={15} /> },
  ];

  return (
    <div className="panel panel-outline rounded-2xl liquid-card tfy-diagonal-glow shrink-0" style={{ overflow: 'visible', position: 'relative' }}>
      {/* Header */}
      <button
        type="button"
        className="flex items-center gap-4 w-full text-left p-5"
        onClick={() => setExpanded(v => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 gaming-card-icon"
          style={{ background: 'color-mix(in srgb, var(--accent) 16%, rgba(255,255,255,0.04))' }}>
          <PackageOpen size={24} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white font-semibold text-lg">All-in-One Converter</div>
          <div className="text-sm text-gray-400 mt-0.5">Convert images, text files, compress — all offline, no uploads</div>
        </div>
        <div className="shrink-0 ml-1 transition-transform duration-300"
          style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', color: 'rgba(255,255,255,0.35)' }}>
          <ChevronDown size={18} />
        </div>
      </button>

      <div className={`tfy-collapse-wrapper ${expanded ? 'expanded' : ''}`}>
        <div className="tfy-collapse-content px-5 pb-5">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); clearAll(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center"
                style={{
                  background: tab === t.key ? 'color-mix(in srgb, var(--accent) 18%, rgba(255,255,255,0.06))' : 'transparent',
                  color: tab === t.key ? 'var(--accent)' : 'rgba(255,255,255,0.45)',
                  border: tab === t.key ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid transparent',
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Settings Row */}
          <div className="converter-settings-row mb-4">
            {tab === 'images' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-2">
                  Convert to
                  <ArrowRight size={10} style={{ color: 'var(--accent)', opacity: 0.6 }} />
                </span>
                <CustomDropdown
                  value={imgFormat}
                  options={IMAGE_FORMATS.map(f => ({ value: f, label: formatLabel(f) }))}
                  onChange={v => setImgFormat(v as ImageFormat)}
                />
                {(imgFormat === 'jpeg' || imgFormat === 'webp') && (
                  <label className="text-xs text-gray-400 flex items-center gap-2">
                    Quality: <span className="text-accent font-semibold w-8">{imgQuality}%</span>
                    <input type="range" min={10} max={100} value={imgQuality}
                      onChange={e => setImgQuality(Number(e.target.value))} className="converter-range" />
                  </label>
                )}
                <label className="text-xs text-gray-400 flex items-center gap-2">
                  Max W:
                  <input type="number" min={0} value={imgMaxW} onChange={e => setImgMaxW(Number(e.target.value))}
                    className="converter-num-input" placeholder="0=auto" />
                </label>
                <label className="text-xs text-gray-400 flex items-center gap-2">
                  Max H:
                  <input type="number" min={0} value={imgMaxH} onChange={e => setImgMaxH(Number(e.target.value))}
                    className="converter-num-input" placeholder="0=auto" />
                </label>
              </div>
            )}
            {tab === 'text' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-gray-400">Conversion:</span>
                <CustomDropdown
                  value={textConv}
                  options={TEXT_CONVERSIONS.map(c => ({ value: c.to, label: c.label }))}
                  onChange={v => setTextConv(v)}
                />
              </div>
            )}
            {tab === 'compress' && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-gray-400 flex items-center gap-2">
                  Quality: <span className="text-accent font-semibold w-8">{compQuality}%</span>
                  <input type="range" min={5} max={95} value={compQuality}
                    onChange={e => setCompQuality(Number(e.target.value))} className="converter-range" />
                </label>
                <label className="text-xs text-gray-400 flex items-center gap-2">
                  Max W:
                  <input type="number" min={0} value={compMaxW} onChange={e => setCompMaxW(Number(e.target.value))}
                    className="converter-num-input" />
                </label>
                <label className="text-xs text-gray-400 flex items-center gap-2">
                  Max H:
                  <input type="number" min={0} value={compMaxH} onChange={e => setCompMaxH(Number(e.target.value))}
                    className="converter-num-input" />
                </label>
              </div>
            )}
          </div>

          {/* Drop Zone */}
          <div
            className={`converter-dropzone ${dragging ? 'dragging' : ''} ${files.length > 0 ? 'has-files' : ''}`}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" multiple accept={acceptMap[tab]}
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
              style={{ display: 'none' }} />
            <Upload size={28} style={{ color: 'var(--accent)', opacity: 0.7 }} />
            <div className="text-sm text-gray-300 mt-2">
              Drag & drop files here or <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>browse</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {tab === 'images' && 'PNG, JPG, WEBP, BMP, GIF • Max 20 files'}
              {tab === 'text' && 'TXT, CSV, JSON, MD • Max 20 files'}
              {tab === 'compress' && 'PNG, JPG, WEBP, BMP • Max 20 files'}
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-3 space-y-2 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in srgb, var(--accent) 40%, transparent) transparent' }}>
              {files.map(cf => (
                <div key={cf.id} className="converter-file-card">
                  {/* Thumbnail */}
                  {cf.previewUrl && (
                    <div className="converter-thumb">
                      <img src={cf.previewUrl} alt="" />
                    </div>
                  )}
                  {!cf.previewUrl && (
                    <div className="converter-thumb converter-thumb-text">
                      <FileText size={16} style={{ color: 'var(--accent)', opacity: 0.6 }} />
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate flex items-center gap-2">
                      {cf.originalName}
                      {tab === 'images' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)'
                        }}>
                          {cf.originalName.split('.').pop()?.toUpperCase()}
                          <span style={{ margin: '0 3px', opacity: 0.4 }}>→</span>
                          <span style={{ color: 'var(--accent)' }}>{formatLabel(imgFormat)}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      {formatBytes(cf.originalSize)}
                      {cf.status === 'done' && cf.outputSize != null && (
                        <>
                          <ArrowRight size={10} />
                          <span style={{ color: 'var(--accent)' }}>{formatBytes(cf.outputSize)}</span>
                          {cf.outputSize < cf.originalSize && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{
                              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                              color: 'var(--accent)'
                            }}>
                              -{Math.round((1 - cf.outputSize / cf.originalSize) * 100)}%
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Status / Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {cf.status === 'converting' && <Loader2 size={16} className="animate-spin text-accent" />}
                    {cf.status === 'done' && (
                      <>
                        <Check size={16} style={{ color: 'var(--accent)' }} />
                        <button onClick={(e) => { e.stopPropagation(); downloadOne(cf); }}
                          className="converter-dl-btn" title="Download">
                          <Download size={13} />
                        </button>
                      </>
                    )}
                    {cf.status === 'error' && (
                      <span className="text-xs text-red-400 max-w-[120px] truncate" title={cf.error}>{cf.error}</span>
                    )}
                    <button onClick={() => removeFile(cf.id)} className="converter-remove-btn" title="Remove">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {files.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <button onClick={clearAll} className="btn-ghost text-xs flex items-center gap-1.5 text-gray-400 hover:text-white">
                  <Trash2 size={13} /> Clear All
                </button>
                <span className="text-xs text-gray-500">
                  {files.length} file{files.length !== 1 ? 's' : ''}
                  {doneCount > 0 && <> • <span className="text-accent">{doneCount} done</span></>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {doneCount > 1 && (
                  <button onClick={downloadAllZip}
                    className="btn-ghost text-xs flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                    <Download size={13} /> ZIP All
                  </button>
                )}
                <button onClick={convertAll} disabled={isConverting || pendingCount === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: isConverting || pendingCount === 0
                      ? 'rgba(255,255,255,0.05)'
                      : 'color-mix(in srgb, var(--accent) 20%, rgba(255,255,255,0.06))',
                    color: isConverting || pendingCount === 0 ? 'rgba(255,255,255,0.3)' : 'var(--accent)',
                    border: `1px solid ${isConverting || pendingCount === 0 ? 'rgba(255,255,255,0.06)' : 'color-mix(in srgb, var(--accent) 35%, transparent)'}`,
                    cursor: isConverting || pendingCount === 0 ? 'not-allowed' : 'pointer',
                  }}>
                  {isConverting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  {isConverting ? 'Converting...' : `Convert ${pendingCount > 0 ? `(${pendingCount})` : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
