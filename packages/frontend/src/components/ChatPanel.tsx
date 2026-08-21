import { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { useWebSocket } from '../hooks/useWebSocket';

const EMOJI_OPTIONS = ['❤️', '🔥', '😂', '😮', '👏', '🎉'];

export function ChatPanel() {
    const [message, setMessage] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { messages, room } = useRoomStore();
    const { sendChat, sendReaction } = useWebSocket();

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        sendChat(message.trim());
        setMessage('');
    };

    const handleReaction = (emoji: string) => {
        sendReaction(emoji);
        setShowEmoji(false);
    };

    if (!room?.settings.allowChat) {
        return (
            <div className="flex-1 flex items-center justify-center text-center p-4">
                <p className="text-gray-500">Chat is disabled in this room</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-8">
                        <p>No messages yet</p>
                        <p className="mt-1">Be the first to say hi! 👋</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-2 animate-slide-up ${msg.type === 'system' ? 'justify-center' : ''
                                }`}
                        >
                            {msg.type === 'system' ? (
                                <p className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                                    {msg.content}
                                </p>
                            ) : (
                                <>
                                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-medium text-accent">
                                            {msg.senderName[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-medium text-sm truncate">{msg.senderName}</span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                                            {msg.content}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex gap-2">
                    {/* Reaction button */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowEmoji(!showEmoji)}
                            className="btn-icon"
                            aria-label="Add a reaction"
                        >
                            <span className="text-lg">😊</span>
                        </button>

                        {/* Emoji picker */}
                        {showEmoji && (
                            <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex gap-1 animate-bounce-in">
                                {EMOJI_OPTIONS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleReaction(emoji)}
                                        className="w-10 h-10 text-xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors hover:scale-110"
                                        aria-label={`React with ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message..."
                        maxLength={500}
                        className="input flex-1"
                        aria-label="Chat message"
                        onFocus={() => setShowEmoji(false)}
                    />

                    <button
                        type="submit"
                        disabled={!message.trim()}
                        className="btn-primary disabled:opacity-50"
                        aria-label="Send message"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
}
