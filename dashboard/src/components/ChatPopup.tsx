import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { MetricPoint } from '../hooks/useMetrics';

interface ChatPopupProps {
  latestMetric: MetricPoint | null;
  token?: string;
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

export default function ChatPopup({ latestMetric, token }: ChatPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: "Hello! I'm your server assistant. Ask me anything about your server's performance.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    if (!latestMetric) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Sorry, I have no metric data to analyze. Please wait for data to load.' },
      ]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/chat/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: input,
          metrics: latestMetric,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get a response from the server.');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { sender: 'ai', text: data.response }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110"
          aria-label="Toggle Chat"
        >
          {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[32rem] bg-[#1e293b] rounded-2xl shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center p-4 border-b border-gray-700">
            <Bot className="text-blue-400 mr-3" size={24} />
            <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            {messages.map((msg, index) => (
              <div key={index} className={`flex mb-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-lg px-4 py-2 max-w-xs ${
                    msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  <div className="prose prose-invert prose-sm">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-200 rounded-lg px-4 py-2">
                  <span className="animate-pulse">...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question..."
                className="flex-1 bg-gray-700 text-white rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 disabled:bg-gray-500"
                disabled={isLoading}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}