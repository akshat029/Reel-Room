import { useState } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { useWebSocket } from '../hooks/useWebSocket';

export function ParticipantsList() {
    const [isExpanded, setIsExpanded] = useState(false);
    const { participants, myId, myRole } = useRoomStore();
    const { send } = useWebSocket();

    const isHost = myRole === 'host';

    const handleKick = (participantId: string) => {
        if (!isHost || participantId === myId) return;
        send('moderation', { action: 'kick', targetId: participantId });
    };

    const handlePromote = (participantId: string) => {
        if (!isHost || participantId === myId) return;
        send('moderation', { action: 'promote', targetId: participantId });
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'host':
                return <span className="badge-accent">Host</span>;
            case 'cohost':
                return <span className="badge bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">Co-host</span>;
            default:
                return null;
        }
    };

    return (
        <div className="border-t border-gray-200 dark:border-gray-800">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sm font-medium">
                        {participants.length} participant{participants.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-2 animate-slide-up">
                    {/* Avatar stack for quick view */}
                    <div className="flex -space-x-2 mb-3">
                        {participants.slice(0, 8).map((p) => (
                            <div
                                key={p.id}
                                className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border-2 border-white dark:border-gray-900"
                                title={p.displayName}
                            >
                                <span className="text-xs font-medium text-accent">
                                    {p.displayName[0].toUpperCase()}
                                </span>
                            </div>
                        ))}
                        {participants.length > 8 && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-white dark:border-gray-900">
                                <span className="text-xs font-medium">+{participants.length - 8}</span>
                            </div>
                        )}
                    </div>

                    {/* Full list */}
                    {participants.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 group"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                                    <span className="text-sm font-medium text-accent">
                                        {p.displayName[0].toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                            {p.displayName}
                                            {p.id === myId && <span className="text-gray-400 ml-1">(you)</span>}
                                        </span>
                                        {getRoleBadge(p.role)}
                                    </div>
                                </div>
                            </div>

                            {/* Host actions */}
                            {isHost && p.id !== myId && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {p.role === 'participant' && (
                                        <button
                                            onClick={() => handlePromote(p.id)}
                                            className="btn-icon text-xs text-accent"
                                            title="Make co-host"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleKick(p.id)}
                                        className="btn-icon text-xs text-red-500"
                                        title="Remove"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
