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
  image?: string; // base64 image for display
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

const systemInstruction = `You are a friendly, creative, and conversational AI assistant specializing in Scalable Vector Graphics (SVG). Your primary purpose is to help users create and modify SVG code in a live visualizer.

**Core Directives:**
1.  **Be Conversational:** Engage in friendly conversation. You can respond to greetings like "hello" and "how are you."
2.  **Stay on Topic:** While you can chat, your main goal is SVG creation. Politely decline to perform complex, unrelated tasks. For example, if asked for math help, you could say, "I'm more of an artist than a mathematician! How about I draw you a cool geometric shape instead?"
3.  **Strict Output Protocol:** When a user asks you to draw or modify an SVG, you MUST follow this multi-step protocol exactly:
    - **Step 1: Name the Artwork.** On the very first line, write \`NAME: \` followed by a short, descriptive name for the artwork (e.g., \`NAME: A vibrant sunset over mountains\`).
    - **Step 2: Generate the SVG.** On the next line, provide ONLY the raw, valid SVG code. It must start directly with \`<svg ...>\`. NEVER wrap it in Markdown backticks.
    - **Step 3: Signal Completion.** After the final \`</svg>\` tag, on a new line, write exactly \`STATUS: DONE\`.
    - **Step 4: Follow Up.** On the final line, write a short, friendly, conversational follow-up message (e.g., "Here you go! I've created the vibrant sunset you asked for.").
4.  **Image Interpretation:** If a user uploads an image, use it as inspiration to generate a new SVG based on their request.
5.  **Modification & History:** Use the conversation history and the provided current SVG code to understand and fulfill modification requests.`;

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
    { id: 1, text: "Hello! I'm your AI SVG assistant. Ask me to draw something, or upload an image for inspiration!", sender: 'ai', type: 'text' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      return ai.chats.create({ model: 'gemini-2.5-flash', config: { systemInstruction }});
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  
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
    setError(null);

    try {
      const parts: (string | Part)[] = [`This is the current SVG code on the editor:\n\`\`\`svg\n${initialCode}\n\`\`\`\n\nUser request: ${input}`];
      if (attachedFile) {
        const imagePart = await fileToGenerativePart(attachedFile);
        parts.push(imagePart);
      }
      
      const responseStream = await chat.sendMessageStream({ message: parts });
      
      let buffer = '';
      let state: 'finding_name' | 'streaming_svg' | 'streaming_follow_up' = 'finding_name';
      let creationMessageId: number | null = null;
      let followUpMessageId: number | null = null;
      // FIX: Use a local variable to accumulate SVG code during streaming to avoid type errors and stale state.
      let currentSvgCode = '';

      for await (const chunk of responseStream) {
        buffer += chunk.text;

        if (state === 'finding_name') {
            const nameMatch = buffer.match(/^NAME: (.*)\n/);
            if (nameMatch) {
                const name = nameMatch[1].trim();
                onSvgTitleChange(name);
                creationMessageId = Date.now();
                setMessages(prev => [...prev, {
                    id: creationMessageId!,
                    sender: 'ai',
                    type: 'creation',
                    creation: { name, status: 'creating' }
                }]);
                buffer = buffer.substring(nameMatch[0].length);
                state = 'streaming_svg';
                onSvgCodeChange(''); // Clear previous SVG
                currentSvgCode = '';
            }
        }
        
        if (state === 'streaming_svg') {
            const statusMatch = buffer.indexOf('STATUS: DONE');
            if (statusMatch !== -1) {
                const svgPart = buffer.substring(0, statusMatch);
                // FIX for line 173: Append to local accumulator and pass the full string.
                currentSvgCode += svgPart;
                onSvgCodeChange(currentSvgCode);
                setMessages(prev => prev.map(msg => 
                    msg.id === creationMessageId ? { ...msg, creation: { ...msg.creation!, status: 'created' } } : msg
                ));
                buffer = buffer.substring(statusMatch + 'STATUS: DONE'.length).trimStart();
                state = 'streaming_follow_up';
            } else {
                // FIX for line 180: Append buffer to accumulator and clear buffer to prevent duplication.
                currentSvgCode += buffer;
                onSvgCodeChange(currentSvgCode);
                buffer = '';
            }
        }

        if (state === 'streaming_follow_up' && buffer.length > 0) {
            if (!followUpMessageId) {
                followUpMessageId = Date.now() + 1;
                setMessages(prev => [...prev, { id: followUpMessageId!, text: buffer, sender: 'ai', type: 'text' }]);
            } else {
                setMessages(prev => prev.map(msg => 
                    msg.id === followUpMessageId ? { ...msg, text: (msg.text || '') + chunk.text } : msg
                ));
            }
        }
      }
      // Handle cases where AI gives a simple text response without the protocol
      if (state === 'finding_name' && buffer.length > 0) {
        setMessages(prev => [...prev, { id: Date.now(), text: buffer, sender: 'ai', type: 'text'}]);
      }

    } catch (e) {
        const errorMessage = "Sorry, an error occurred. Please verify your API key and try again.";
        setError(errorMessage);
        setMessages(prev => [...prev, { id: Date.now(), text: errorMessage, sender: 'ai', type: 'text' }]);
    } finally {
        setIsLoading(false);
    }
  };

  const renderMessageContent = (message: Message) => {
    if (message.type === 'creation' && message.creation) {
      const { name, status } = message.creation;
      const isCreating = status === 'creating';
      return (
        <div className={`p-3 rounded-2xl animate-fade-in-up shadow-lg bg-slate-800/80 ring-1 ring-white/10 text-slate-200 rounded-bl-none`}>
          <div className="flex items-center gap-2">
            {isCreating ? (
              <>
                <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse" style={{animationDelay: '0s'}}></span>
                <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
              </>
            ) : (
              <CheckIcon className="w-4 h-4 text-emerald-400"/>
            )}
            <p className="text-sm">
              {isCreating ? 'Creating:' : 'Created:'} <span className="font-medium text-white">{name}</span>
            </p>
          </div>
        </div>
      );
    }
    return (
       <div 
          className={`p-3 rounded-2xl animate-fade-in-up shadow-lg ${message.sender === 'user' ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-br-none' : 'bg-slate-800/80 ring-1 ring-white/10 text-slate-200 rounded-bl-none'}`}
          style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}
      >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text || ' '}</p>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className={`fixed top-0 left-0 bottom-0 z-50 w-full max-w-lg flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-heading"
        onPaste={handlePaste}
      >
        <div className="flex-1 flex flex-col bg-slate-900/70 backdrop-blur-2xl border-r border-slate-700/50 m-2 my-4 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
            <header className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-br from-sky-400 to-violet-500 rounded-lg blur opacity-75"></div>
                    <div className="relative bg-slate-900 p-2 rounded-lg shadow-lg">
                        <AiIcon className="w-6 h-6 text-white"/>
                    </div>
                </div>
                <h2 id="chat-heading" className="text-lg font-bold text-white">AI Assistant</h2>
              </div>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-400">
                <CloseIcon className="w-6 h-6" />
                <span className="sr-only">Close chat</span>
              </button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex items-start gap-3 w-full ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                  {message.sender === 'ai' && (
                    <div className="w-8 h-8 flex-shrink-0 bg-slate-800 rounded-full flex items-center justify-center ring-1 ring-slate-700">
                      <AiIcon className="w-5 h-5 text-sky-400" />
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 max-w-md ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    {message.image && (
                         <img src={message.image} alt="User upload preview" className="rounded-xl max-h-48 w-auto mb-2 border-2 border-violet-500/50" />
                    )}
                    {renderMessageContent(message)}
                  </div>
                </div>
              ))}
              {isLoading && messages.every(m => m.type !== 'creation' || m.creation?.status !== 'creating') && (
                 <div className="flex items-start gap-3">
                   <div className="w-8 h-8 flex-shrink-0 bg-slate-800 rounded-full flex items-center justify-center ring-1 ring-slate-700">
                      <AiIcon className="w-5 h-5 text-sky-400" />
                    </div>
                   <div className="max-w-md p-3 rounded-2xl bg-slate-800/80 ring-1 ring-white/10 text-slate-200 rounded-bl-none flex items-center gap-2">
                     <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse" style={{animationDelay: '0s'}}></span>
                     <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                     <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
                   </div>
                 </div>
              )}
               {error && !isLoading && (
                  <div className="flex justify-center p-2">
                      <p className="text-sm text-red-400 bg-red-900/50 px-3 py-2 rounded-lg text-center">{error}</p>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
            
            <footer className="p-4 border-t border-white/10 flex-shrink-0 bg-slate-900/50">
              {previewUrl && (
                  <div className="relative mb-2 p-2 bg-slate-800 rounded-lg">
                      <img src={previewUrl} alt="Preview" className="max-h-24 rounded-md"/>
                      <button onClick={() => setAttachedFile(null)} className="absolute top-0 right-0 -mt-2 -mr-2 bg-slate-700 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors">
                          <CloseIcon className="w-4 h-4" />
                      </button>
                  </div>
              )}
              <form onSubmit={handleSubmit} className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach file"
                    className="p-3 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-sky-400 ring-1 ring-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                    <PaperclipIcon className="w-5 h-5"/>
                </button>
                <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask me to draw an SVG..."
                      aria-label="Chat input"
                      disabled={isLoading || !!error}
                      className="w-full bg-slate-800 text-sm text-slate-200 placeholder-slate-500 rounded-lg pl-4 pr-12 py-3 outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-sky-400 transition-all disabled:opacity-50"
                    />
                    <button 
                      type="submit" 
                      disabled={isLoading || (!input.trim() && !attachedFile) || !!error}
                      aria-label="Send message"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-br from-sky-500 to-sky-400 text-white rounded-md hover:from-sky-400 hover:to-sky-300 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-800 focus:ring-white shadow-lg shadow-sky-500/10 hover:shadow-sky-400/20"
                    >
                      <SendIcon className="w-5 h-5"/>
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
