import React, { useState } from 'react';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';

interface SvgEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const SvgEditor: React.FC<SvgEditorProps> = ({ value, onChange }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };
  
  return (
    <div className="glass-panel rounded-3xl flex flex-col overflow-hidden transition-all duration-300 ring-1 ring-white/10 hover:ring-white/20">
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80"></div>
            <h2 className="text-sm font-medium text-slate-200 ml-2 tracking-wide">Code Editor</h2>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300 ${
            isCopied
              ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white ring-1 ring-white/10'
          }`}
        >
          {isCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
          <span>{isCopied ? 'Copied' : 'Copy Code'}</span>
        </button>
      </div>
      <div className="flex-1 p-1 relative group">
        <textarea
          value={value}
          onChange={handleChange}
          spellCheck="false"
          aria-label="SVG Code Editor"
          className="font-mono text-[13px] w-full h-full p-4 bg-transparent text-slate-200 placeholder-slate-500 resize-none outline-none leading-relaxed selection:bg-indigo-500/30"
          placeholder="<svg>...</svg>"
        />
      </div>
    </div>
  );
};

export default SvgEditor;