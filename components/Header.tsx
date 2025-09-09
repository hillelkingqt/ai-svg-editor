
import React from 'react';
import { CodeIcon } from './icons/CodeIcon';
import { ChatIcon } from './icons/ChatIcon';

interface HeaderProps {
  onToggleChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleChat }) => {
  return (
    <header className="flex-shrink-0 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-gradient-to-br from-sky-400 to-violet-500 p-3 rounded-xl shadow-lg">
          <CodeIcon className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Live SVG Visualizer
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Bring your SVG code to life, instantly.
          </p>
        </div>
      </div>
      <button 
        onClick={onToggleChat}
        aria-label="Toggle AI Assistant"
        className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-sm ring-1 ring-white/10 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-700/80 transition-all duration-200 shadow-md hover:shadow-sky-500/20 focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        <ChatIcon className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-medium">AI Assistant</span>
      </button>
    </header>
  );
};

export default Header;
