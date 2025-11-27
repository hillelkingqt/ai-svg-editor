import React from 'react';
import { CodeIcon } from './icons/CodeIcon';
import { ChatIcon } from './icons/ChatIcon';

interface HeaderProps {
  onToggleChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleChat }) => {
  return (
    <header className="flex-shrink-0 flex items-center justify-between z-10">
      <div className="flex items-center gap-4">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-3.5 rounded-2xl shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
          <CodeIcon className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">
            Live SVG Visualizer
          </h1>
          <p className="text-slate-300 text-sm font-medium tracking-wide opacity-80">
            Designing with <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-indigo-300">Gemini 3 Pro</span>
          </p>
        </div>
      </div>
      <button 
        onClick={onToggleChat}
        aria-label="Toggle AI Assistant"
        className="glass-button flex items-center gap-2 px-5 py-2.5 rounded-xl text-white shadow-lg shadow-black/10 group"
      >
        <ChatIcon className="w-5 h-5 group-hover:text-sky-300 transition-colors" />
        <span className="hidden sm:inline text-sm font-medium">AI Designer</span>
      </button>
    </header>
  );
};

export default Header;