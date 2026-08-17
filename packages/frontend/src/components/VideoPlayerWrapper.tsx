import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { useMutation } from '@tanstack/react-query';
import { oembedApi } from '../api/client';

export function VideoPlayerWrapper() {
    const {
        playbackState,
        queue,
        myRole,
        remoteStream,
        localStream,
        localCameraStream,
        remoteCameraStream,
        isCameraOn,
        isMicOn,
    } = useRoomStore();
    const isHost = myRole === 'host' || myRole === 'cohost';
    const [embedHtml, setEmbedHtml] = useState<string | null>(null);
    const [embedError, setEmbedError] = useState<string | null>(null);
    const [viewerMuted, setViewerMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const pipRef = useRef<HTMLVideoElement>(null);

    const currentItem = queue.find(q => q.reelUrl === playbackState.currentItemId);

    // Screen share: the host renders their own capture as a preview; viewers
    // render the live stream received over WebRTC.
    const stream = playbackState.mode === 'screenshare' ? (isHost ? localStream : remoteStream) : null;
    // Live camera: shown as a PiP overlay while the host has it on (works in
    // every mode — screen share, embed, or idle).
    const cameraStream = isCameraOn ? (isHost ? localCameraStream : remoteCameraStream) : null;

    useEffect(() => {
        const el = videoRef.current;
        if (el && stream) {
            if (el.srcObject !== stream) el.srcObject = stream;
            el.play().catch(() => {});
        }
    }, [stream]);

    useEffect(() => {
        const el = pipRef.current;
        if (el && cameraStream) {
            if (el.srcObject !== cameraStream) el.srcObject = cameraStream;
            el.play().catch(() => {});
        }
    }, [cameraStream]);

    // Fetch embed when current item changes
    const embedMutation = useMutation({
        mutationFn: (url: string) => oembedApi.fetch(url),
        onSuccess: (data) => {
            setEmbedHtml(data.html);
            setEmbedError(null);
        },
        onError: (error: Error) => {
            setEmbedError(error.message);
            setEmbedHtml(null);
        },
    });

    useEffect(() => {
        if (playbackState.mode === 'embed' && playbackState.currentItemId) {
            if (currentItem?.embedHtml) {
                setEmbedHtml(currentItem.embedHtml);
            } else {
                embedMutation.mutate(playbackState.currentItemId);
            }
        }
    }, [playbackState.currentItemId, playbackState.mode]);

    let main: React.ReactNode;

    // Screen share mode
    if (playbackState.mode === 'screenshare') {
        main = stream ? (
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isHost || viewerMuted}
                className="max-w-full max-h-full object-contain"
            />
        ) : (
            <div className="flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">
                    {isHost ? 'Ready to share' : 'Waiting for the host'}
                </h2>
                <p className="text-gray-500 max-w-xs">
                    {isHost
                        ? 'Press "Screen Share" below and pick the tab where you are watching the reel.'
                        : 'The host is about to go live. The stream appears here automatically.'}
                </p>
            </div>
        );
    }
    // Empty state
    else if (playbackState.mode === 'none' || !playbackState.currentItemId) {
        main = (
            <div className="flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                <div className="w-24 h-24 mb-6 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Ready to watch together</h2>
                <p className="text-gray-500 max-w-xs">
                    {playbackState.mode === 'none'
                        ? 'The host will add content to start watching'
                        : 'Waiting for content...'}
                </p>
            </div>
        );
    }
    // Embed mode - loading
    else if (embedMutation.isPending) {
        main = (
            <div className="flex flex-col items-center justify-center text-center p-8 animate-pulse">
                <div className="w-20 h-20 mb-4 rounded-2xl bg-gray-200 dark:bg-gray-700" />
                <p className="text-gray-500">Loading embed...</p>
            </div>
        );
    }
    // Embed mode - error
    else if (embedError) {
        main = (
            <div className="flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto animate-fade-in">
                <div className="w-20 h-20 mb-6 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Unable to embed</h2>
                <p className="text-gray-500 mb-4">{embedError}</p>
                <p className="text-sm text-gray-400">
                    This Reel may be private or unavailable. Ask the host to use screen-share instead.
                </p>
            </div>
        );
    }
    // Embed mode - show embed
    else if (embedHtml) {
        main = (
            <div className="embed-container animate-fade-in">
                <div
                    dangerouslySetInnerHTML={{ __html: embedHtml }}
                    className="rounded-xl overflow-hidden shadow-lg"
                />
                {/* Instagram embed script */}
                <script async src="//www.instagram.com/embed.js" />
            </div>
        );
    }

    return (
        <div className="relative w-full h-full flex items-center justify-center">
            {main}

            {/* Live camera overlay (host self-view / viewer PiP) */}
            {cameraStream && (
                <div className="absolute bottom-4 right-4 z-10">
                    <div className="relative rounded-xl overflow-hidden shadow-lg border-2 border-white/20 bg-black">
                        <video
                            ref={pipRef}
                            autoPlay
                            playsInline
                            muted={isHost || viewerMuted}
                            className="w-40 h-28 md:w-48 md:h-32 object-cover"
                        />
                        {!isMicOn && (
                            <span className="absolute bottom-1 left-1 badge bg-red-500 text-white text-[10px]">
                                Mic off
                            </span>
                        )}
                    </div>
                </div>
            )}

            {!isHost && (stream || cameraStream) && (
                <button
                    onClick={() => setViewerMuted((muted) => !muted)}
                    className="absolute bottom-4 left-4 z-10 btn-icon bg-black/50 text-white"
                    title={viewerMuted ? 'Unmute' : 'Mute'}
                >
                    {viewerMuted ? 'Unmute' : 'Mute'}
                </button>
            )}

            {playbackState.mode === 'screenshare' && stream && (
                <div className="absolute top-4 left-4 z-10 badge bg-red-500 text-white">
                    <span className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse" />
                    LIVE
                </div>
            )}
        </div>
    );
}
