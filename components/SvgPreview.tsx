import React, { useRef } from 'react';
import { DownloadIcon } from './icons/DownloadIcon';
import { ImageIcon } from './icons/ImageIcon';

interface SvgPreviewProps {
  svgCode: string;
  title: string;
}

const SvgPreview: React.FC<SvgPreviewProps> = ({ svgCode, title }) => {
  const previewRef = useRef<HTMLDivElement>(null);

  const generateFilename = (extension: string) => {
      const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      return `${sanitizedTitle || 'download'}.${extension}`;
  }

  const handleDownloadSVG = () => {
    const blob = new Blob([svgCode], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFilename('svg');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = () => {
    if (!previewRef.current) return;
    const svgElement = previewRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const svgRect = svgElement.getBoundingClientRect();
      const scale = 2; 
      canvas.width = svgRect.width * scale;
      canvas.height = svgRect.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL('image/png');
      
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = generateFilename('png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="glass-panel rounded-3xl flex flex-col overflow-hidden ring-1 ring-white/10 hover:ring-white/20 transition-all duration-300">
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/5">
        <h2 className="text-sm font-medium text-slate-200 tracking-wide">Live Canvas</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPNG}
            className="glass-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white"
            title="Download as PNG"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
          <button
            onClick={handleDownloadSVG}
            className="glass-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white"
            title="Download as SVG"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </div>
      <div className="flex-1 checkerboard-bg p-8 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-sky-500/5 pointer-events-none"></div>
        <div
          ref={previewRef}
          className="w-full h-full animate-fade-in flex items-center justify-center filter drop-shadow-2xl"
          dangerouslySetInnerHTML={{ __html: svgCode }}
        />
      </div>
    </div>
  );
};

export default SvgPreview;