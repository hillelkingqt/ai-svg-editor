
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
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg ring-1 ring-white/10 flex flex-col overflow-hidden transition-all duration-300 focus-within:ring-sky-400">
      <div className="flex-shrink-0 bg-slate-800/60 px-4 py-2 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">SVG Code Editor</h2>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-400 ${
            isCopied
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
          }`}
        >
          {isCopied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
          <span>{isCopied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="flex-1 p-2 relative">
        <textarea
          value={value}
          onChange={handleChange}
          spellCheck="false"
          aria-label="SVG Code Editor"
          className="font-mono text-sm w-full h-full p-3 bg-transparent text-slate-300 placeholder-slate-500 resize-none outline-none leading-relaxed"
          placeholder="<svg>...</svg>"
        />
      </div>
    </div>
  );
};

export default SvgEditor;