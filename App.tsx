import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import SvgEditor from './components/SvgEditor';
import SvgPreview from './components/SvgPreview';
import Chat from './components/Chat';

const initialSvgCode = `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
  <!-- Created by AI for a beautiful demo -->
  <defs>
    <linearGradient id="coolGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color: #8b5cf6;" />
      <stop offset="100%" style="stop-color: #38bdf8;" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
      <feMerge>
        <feMergeNode in="coloredBlur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  
  <rect 
    x="60" y="60" 
    width="120" height="120" 
    rx="30" 
    fill="url(#coolGradient)" 
    filter="url(#glow)"
  >
    <animate 
      attributeName="rx" 
      values="30;60;30" 
      dur="4s" 
      repeatCount="indefinite" 
    />
    <animateTransform
      attributeName="transform"
      type="rotate"
      from="0 120 120"
      to="360 120 120"
      dur="12s"
      repeatCount="indefinite"
    />
  </rect>
</svg>
`;

const App: React.FC = () => {
  const [svgCode, setSvgCode] = useState<string>(initialSvgCode);
  const [svgTitle, setSvgTitle] = useState<string>('ai-artwork');
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  const updateSvgCode = useCallback((newCode: string) => {
    setSvgCode(newCode);
    setPreviewKey(prevKey => prevKey + 1);
  }, []);

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 animate-fade-in-up">
      <Header onToggleChat={() => setIsChatOpen(prev => !prev)} />
      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 min-h-0">
        <SvgEditor value={svgCode} onChange={updateSvgCode} />
        <SvgPreview svgCode={svgCode} key={previewKey} title={svgTitle} />
      </main>
      <Chat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        onSvgCodeChange={updateSvgCode}
        onSvgTitleChange={setSvgTitle}
        initialCode={svgCode}
      />
    </div>
  );
};

export default App;