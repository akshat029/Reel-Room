import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isValidRoomCode } from '@reelroom/shared';

export function JoinLanding() {
    const [roomCode, setRoomCode] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const code = roomCode.trim().toUpperCase();

        if (!code) {
            setError('Please enter a room code');
            return;
        }

        if (!isValidRoomCode(code)) {
            setError('Invalid room code format');
            return;
        }

        navigate(`/join/${code}`);
    };

    return (
        <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
            <div className="w-full max-w-md text-center animate-fade-in">
                {/* Hero */}
                <div className="mb-10">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-glow-lg">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Watch <span className="text-gradient">Reels</span> Together
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Host a room, share your screen, react live. No fuss.
                    </p>
                </div>

                {/* Join Form */}
                <form onSubmit={handleJoin} className="mb-8">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={roomCode}
                            onChange={(e) => {
                                setRoomCode(e.target.value.toUpperCase());
                                setError('');
                            }}
                            placeholder="Enter room code"
                            maxLength={6}
                            className="input-lg flex-1 text-center font-mono tracking-widest uppercase"
                            aria-label="Room code"
                        />
                        <button type="submit" className="btn-primary text-lg px-6">
                            Join
                        </button>
                    </div>
                    {error && (
                        <p className="mt-2 text-sm text-red-500 animate-slide-up">{error}</p>
                    )}
                </form>

                {/* Divider */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="px-4 bg-surface-light dark:bg-surface-darker text-sm text-gray-500">or</span>
                    </div>
                </div>

                {/* Create Room CTA */}
                <button
                    onClick={() => navigate('/create')}
                    className="w-full btn-primary text-lg py-4 group"
                >
                    <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create a Room
                    </span>
                </button>

                {/* Features */}
                <div className="mt-16 grid grid-cols-3 gap-6 text-center">
                    <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium">Synced Playback</p>
                    </div>
                    <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium">Live Chat</p>
                    </div>
                    <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium">Emoji Reactions</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
