import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '../stores/roomStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { VideoPlayerWrapper } from '../components/VideoPlayerWrapper';
import { ChatPanel } from '../components/ChatPanel';
import { QueuePanel } from '../components/QueuePanel';
import { HostControls } from '../components/HostControls';
import { ParticipantsList } from '../components/ParticipantsList';
import { ReactionsOverlay } from '../components/ReactionsOverlay';

export function RoomPage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [showChat, setShowChat] = useState(true);
    const [showQueue, setShowQueue] = useState(false);

    const { connect, disconnect } = useWebSocket();
    const {
        isConnected,
        isConnecting,
        error,
        room,
        myRole,
        participants,
        reset,
    } = useRoomStore();

    useEffect(() => {
        const token = sessionStorage.getItem('reelroom-token');
        const displayName = sessionStorage.getItem('reelroom-display-name');

        if (!displayName || !code) {
            navigate(`/join/${code}`);
            return;
        }

        connect(code, displayName, token || undefined);

        return () => {
            disconnect();
        };
    }, [code, navigate, connect, disconnect]);

    // Handle errors
    useEffect(() => {
        if (error && error.includes('removed')) {
            setTimeout(() => navigate('/'), 2000);
        }
    }, [error, navigate]);

    const copyRoomLink = () => {
        navigator.clipboard.writeText(window.location.href);
    };

    if (isConnecting) {
        return (
            <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
                <div className="text-center animate-pulse">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </div>
                    <p className="text-gray-500">Connecting to room...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
                <div className="text-center max-w-md animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">{error}</p>
                    <button onClick={() => navigate('/')} className="btn-primary">
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    if (!isConnected || !room) {
        return null;
    }

    const isHost = myRole === 'host' || myRole === 'cohost';

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row">
            {/* Main content area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Room header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="font-bold text-lg">Room: <span className="font-mono text-accent">{room.code}</span></h1>
                        <button
                            onClick={copyRoomLink}
                            className="btn-icon text-gray-500 hover:text-accent"
                            title="Copy room link"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <span className="badge-success">
                            <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                            {participants.length} watching
                        </span>
                    </div>

                    {/* Mobile toggles */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <button
                            onClick={() => { setShowChat(!showChat); setShowQueue(false); }}
                            className={`btn-icon ${showChat ? 'bg-accent/10 text-accent' : ''}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => { setShowQueue(!showQueue); setShowChat(false); }}
                            className={`btn-icon ${showQueue ? 'bg-accent/10 text-accent' : ''}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Video area */}
                <div className="flex-1 relative bg-black/5 dark:bg-black/20 flex items-center justify-center overflow-hidden">
                    <VideoPlayerWrapper />
                    <ReactionsOverlay />
                </div>

                {/* Host controls */}
                {isHost && <HostControls />}
            </div>

            {/* Sidebar (desktop) / Bottom sheet (mobile) */}
            <div className={`
        lg:w-96 lg:border-l border-gray-200 dark:border-gray-800 flex flex-col
        ${showChat || showQueue ? 'h-72 lg:h-auto border-t lg:border-t-0' : 'hidden lg:flex'}
      `}>
                {/* Sidebar tabs (desktop) */}
                <div className="hidden lg:flex border-b border-gray-200 dark:border-gray-800">
                    <button
                        onClick={() => { setShowChat(true); setShowQueue(false); }}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${showChat
                                ? 'text-accent border-b-2 border-accent'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Chat
                    </button>
                    <button
                        onClick={() => { setShowQueue(true); setShowChat(false); }}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${showQueue
                                ? 'text-accent border-b-2 border-accent'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Queue
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {showChat && <ChatPanel />}
                    {showQueue && <QueuePanel />}
                    {!showChat && !showQueue && <ChatPanel />}
                </div>

                {/* Participants */}
                <ParticipantsList />
            </div>
        </div>
    );
}
