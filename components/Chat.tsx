
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { GoogleGenAI, Chat as GeminiChat, Part, FunctionDeclaration, Type, Tool } from "@google/genai";
import { CloseIcon } from './icons/CloseIcon';
import { SendIcon } from './icons/SendIcon';
import { AiIcon } from './icons/AiIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CodeIcon } from './icons/CodeIcon';

// --- Types ---

type MessageType = 'text' | 'tool_log';

interface Message {
  id: number;
  sender: 'user' | 'ai' | 'system';
  text?: string;
  thought?: string; // Added field for reasoning process
  image?: string; 
  type: MessageType;
  toolInfo?: {
    name: string;
    args: any;
    status: 'calling' | 'success' | 'error';
  };
  isStreaming?: boolean;
}

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
  onSvgCodeChange: (newCode: string) => void;
  onSvgTitleChange: (title: string) => void;
  initialCode: string;
}

// --- Configuration ---

const API_KEYS = [
  "AIzaSyCNa9wXjw3y73NpW1bmTq_fo9WITIe1VEo",
  "AIzaSyDtUpEnn34E64_8kcpapeTHzNVfzvETJ6c",
  "AIzaSyDFtXm_9m-3MqKDfeoNQQXSRLNZygswvgs"
];

const updateCanvasTool: FunctionDeclaration = {
  name: "update_canvas",
  description: "Updates the SVG canvas title and metadata. The ACTUAL SVG code should be written in the text response for live rendering.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "A short, creative title for the artwork."
      },
      description: {
        type: Type.STRING,
        description: "A very brief summary of what was changed."
      }
    },
    required: ["title"]
  }
};

const tools: Tool[] = [{ functionDeclarations: [updateCanvasTool] }];

// Updated system instruction to force code output in text for live streaming
const systemInstruction = `You are a world-class SVG Generative Artist running on Gemini 3 Pro.
Your goal is to create stunning, efficient, and creative SVGs based on user requests.

**CRITICAL PROTOCOL FOR DRAWING:**
1.  **Thinking:** First, plan your design in the thought block.
2.  **Live Coding:** YOU MUST write the full SVG code explicitly in your text response inside a Markdown code block like this:
    \`\`\`xml
    <svg ...>
      ...
    </svg>
    \`\`\`
    This allows the user to see the image being drawn line-by-line in real-time.
3.  **Finalize:** After writing the code, call the \`update_canvas\` tool to set the title.

**Directives:**
-   Always start the SVG with \`<svg\` and ensure it has \`xmlns="http://www.w3.org/2000/svg"\`.
-   If the user speaks Hebrew, reply in Hebrew.
-   Be concise, professional, and artistic.`;

// --- Helpers ---

// Simple Hebrew detection
const isHebrew = (text: string) => {
  return /[\u0590-\u05FF]/.test(text);
};

// Artifact Component to replace raw code blocks
const CodeArtifact: React.FC<{ isComplete: boolean }> = ({ isComplete }) => (
    <div className="my-3 mx-1 bg-black/40 border border-white/10 rounded-xl overflow-hidden shadow-lg select-none group">
        <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5">
            <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${isComplete ? 'bg-emerald-500/20' : 'bg-sky-500/20'}`}>
                   {isComplete ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> : <CodeIcon className="w-3.5 h-3.5 text-sky-400" />}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200 tracking-wide">
                        {isComplete ? 'Artwork Generated' : 'Generating Artwork...'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">SVG Vector Graphics</span>
                </div>
            </div>
            {!isComplete && (
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"></div>
                </div>
            )}
        </div>
        <div className="px-4 py-2 bg-black/20">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500/50"></span>
                Canvas updated automatically
            </div>
        </div>
        <div className="h-0.5 w-full bg-white/5">
            {!isComplete && (
                 <div className="h-full bg-sky-500/50 w-1/3 animate-[shimmer_1.5s_infinite_linear] bg-gradient-to-r from-transparent via-sky-400 to-transparent transform -translate-x-full" style={{ width: '100%', transformOrigin: '0% 50%' }}></div>
            )}
        </div>
        <style>{`
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
        `}</style>
    </div>
);

// Simple Markdown Renderer Component
const SimpleMarkdown: React.FC<{ text: string; isThought?: boolean }> = ({ text, isThought = false }) => {
  if (!text) return null;

  // Split by code blocks first to avoid formatting inside code
  const parts = text.split(/(```[\s\S]*?```|```[\s\S]*$)/g);

  return (
    <span className={isHebrew(text) ? "text-right" : "text-left"}>
      {parts.map((part, index) => {
        // Check if this is a code block
        if (part.startsWith('```')) {
            const isSvg = part.includes('xml') || part.includes('<svg');
            
            // If it's an SVG block, render the Artifact UI instead of code
            if (isSvg && !isThought) {
                const isComplete = part.endsWith('```');
                return <CodeArtifact key={index} isComplete={isComplete} />;
            }

            // Normal code blocks
            const content = part.replace(/^```\w*\n?|```$/g, '');
            return (
                <code key={index} className={`block my-2 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap border ${isThought ? 'bg-black/20 text-indigo-200 border-indigo-500/20' : 'bg-black/30 text-sky-300 border-white/10'}`}>
                {content}
                </code>
            );
        }

        // Process bold, italics, etc.
        const lines = part.split('\n');
        return lines.map((line, lineIndex) => {
           // Header detection (#)
           if (line.trim().startsWith('# ')) {
               return <h3 key={`${index}-${lineIndex}`} className={`text-lg font-bold my-2 ${isThought ? 'text-indigo-100' : 'text-white'}`}>{line.replace('# ', '')}</h3>
           }
           
           // Bold detection (**)
           const segments = line.split(/(\*\*.*?\*\*)/g);
           return (
             <React.Fragment key={`${index}-${lineIndex}`}>
                <div className="min-h-[1.2em]">
                    {segments.map((seg, segIndex) => {
                        if (seg.startsWith('**') && seg.endsWith('**')) {
                            return <strong key={segIndex} className={isThought ? 'text-indigo-200 font-bold' : 'text-white font-semibold'}>{seg.slice(2, -2)}</strong>;
                        }
                        return seg;
                    })}
                </div>
             </React.Fragment>
           );
        });
      })}
    </span>
  );
};

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

// Helper to extract SVG from streaming text
const extractSvgFromText = (text: string): string | null => {
    // Look for <svg ... > ... (possibly incomplete)
    // We try to find the last opening <svg tag and capture everything after it
    const match = text.match(/<svg[\s\S]*/i);
    if (!match) return null;
    
    let svgContent = match[0];
    
    // Clean up markdown code block start if present (unlikely due to regex, but safe to check)
    svgContent = svgContent.replace(/^```xml\n/, '').replace(/^```\n/, '');

    // If it's inside a code block that hasn't closed, it might have trailing chars, but usually browser parsers ignore text after </svg> 
    // strictly speaking we want to capture until </svg> if it exists, or end of string
    const closingMatch = svgContent.match(/<\/svg>/i);
    if (closingMatch) {
        const endIndex = closingMatch.index! + 6;
        svgContent = svgContent.substring(0, endIndex);
    }

    return svgContent;
};

// --- Component ---

const Chat: React.FC<ChatProps> = ({ isOpen, onClose, onSvgCodeChange, onSvgTitleChange, initialCode }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
        id: 1, 
        text: "Ready to design. Describe what you want to see.", 
        sender: 'ai', 
        type: 'text' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // Visual thinking state (spinner)
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Chat Client
  const chat = useMemo<GeminiChat | null>(() => {
    try {
      // 1. Random API Key Rotation
      const apiKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
      
      const ai = new GoogleGenAI({ apiKey });
      return ai.chats.create({ 
        model: 'gemini-3-pro-preview', 
        config: { 
            systemInstruction,
            tools,
            thinkingConfig: { 
              includeThoughts: true, // Enable thought summaries
              thinkingBudget: 4096 
            }
        }
      });
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isThinking]);
  
  // Auto focus
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // Image preview
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

    // 1. Add User Message
    const userMessage: Message = { id: Date.now(), text: input, sender: 'user', type: 'text', image: previewUrl ?? undefined };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);
    setIsThinking(true); 
    setError(null);

    try {
      const parts: (string | Part)[] = [];
      
      // Inject correct context
      const prompt = `Current SVG Code:
\`\`\`xml
${initialCode}
\`\`\`
Task: ${input}`;
      
      parts.push(prompt);
      
      if (attachedFile) {
        const imagePart = await fileToGenerativePart(attachedFile);
        parts.push(imagePart);
      }
      
      const responseStream = await chat.sendMessageStream({ message: parts });
      
      let currentAiMessageId = Date.now() + 10;
      let hasAddedAiMessage = false;
      let aiTextAccumulator = '';
      let thoughtAccumulator = '';

      for await (const chunk of responseStream) {
         // Stop the initial "spinner" thinking state once we get ANY content
         setIsThinking(false);

         // 1. Handle Function Calls
         const functionCalls = chunk.functionCalls;
         if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
                if (call.name === 'update_canvas') {
                    // Log the tool usage in chat
                    const toolMsgId = Date.now() + Math.random();
                    setMessages(prev => [...prev, {
                        id: toolMsgId,
                        sender: 'system',
                        type: 'tool_log',
                        toolInfo: {
                            name: 'Updating Metadata',
                            args: call.args,
                            status: 'calling'
                        }
                    }]);

                    try {
                        const { title } = call.args as any;
                        // EXECUTE THE TOOL
                        if (title) onSvgTitleChange(title);

                        // Update tool log to success
                        setMessages(prev => prev.map(m => 
                            m.id === toolMsgId && m.type === 'tool_log' 
                            ? { ...m, toolInfo: { ...m.toolInfo!, status: 'success' } } 
                            : m
                        ));

                        // Send confirmation back to model (Required for multi-turn tool use)
                        await chat.sendMessage({
                            message: [{
                                functionResponse: {
                                    name: 'update_canvas',
                                    response: { result: 'success', message: 'Title updated.' },
                                    id: call.id
                                }
                            }]
                        });

                    } catch (err) {
                        console.error("Tool execution failed", err);
                         setMessages(prev => prev.map(m => 
                            m.id === toolMsgId && m.type === 'tool_log' 
                            ? { ...m, toolInfo: { ...m.toolInfo!, status: 'error' } } 
                            : m
                        ));
                    }
                }
            }
         }

         // 2. Handle Text & Thinking Content
         const candidateParts = chunk.candidates?.[0]?.content?.parts || [];
         let contentUpdated = false;

         for (const part of candidateParts) {
             // EXTRACT THINKING PROCESS
             // Supports 'thought' property for Gemini 3
             // @ts-ignore
             const isThought = part.thought === true || typeof part.thought === 'string';
             
             if (isThought) {
                 // If part.thought is a string (some versions), use it. If it's true, use part.text.
                 // @ts-ignore
                 const textToAppend = typeof part.thought === 'string' ? part.thought : part.text;
                 if (textToAppend) {
                    thoughtAccumulator += textToAppend;
                    contentUpdated = true;
                 }
             } 
             // Regular text content
             else if (part.text) {
                 aiTextAccumulator += part.text;
                 contentUpdated = true;
                 
                 // LIVE SVG EXTRACTION
                 const potentialSvg = extractSvgFromText(aiTextAccumulator);
                 if (potentialSvg && potentialSvg.length > 20) {
                     onSvgCodeChange(potentialSvg);
                 }
             }
         }

         if (contentUpdated) {
             if (!hasAddedAiMessage) {
                 setMessages(prev => [...prev, { 
                     id: currentAiMessageId, 
                     text: aiTextAccumulator, 
                     thought: thoughtAccumulator,
                     sender: 'ai', 
                     type: 'text',
                     isStreaming: true
                 }]);
                 hasAddedAiMessage = true;
             } else {
                 setMessages(prev => prev.map(m => 
                     m.id === currentAiMessageId 
                     ? { ...m, text: aiTextAccumulator, thought: thoughtAccumulator, isStreaming: true } 
                     : m
                 ));
             }
         }
      }
      
      // Mark streaming as complete for the last message
      setMessages(prev => prev.map(m => 
         m.id === currentAiMessageId ? { ...m, isStreaming: false } : m
      ));

    } catch (e) {
        console.error(e);
        const errorMessage = "Connection interrupted. Please retry.";
        setError(errorMessage);
        setMessages(prev => [...prev, { id: Date.now(), text: errorMessage, sender: 'ai', type: 'text' }]);
    } finally {
        setIsLoading(false);
        setIsThinking(false);
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className={`fixed top-0 left-0 bottom-0 z-50 w-full max-w-[480px] flex flex-col transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1) ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        onPaste={handlePaste}
      >
        <div className="flex-1 flex flex-col bg-[#0f172a] sm:m-4 sm:rounded-[2rem] overflow-hidden shadow-2xl border-r sm:border border-white/10 relative h-full">
            
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between p-5 border-b border-white/5 bg-[#1e293b]/50 backdrop-blur-xl z-20">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-sky-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-sky-500/20">
                    <AiIcon className="w-5 h-5 text-white"/>
                </div>
                <div>
                    <h2 className="text-base font-bold text-slate-100 tracking-tight">Gemini 3 Pro</h2>
                    <p className="text-[10px] text-sky-400 font-medium tracking-wider uppercase">Generative Assistant</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                <CloseIcon className="w-5 h-5" />
              </button>
            </header>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth z-10 custom-scrollbar">
              {messages.map((message) => {
                  const isHeb = message.text ? isHebrew(message.text) : false;
                  
                  // Tool/System Message
                  if (message.type === 'tool_log' && message.toolInfo) {
                      return (
                        <div key={message.id} className="animate-fade-in-up mx-4 my-2">
                             <div className="relative overflow-hidden rounded-xl border border-sky-500/30 bg-sky-900/10 p-3 flex items-center gap-3">
                                <div className={`p-1.5 rounded-full ${message.toolInfo.status === 'calling' ? 'bg-sky-500/20 animate-pulse' : 'bg-emerald-500/20'}`}>
                                    {message.toolInfo.status === 'calling' ? (
                                        <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <CheckIcon className="w-4 h-4 text-emerald-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-sky-300 uppercase tracking-wider">{message.toolInfo.name}</p>
                                    <p className="text-xs text-slate-400 truncate font-mono mt-0.5">
                                        {message.toolInfo.args?.title || 'Updating...'}
                                    </p>
                                </div>
                             </div>
                        </div>
                      );
                  }

                  // Standard Message
                  return (
                    <div key={message.id} className={`flex w-full ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                            
                            {/* Image Attachment */}
                            {message.image && (
                                <img src={message.image} alt="attachment" className="rounded-2xl max-h-48 w-auto mb-2 border border-white/10 shadow-lg object-cover" />
                            )}

                            {/* Thought / Reasoning Bubble (Only for AI) */}
                            {message.thought && message.sender === 'ai' && (
                                <div className="mb-4 w-full animate-fade-in group">
                                    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-slate-950/40 backdrop-blur-md shadow-[0_0_40px_-10px_rgba(79,70,229,0.15)] transition-all duration-500">
                                         
                                        {/* Liquid Gradient Animation Background */}
                                        <div className="absolute -inset-[100%] bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 animate-[spin_10s_linear_infinite] opacity-50 blur-3xl -z-10"></div>
                                        
                                        {/* Header */}
                                        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/5 border-b border-white/5">
                                            <div className="relative flex h-2.5 w-2.5">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gradient-to-r from-indigo-400 to-purple-400"></span>
                                            </div>
                                            <span className="text-[11px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-200 uppercase tracking-widest font-mono">Process of Thought</span>
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="p-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                                            <div className="text-sm text-indigo-200/90 leading-relaxed font-light">
                                                <SimpleMarkdown text={message.thought} isThought={true} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Text Bubble */}
                            {message.text && (
                                <div 
                                    className={`
                                        relative px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm
                                        ${message.sender === 'user' 
                                            ? 'bg-[#3b82f6] text-white rounded-tr-none' 
                                            : 'bg-[#1e293b] text-slate-200 rounded-tl-none border border-white/5'}
                                        ${isHeb ? 'text-right' : 'text-left'}
                                        ${isHeb ? 'font-sans' : ''}
                                    `}
                                    dir={isHeb ? 'rtl' : 'ltr'}
                                >
                                    <SimpleMarkdown text={message.text || ''} />
                                </div>
                            )}
                            
                            {/* Sender Label */}
                            <span className="text-[10px] text-slate-500 mt-1 px-1">
                                {message.sender === 'user' ? 'You' : 'Gemini'}
                            </span>
                        </div>
                    </div>
                  );
              })}
              
              {/* Initial Loading Indicator (Before first chunk) */}
              {isThinking && !messages[messages.length-1]?.thought && (
                 <div className="flex justify-start w-full animate-fade-in">
                    <div className="bg-[#1e293b] border border-white/5 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-3 shadow-lg">
                        <div className="relative w-4 h-4">
                            <span className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-75"></span>
                            <span className="absolute inset-0 bg-violet-500 rounded-full"></span>
                        </div>
                        <span className="text-xs font-mono text-violet-300 tracking-wider animate-pulse">
                            Reasoning...
                        </span>
                    </div>
                 </div>
              )}
              
               {error && !isLoading && (
                  <div className="flex justify-center p-2 animate-fade-in">
                      <p className="text-xs font-medium text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full">{error}</p>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <footer className="p-4 bg-[#0f172a] border-t border-white/5 z-20">
              {previewUrl && (
                  <div className="flex items-center gap-2 mb-3 bg-[#1e293b] p-2 rounded-xl border border-white/10 w-fit animate-fade-in-up">
                      <img src={previewUrl} alt="Preview" className="h-10 w-10 rounded-lg object-cover"/>
                      <span className="text-xs text-slate-400 max-w-[100px] truncate">Image attached</span>
                      <button onClick={() => setAttachedFile(null)} className="ml-2 p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white">
                          <CloseIcon className="w-3 h-3" />
                      </button>
                  </div>
              )}
              
              <form onSubmit={handleSubmit} className="relative group">
                 {/* Glass background for input */}
                 <div className="absolute inset-0 bg-white/5 rounded-2xl blur-sm -z-10"></div>
                 
                 <div className="flex items-center bg-[#1e293b] border border-white/10 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-sky-500/50 focus-within:border-sky-500/50 transition-all shadow-xl">
                    
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-xl transition-all"
                        title="Upload Image"
                    >
                        <PaperclipIcon className="w-5 h-5"/>
                    </button>

                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isLoading || !!error}
                      className={`flex-1 bg-transparent text-sm text-white placeholder-slate-500 px-3 py-2 outline-none disabled:opacity-50 ${isHebrew(input) ? 'text-right' : 'text-left'}`}
                      dir={isHebrew(input) ? 'rtl' : 'ltr'}
                    />

                    <button 
                      type="submit" 
                      disabled={isLoading || (!input.trim() && !attachedFile) || !!error}
                      className="p-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:shadow-none disabled:bg-slate-700 transition-all transform active:scale-95"
                    >
                      {isLoading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                          <SendIcon className="w-4 h-4"/>
                      )}
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
