
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
      // Use natural SVG dimensions for higher quality export
      const svgRect = svgElement.getBoundingClientRect();
      const scale = 2; // Upscale for better resolution
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
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg ring-1 ring-white/10 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-slate-800/60 px-4 py-2 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">Live Preview</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPNG}
            className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-400 bg-slate-700/50 hover:bg-slate-700 text-slate-300"
            title="Download as PNG"
            aria-label="Download as PNG"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
          <button
            onClick={handleDownloadSVG}
            className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-400 bg-slate-700/50 hover:bg-slate-700 text-slate-300"
            title="Download as SVG"
            aria-label="Download as SVG"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </div>
      <div className="flex-1 checkerboard-bg p-4 flex items-center justify-center">
        <div
          ref={previewRef}
          className="w-full h-full animate-fade-in flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svgCode }}
        />
      </div>
    </div>
  );
};

export default SvgPreview;
