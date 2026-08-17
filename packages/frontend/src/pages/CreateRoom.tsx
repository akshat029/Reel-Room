import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { roomApi } from '../api/client';

export function CreateRoom() {
    const [hostName, setHostName] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const navigate = useNavigate();

    const createMutation = useMutation({
        mutationFn: () => roomApi.create(hostName, { isPrivate }),
        onSuccess: (data) => {
            // Store token and navigate to room
            sessionStorage.setItem('reelroom-token', data.token);
            sessionStorage.setItem('reelroom-participant-id', data.participantId);
            sessionStorage.setItem('reelroom-display-name', hostName);
            navigate(`/room/${data.room.code}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!hostName.trim()) return;
        createMutation.mutate();
    };

    return (
        <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
            <div className="w-full max-w-md animate-fade-in">
                <button
                    onClick={() => navigate('/')}
                    className="mb-8 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-accent transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                <div className="card p-8">
                    <h1 className="text-2xl font-bold mb-2">Create a Room</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        Start watching together in seconds
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="hostName" className="block text-sm font-medium mb-2">
                                Your Name
                            </label>
                            <input
                                id="hostName"
                                type="text"
                                value={hostName}
                                onChange={(e) => setHostName(e.target.value)}
                                placeholder="Enter your display name"
                                maxLength={50}
                                required
                                className="input"
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                            <div>
                                <p className="font-medium">Private Room</p>
                                <p className="text-sm text-gray-500">Only people with the link can join</p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isPrivate}
                                onClick={() => setIsPrivate(!isPrivate)}
                                className={`relative w-12 h-7 rounded-full transition-colors ${isPrivate ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-5' : ''
                                        }`}
                                />
                            </button>
                        </div>

                        {createMutation.isError && (
                            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm animate-slide-up">
                                {createMutation.error?.message || 'Failed to create room. Please try again.'}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!hostName.trim() || createMutation.isPending}
                            className="w-full btn-primary text-lg py-4"
                        >
                            {createMutation.isPending ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Creating...
                                </span>
                            ) : (
                                'Create Room'
                            )}
                        </button>
                    </form>
                </div>

                {/* Safety notice */}
                <div className="mt-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex gap-3">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-amber-800 dark:text-amber-200">
                            <p className="font-medium">Screen-share mode protects your login</p>
                            <p className="mt-1 text-amber-700 dark:text-amber-300">
                                When sharing Instagram content, we recommend using screen-share instead of sharing credentials. You're responsible for content you share.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
