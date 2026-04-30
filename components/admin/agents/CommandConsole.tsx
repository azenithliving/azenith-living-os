'use client';

import { useState, useRef, useEffect } from 'react';

interface CommandHistory {
  id: string;
  type: 'input' | 'output' | 'error';
  text: string;
  timestamp: Date;
  agent?: string;
}

export function CommandConsole() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('prime');
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // scroll to bottom when history changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);
  
  async function executeCommand() {
    if (!command.trim()) return;
    
    const cmdId = Date.now().toString();
    
    // add command to history
    setHistory(prev => [...prev, {
      id: cmdId,
      type: 'input',
      text: command,
      timestamp: new Date(),
      agent: selectedAgent
    }]);
    
    setIsProcessing(true);
    const currentCommand = command;
    setCommand('');
    
    try {
      // send to API
      const res = await fetch('/api/admin/agents/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_key: selectedAgent,
          task_type: 'command',
          title: `Command: ${currentCommand}`,
          description: currentCommand,
          context: { command: currentCommand }
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setHistory(prev => [...prev, {
          id: cmdId + '-out',
          type: 'output',
          text: `تم إنشاء المهمة: ${data.data.id.slice(0, 8)}`,
          timestamp: new Date()
        }]);
      } else {
        setHistory(prev => [...prev, {
          id: cmdId + '-err',
          type: 'error',
          text: data.error || 'فشل تنفيذ الأمر',
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, {
        id: cmdId + '-err',
        type: 'error',
        text: 'خطأ في الاتصال',
        timestamp: new Date()
      }]);
    }
    
    setIsProcessing(false);
  }
  
  function clearHistory() {
    setHistory([]);
  }
  
  return (
    <div className="bg-gray-900 text-green-400 rounded-lg overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">وحدة التحكم</span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-gray-700 text-white text-xs rounded px-2 py-1 border-none"
          >
            <option value="prime">PRIME (المهندس)</option>
            <option value="vanguard">Vanguard (المبيعات)</option>
          </select>
        </div>
        <button
          onClick={clearHistory}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          مسح السجل
        </button>
      </div>
      
      {/* History */}
      <div className="h-64 overflow-y-auto p-4 space-y-1 text-sm">
        {history.length === 0 && (
          <p className="text-gray-500 italic">اكتب أمراً للبدء...</p>
        )}
        
        {history.map((item) => (
          <div key={item.id} className={`${
            item.type === 'input' ? 'text-yellow-400' :
            item.type === 'error' ? 'text-red-400' :
            'text-green-400'
          }`}>
            {item.type === 'input' && (
              <span className="text-gray-500 mr-2">
                [{item.agent?.toUpperCase()}]
              </span>
            )}
            {item.type === 'input' && <span className="text-gray-500 mr-1">$</span>}
            <span className="whitespace-pre-wrap">{item.text}</span>
            <span className="text-gray-600 text-xs ml-2">
              {item.timestamp.toLocaleTimeString('ar-EG')}
            </span>
          </div>
        ))}
        
        {isProcessing && (
          <div className="text-gray-400">
            <span className="animate-pulse">جاري التنفيذ...</span>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>
      
      {/* Input */}
      <div className="flex items-center px-4 py-3 bg-gray-800 border-t border-gray-700">
        <span className="text-yellow-400 mr-2">$</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') executeCommand();
          }}
          placeholder="اكتب أمراً..."
          className="flex-1 bg-transparent border-none outline-none text-green-400 placeholder-gray-600"
          disabled={isProcessing}
        />
        <button
          onClick={executeCommand}
          disabled={isProcessing || !command.trim()}
          className="ml-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          تنفيذ
        </button>
      </div>
    </div>
  );
}
