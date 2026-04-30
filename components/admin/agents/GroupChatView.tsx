'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Users, AtSign } from 'lucide-react';

interface Message {
  id: string;
  sender_type: 'agent' | 'user' | 'system';
  sender_name: string;
  sender_avatar?: string;
  content: string;
  timestamp: string;
  mentions?: string[];
  isTyping?: boolean;
}

interface GroupChatViewProps {
  conversationId?: string;
  participants?: string[];
  onClose?: () => void;
}

export function GroupChatView({ 
  conversationId = 'group-chat', 
  participants = ['PRIME', 'Vanguard', 'You'],
  onClose 
}: GroupChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender_type: 'system',
      sender_name: 'System',
      content: `👋 مرحباً! تم بدء محادثة جماعية بين: ${participants.join(', ')}`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [activeParticipants, setActiveParticipants] = useState<string[]>(['PRIME', 'Vanguard']);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate agent responses
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeParticipants.includes('PRIME') && messages.length > 1) {
        addMessage({
          sender_type: 'agent',
          sender_name: 'PRIME',
          content: 'أنا جاهز للمساعدة في أي مهمة تصميم أو تقنية! 👨‍💻',
          mentions: []
        });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  function addMessage(message: Partial<Message>) {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      sender_type: 'agent',
      sender_name: 'Unknown',
      content: '',
      timestamp: new Date().toISOString(),
      ...message
    };
    setMessages(prev => [...prev, newMessage]);
  }

  function handleSendMessage() {
    if (!inputMessage.trim()) return;

    // Add user message
    addMessage({
      sender_type: 'user',
      sender_name: 'You',
      content: inputMessage
    });

    // Parse mentions
    const mentions = inputMessage.match(/@\w+/g) || [];
    const mentionedAgents = mentions.map(m => m.substring(1));

    // Simulate agent responses after delay
    setTimeout(() => {
      if (mentionedAgents.includes('PRIME') || mentionedAgents.length === 0) {
        addMessage({
          sender_type: 'agent',
          sender_name: 'PRIME',
          content: '⏳ جاري معالجة طلبك...',
          isTyping: true
        });
      }
      if (mentionedAgents.includes('Vanguard')) {
        addMessage({
          sender_type: 'agent',
          sender_name: 'Vanguard',
          content: '⏳ أحضر المعلومات المطلوبة...',
          isTyping: true
        });
      }
    }, 500);

    setInputMessage('');
  }

  function toggleParticipant(name: string) {
    if (name === 'You') return; // Can't remove yourself
    setActiveParticipants(prev => 
      prev.includes(name) 
        ? prev.filter(p => p !== name)
        : [...prev, name]
    );
  }

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold">المحادثة الجماعية</h3>
            <p className="text-sm text-gray-500">
              {activeParticipants.join(' + ')} + أنت
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* Participants Toggle */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <span className="text-xs text-gray-500">المشاركين:</span>
        {['PRIME', 'Vanguard', 'You'].map(participant => (
          <button
            key={participant}
            onClick={() => toggleParticipant(participant)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              participant === 'You' || activeParticipants.includes(participant)
                ? participant === 'PRIME' 
                  ? 'bg-purple-100 text-purple-800'
                  : participant === 'Vanguard'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                : 'bg-gray-200 text-gray-500 line-through'
            }`}
          >
            {participant === 'PRIME' && '🧠 '}
            {participant === 'Vanguard' && '💼 '}
            {participant}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="اكتب رسالة... استخدم @PRIME أو @Vanguard"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        {/* Quick Mentions */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setInputMessage(prev => prev + '@PRIME ')}
            className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
          >
            @PRIME
          </button>
          <button
            onClick={() => setInputMessage(prev => prev + '@Vanguard ')}
            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
          >
            @Vanguard
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender_type === 'user';
  const isSystem = message.sender_type === 'system';
  const isPRIME = message.sender_name === 'PRIME';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser 
          ? 'bg-blue-500 text-white'
          : isPRIME
            ? 'bg-purple-100 text-purple-600'
            : 'bg-green-100 text-green-600'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[70%] ${isUser ? 'text-left' : 'text-right'}`}>
        <div className={`text-xs mb-1 ${isUser ? 'text-blue-600' : 'text-gray-500'}`}>
          {message.sender_name}
        </div>
        <div className={`rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-blue-500 text-white'
            : isPRIME
              ? 'bg-purple-50 text-gray-800 border border-purple-100'
              : 'bg-green-50 text-gray-800 border border-green-100'
        }`}>
          {message.isTyping ? (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200" />
            </div>
          ) : (
            <p className="text-sm">{message.content}</p>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {new Date(message.timestamp).toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
}
