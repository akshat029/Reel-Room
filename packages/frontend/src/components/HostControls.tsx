import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRoomStore } from '../stores/roomStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { oembedApi } from '../api/client';
import { isValidInstagramUrl } from '@reelroom/shared';
import { hostStartSharing, hostStopSharing, hostStartCamera, hostStopCamera, hostToggleMic } from '../lib/screenShare';

export function HostControls() {
    const [reelUrl, setReelUrl] = useState('');
    const [urlError, setUrlError] = useState('');

    const { room, queue, playbackState, setPlaybackState, isSharing, isCameraOn, isMicOn } = useRoomStore();
    const { sendPlaybackControl, sendPlaybackSync, send } = useWebSocket();

    // Fetch oEmbed
    const oembedMutation = useMutation({
        mutationFn: (url: string) => oembedApi.fetch(url),
        onSuccess: (data, url) => {
            // Add to queue via WebSocket
            send('queue_add', { reelUrl: url, embedHtml: data.html });
            setReelUrl('');
            setUrlError('');

            // If nothing playing, start this one
            if (!playbackState.currentItemId) {
                setPlaybackState({ mode: 'embed', currentItemId: url, isPlaying: true });
                sendPlaybackSync({ mode: 'embed', currentItemId: url, isPlaying: true });
            }
        },
        onError: (error: Error) => {
            setUrlError(error.message);
        },
    });

    const handleAddReel = (e: React.FormEvent) => {
        e.preventDefault();

        if (!reelUrl.trim()) {
            setUrlError('Please enter a URL');
            return;
        }

        if (!isValidInstagramUrl(reelUrl)) {
            setUrlError('Invalid Instagram Reel URL');
            return;
        }

        oembedMutation.mutate(reelUrl);
    };

    const handlePlayPause = () => {
        const newState = { isPlaying: !playbackState.isPlaying };
        setPlaybackState(newState);
        sendPlaybackControl(playbackState.isPlaying ? 'pause' : 'play');
    };

    const handleCameraToggle = async () => {
        if (isCameraOn) {
            hostStopCamera();
            return;
        }

        const ok = await hostStartCamera();
        if (!ok) {
            setUrlError('Camera/microphone access was denied or failed');
        }
    };

    const handleMicToggle = () => {
        hostToggleMic();
    };

    const handleScreenShare = async () => {
        if (isSharing) {
            hostStopSharing();
            setPlaybackState({ mode: 'none' });
            sendPlaybackSync({ mode: 'none' });
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            hostStartSharing(stream);
            setPlaybackState({ mode: 'screenshare', isPlaying: true });
            sendPlaybackSync({ mode: 'screenshare', isPlaying: true });
        } catch (err) {
            console.error('Screen share failed:', err);
            setUrlError('Screen share was cancelled or failed');
        }
    };

    return (
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
            <div className="max-w-4xl mx-auto">
                {/* Add Reel URL */}
                <form onSubmit={handleAddReel} className="mb-4">
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={reelUrl}
                            onChange={(e) => {
                                setReelUrl(e.target.value);
                                setUrlError('');
                            }}
                            placeholder="Paste Instagram Reel URL..."
                            className="input flex-1"
                        />
                        <button
                            type="submit"
                            disabled={oembedMutation.isPending}
                            className="btn-primary whitespace-nowrap"
                        >
                            {oembedMutation.isPending ? (
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add
                                </>
                            )}
                        </button>
                    </div>
                    {urlError && (
                        <p className="mt-2 text-sm text-red-500 animate-slide-up">{urlError}</p>
                    )}
                </form>

                {/* Playback controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Play/Pause */}
                        <button
                            onClick={handlePlayPause}
                            disabled={!playbackState.currentItemId && !isSharing}
                            className="btn-icon bg-accent text-white hover:bg-accent-hover disabled:opacity-50 w-12 h-12 rounded-full"
                        >
                            {playbackState.isPlaying ? (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </button>

                        {/* Next/Previous */}
                        <button
                            onClick={() => sendPlaybackControl('previous')}
                            disabled={queue.length < 2}
                            className="btn-icon disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => sendPlaybackControl('next')}
                            disabled={queue.length < 2}
                            className="btn-icon disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Screen share toggle */}
                        <button
                            onClick={handleScreenShare}
                            className={`btn ${isSharing ? 'bg-red-500 text-white hover:bg-red-600' : 'btn-secondary'}`}
                        >
                            <svg className="w-5 h-5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {isSharing ? 'Stop Sharing' : 'Screen Share'}
                        </button>

                        {/* Live camera + mic toggle */}
                        <button
                            onClick={handleCameraToggle}
                            className={`btn ${isCameraOn ? 'bg-red-500 text-white hover:bg-red-600' : 'btn-secondary'}`}
                        >
                            <svg className="w-5 h-5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            {isCameraOn ? 'Stop Camera' : 'Camera & Mic'}
                        </button>

                        {/* Mic mute toggle (only while camera is on) */}
                        {isCameraOn && (
                            <button
                                onClick={handleMicToggle}
                                className={`btn ${isMicOn ? 'btn-secondary' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
                                title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                            >
                                <svg className="w-5 h-5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 18v3m-4-1h8" />
                                </svg>
                                {isMicOn ? 'Mic On' : 'Mic Off'}
                            </button>
                        )}
                    </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                    Tip: open the reel in your Instagram tab first, then pick that tab when sharing.
                    Viewers see your screen, camera and voice live.
                </p>
            </div>
        </div>
    );
}
