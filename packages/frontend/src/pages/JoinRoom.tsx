import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { roomApi } from '../api/client';

export function JoinRoom() {
    const { code } = useParams<{ code: string }>();
    const [displayName, setDisplayName] = useState('');
    const navigate = useNavigate();

    // Check for existing session
    useEffect(() => {
        const existingName = sessionStorage.getItem('reelroom-display-name');
        if (existingName) {
            setDisplayName(existingName);
        }
    }, []);

    // Fetch room info
    const { data: roomInfo, isLoading, isError } = useQuery({
        queryKey: ['room', code],
        queryFn: () => roomApi.get(code!),
        enabled: !!code,
        retry: 1,
    });

    // Join mutation
    const joinMutation = useMutation({
        mutationFn: () => roomApi.join(code!, displayName),
        onSuccess: (data) => {
            sessionStorage.setItem('reelroom-token', data.token);
            sessionStorage.setItem('reelroom-participant-id', data.participantId);
            sessionStorage.setItem('reelroom-display-name', displayName);
            navigate(`/room/${code}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim()) return;
        joinMutation.mutate();
    };

    if (isLoading) {
        return (
            <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
                <div className="text-center animate-pulse">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <p className="text-gray-500">Loading room...</p>
                </div>
            </div>
        );
    }

    if (isError || !roomInfo) {
        return (
            <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
                <div className="text-center max-w-md animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Room Not Found</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        This room doesn't exist or has been closed.
                    </p>
                    <button onClick={() => navigate('/')} className="btn-primary">
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

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
                    {/* Room info */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-glow">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold mb-1">Join Room</h1>
                        <p className="text-gray-500 font-mono">{code}</p>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Hosted by <span className="font-medium">{roomInfo.room.hostName}</span>
                            {' · '}
                            {roomInfo.participantCount} watching
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="displayName" className="block text-sm font-medium mb-2">
                                Your Name
                            </label>
                            <input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Enter your display name"
                                maxLength={50}
                                required
                                className="input"
                                autoFocus
                            />
                        </div>

                        {joinMutation.isError && (
                            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm animate-slide-up">
                                {joinMutation.error?.message || 'Failed to join room. Please try again.'}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!displayName.trim() || joinMutation.isPending}
                            className="w-full btn-primary text-lg py-4"
                        >
                            {joinMutation.isPending ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Joining...
                                </span>
                            ) : (
                                'Join Room'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
