import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { GoogleGenAI, Chat as GeminiChat, Part } from "@google/genai";
import { CloseIcon } from './icons/CloseIcon';
import { SendIcon } from './icons/SendIcon';
import { AiIcon } from './icons/AiIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { CheckIcon } from './icons/CheckIcon';

type MessageType = 'text' | 'creation';

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text?: string;
  image?: string; 
  type: MessageType;
  creation?: {
    name: string;
    status: 'creating' | 'created';
  };
}

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
  onSvgCodeChange: (newCode: string) => void;
  onSvgTitleChange: (title: string) => void;
  initialCode: string;
}

const systemInstruction = `You are a visionary, artistic AI assistant running on Gemini 3 Pro. You specialize in Scalable Vector Graphics (SVG). 

**Style Guide:**
- Your tone is sophisticated, creative, and enthusiastic.
- You think deeply before you draw.

**Strict Protocol for Drawing:**
When asked to draw or modify an SVG:
1.  **Thinking Phase:** First, you MUST briefly explain your design choices and reasoning.
2.  **Naming:** Write \`NAME: \` followed by a title.
3.  **Code:** Write the raw SVG code on a new line (start with <svg, no markdown).
4.  **Completion:** Write \`STATUS: DONE\` after the svg tag.
5.  **Closing:** A short elegant closing remark.`;

const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

const Chat: React.FC<ChatProps> = ({ isOpen, onClose, onSvgCodeChange, onSvgTitleChange, initialCode }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Greetings. I am Gemini 3 Pro. I can visualize your imagination. What shall we create together today?", sender: 'ai', type: 'text' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingState, setThinkingState] = useState<'idle' | 'thinking' | 'generating'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chat = useMemo<GeminiChat | null>(() => {
    try {
      if (!process.env.API_KEY) throw new Error("API key is missing.");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using gemini-3-pro-preview with thinking budget as requested
      return ai.chats.create({ 
        model: 'gemini-3-pro-preview', 
        config: { 
            systemInstruction,
            thinkingConfig: { thinkingBudget: 16384 } 
        }
      });
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, thinkingState]);
  
  useEffect(() => {
    if (isOpen) {
        setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
      if (attachedFile) {
        const objectUrl = URL.createObjectURL(attachedFile);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
      } else {
        setPreviewUrl(null);
      }
  }, [attachedFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        setAttachedFile(file);
    }
    event.target.value = '';
  };

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                setAttachedFile(file);
                break;
            }
        }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedFile) || isLoading || !chat) return;

    const userMessage: Message = { id: Date.now(), text: input, sender: 'user', type: 'text', image: previewUrl ?? undefined };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);
    setThinkingState('thinking');
    setError(null);

    try {
      const parts: (string | Part)[] = [`Current SVG Code Context:\n\`\`\`svg\n${initialCode}\n\`\`\`\n\nRequest: ${input}`];
      if (attachedFile) {
        const imagePart = await fileToGenerativePart(attachedFile);
        parts.push(imagePart);
      }
      
      const responseStream = await chat.sendMessageStream({ message: parts });
      
      let buffer = '';
      let state: 'reasoning' | 'finding_name' | 'streaming_svg' | 'streaming_follow_up' = 'reasoning';
      let creationMessageId: number | null = null;
      let followUpMessageId: number | null = null;
      let currentSvgCode = '';
      let textResponseId = Date.now() + 10;

      // Initial Placeholder for text response
      setMessages(prev => [...prev, { id: textResponseId, text: '', sender: 'ai', type: 'text' }]);

      for await (const chunk of responseStream) {
        // Since we can't easily distinguish 'thought' from 'text' in the stream without complex parsing
        // (as the API mixes them or hides thoughts), we treat early text as reasoning/intro.
        const chunkText = chunk.text || '';
        buffer += chunkText;

        if (state === 'reasoning') {
            // Check if we hit the name protocol
            const nameMatch = buffer.match(/NAME: (.*)\n/);
            if (nameMatch) {
                setThinkingState('generating');
                const name = nameMatch[1].trim();
                onSvgTitleChange(name);
                
                // Finalize the reasoning text in the message
                const reasoningText = buffer.substring(0, nameMatch.index).trim();
                setMessages(prev => prev.map(msg => 
                    msg.id === textResponseId ? { ...msg, text: reasoningText } : msg
                ));

                creationMessageId = Date.now() + 20;
                setMessages(prev => [...prev, {
                    id: creationMessageId!,
                    sender: 'ai',
                    type: 'creation',
                    creation: { name, status: 'creating' }
                }]);
                
                buffer = buffer.substring(nameMatch.index! + nameMatch[0].length);
                state = 'streaming_svg';
                onSvgCodeChange(''); 
                currentSvgCode = '';
            } else {
                // Stream reasoning/intro text
                 setMessages(prev => prev.map(msg => 
                    msg.id === textResponseId ? { ...msg, text: buffer } : msg
                ));
            }
        }
        
        if (state === 'streaming_svg') {
            const statusMatch = buffer.indexOf('STATUS: DONE');
            if (statusMatch !== -1) {
                const svgPart = buffer.substring(0, statusMatch);
                currentSvgCode += svgPart;
                onSvgCodeChange(currentSvgCode);
                setMessages(prev => prev.map(msg => 
                    msg.id === creationMessageId ? { ...msg, creation: { ...msg.creation!, status: 'created' } } : msg
                ));
                buffer = buffer.substring(statusMatch + 'STATUS: DONE'.length).trimStart();
                state = 'streaming_follow_up';
                followUpMessageId = Date.now() + 30;
                setMessages(prev => [...prev, { id: followUpMessageId!, text: '', sender: 'ai', type: 'text' }]);
            } else {
                currentSvgCode += buffer;
                onSvgCodeChange(currentSvgCode);
                buffer = '';
            }
        }

        if (state === 'streaming_follow_up') {
             setMessages(prev => prev.map(msg => 
                msg.id === followUpMessageId ? { ...msg, text: (msg.text || '') + chunkText } : msg
            ));
        }
      }

    } catch (e) {
        const errorMessage = "I encountered an anomaly in the creative matrix. Please try again.";
        setError(errorMessage);
        setMessages(prev => [...prev, { id: Date.now(), text: errorMessage, sender: 'ai', type: 'text' }]);
    } finally {
        setIsLoading(false);
        setThinkingState('idle');
    }
  };

  const renderMessageContent = (message: Message) => {
    if (message.type === 'creation' && message.creation) {
      const { name, status } = message.creation;
      const isCreating = status === 'creating';
      return (
        <div className={`p-4 rounded-2xl animate-fade-in-up glass-panel border-l-4 border-l-sky-500 overflow-hidden relative`}>
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-violet-500/10"></div>
          <div className="flex items-center gap-3 relative z-10">
            {isCreating ? (
              <div className="relative flex h-5 w-5">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-5 w-5 bg-sky-500"></span>
              </div>
            ) : (
              <div className="bg-emerald-500/20 p-1.5 rounded-full border border-emerald-500/30">
                  <CheckIcon className="w-4 h-4 text-emerald-400"/>
              </div>
            )}
            <div>
                 <p className="text-[10px] text-sky-300 uppercase tracking-widest font-bold mb-0.5">{isCreating ? 'GENERATING GRAPHICS' : 'RENDER COMPLETE'}</p>
                 <p className="font-semibold text-white text-base">{name}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
       <div 
          className={`p-4 rounded-2xl animate-fade-in-up shadow-xl backdrop-blur-md border ${
              message.sender === 'user' 
              ? 'bg-gradient-to-br from-violet-600/90 to-fuchsia-600/90 text-white border-white/10 rounded-br-none' 
              : 'glass-panel text-slate-200 rounded-bl-none'
          }`}
          style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}
      >
          <p className="text-sm leading-relaxed whitespace-pre-wrap font-light tracking-wide">{message.text || ' '}</p>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className={`fixed top-0 left-0 bottom-0 z-50 w-full max-w-lg flex flex-col transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1) ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        onPaste={handlePaste}
      >
        <div className="flex-1 flex flex-col glass-panel m-3 sm:m-4 rounded-[2rem] overflow-hidden shadow-2xl shadow-black/50 border border-white/10 relative">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/5 to-transparent h-32"></div>
            
            {/* Header */}
            <header className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3">
                <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-r from-sky-400 to-fuchsia-500 rounded-full blur opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse-slow"></div>
                    <div className="relative bg-black/40 p-2.5 rounded-xl border border-white/10">
                        <AiIcon className="w-5 h-5 text-white"/>
                    </div>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Gemini 3 Pro</h2>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <p className="text-xs text-sky-300 font-medium tracking-wide">Live Reasoning Active</p>
                    </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10">
                <CloseIcon className="w-6 h-6" />
              </button>
            </header>
            
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth z-10">
              {messages.map((message) => (
                <div key={message.id} className={`flex items-start gap-3 w-full ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                  {message.sender === 'ai' && (
                    <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/20">
                      <AiIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`flex flex-col gap-2 max-w-[85%] ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    {message.image && (
                         <img src={message.image} alt="User upload" className="rounded-xl max-h-48 w-auto mb-2 border border-white/20 shadow-lg" />
                    )}
                    {renderMessageContent(message)}
                  </div>
                </div>
              ))}
              
              {/* Thinking Indicator */}
              {thinkingState === 'thinking' && (
                 <div className="flex items-start gap-3 animate-fade-in w-full">
                   <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/20">
                      <AiIcon className="w-4 h-4 text-white" />
                    </div>
                   <div className="glass-input px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-3 border border-sky-500/30 shadow-[0_0_20px_rgba(14,165,233,0.15)] flex-1 max-w-[85%]">
                     <div className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></span>
                        <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></span>
                        <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></span>
                     </div>
                     <span className="text-xs font-mono text-sky-300 tracking-wider uppercase">Deep Reasoning Process...</span>
                   </div>
                 </div>
              )}
               {error && !isLoading && (
                  <div className="flex justify-center p-2 animate-fade-in">
                      <p className="text-xs font-mono text-red-300 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg backdrop-blur-sm">{error}</p>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <footer className="p-5 border-t border-white/5 bg-black/40 backdrop-blur-xl z-20">
              {previewUrl && (
                  <div className="relative mb-3 inline-block animate-fade-in-up">
                      <img src={previewUrl} alt="Preview" className="h-16 rounded-lg border border-white/20 shadow-lg"/>
                      <button onClick={() => setAttachedFile(null)} className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 border border-white/20 hover:bg-red-500 hover:border-red-500 transition-colors">
                          <CloseIcon className="w-3 h-3" />
                      </button>
                  </div>
              )}
              <form onSubmit={handleSubmit} className="flex items-end gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3.5 glass-button text-slate-300 rounded-xl hover:text-sky-300 group transition-all"
                    title="Upload Image"
                >
                    <PaperclipIcon className="w-5 h-5 group-hover:scale-110 transition-transform"/>
                </button>
                <div className="relative flex-1 group">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Describe your vision..."
                      disabled={isLoading || !!error}
                      className="w-full glass-input text-sm text-white placeholder-slate-400 rounded-xl pl-4 pr-12 py-3.5 outline-none focus:border-sky-500/50 focus:bg-white/5 transition-all disabled:opacity-50"
                    />
                    <button 
                      type="submit" 
                      disabled={isLoading || (!input.trim() && !attachedFile) || !!error}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-tr from-sky-500 to-indigo-500 text-white rounded-lg hover:shadow-[0_0_15px_rgba(14,165,233,0.4)] disabled:opacity-50 disabled:shadow-none transition-all duration-300"
                    >
                      <SendIcon className="w-4 h-4"/>
                    </button>
                </div>
              </form>
            </footer>
        </div>
      </div>
    </>
  );
};

export default Chat;