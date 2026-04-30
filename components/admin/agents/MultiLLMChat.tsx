'use client';

import { useState, useRef, useEffect } from 'react';
import { localLLM, LLMMessage } from '@/services/local-llm';

const MODELS = [
  { key: 'llama3.2', name: 'Llama 3.2', description: 'عام - متوازن', color: 'bg-blue-500' },
  { key: 'mistral', name: 'Mistral', description: 'سريع - منطقي', color: 'bg-green-500' },
  { key: 'codellama', name: 'CodeLlama', description: 'برمجة - تقني', color: 'bg-purple-500' }
];

export function MultiLLMChat() {
  const [selectedModel, setSelectedModel] = useState('llama3.2');
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  async function sendMessage() {
    if (!input.trim()) return;
    
    const userMsg: LLMMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);
    
    try {
      const response = await localLLM.chat(newMessages, selectedModel);
      
      setMessages([...newMessages, {
        role: 'assistant',
        content: response.content
      }]);
    } catch (err) {
      setError('خطأ في الاتصال بالنموذج. تأكد من تشغيل Ollama.');
    }
    
    setLoading(false);
  }
  
  function clearChat() {
    setMessages([]);
    setError(null);
  }
  
  const selectedModelInfo = MODELS.find(m => m.key === selectedModel);
  
  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">محادثة متعددة النماذج</h3>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white"
          >
            {MODELS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={clearChat}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          مسح المحادثة
        </button>
      </div>
      
      {/* Model Info */}
      <div className={`px-3 py-2 ${selectedModelInfo?.color} bg-opacity-10 border-b`}>
        <p className="text-xs">
          <span className="font-semibold">{selectedModelInfo?.name}:</span>{' '}
          {selectedModelInfo?.description}
        </p>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>ابدأ محادثة مع الذكاء الاصطناعي المحلي</p>
            <p className="text-sm mt-2">النماذج تعمل عبر Ollama على جهازك</p>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className={`w-2 h-2 rounded-full ${selectedModelInfo?.color} mb-2`} />
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {msg.content}
              </pre>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${selectedModelInfo?.color} animate-pulse`} />
              <span className="text-sm text-gray-500">يتم التفكير...</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-red-500 mt-1">
              شغل Ollama: ollama run llama3.2
            </p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
          placeholder="اكتب رسالة..."
          className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 
            disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          إرسال
        </button>
      </div>
    </div>
  );
}
