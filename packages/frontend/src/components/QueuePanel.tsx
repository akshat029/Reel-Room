import { useRoomStore } from '../stores/roomStore';
import { useWebSocket } from '../hooks/useWebSocket';

export function QueuePanel() {
    const { queue, playbackState, myRole } = useRoomStore();
    const { send } = useWebSocket();

    const isHost = myRole === 'host' || myRole === 'cohost';

    const handlePlay = (itemId: string) => {
        if (!isHost) return;
        send('playback_sync', { mode: 'embed', currentItemId: itemId, isPlaying: true });
    };

    const handleRemove = (itemId: string) => {
        if (!isHost) return;
        send('queue_remove', { itemId });
    };

    if (queue.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-center p-4">
                <div>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                    </div>
                    <p className="text-gray-500">Queue is empty</p>
                    {isHost && (
                        <p className="text-sm text-gray-400 mt-1">Add a Reel URL to get started</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                Up Next ({queue.length})
            </h3>

            <div className="space-y-2">
                {queue.map((item, index) => {
                    const isPlaying = playbackState.currentItemId === item.reelUrl;

                    return (
                        <div
                            key={item.id}
                            className={`group flex items-center gap-3 p-3 rounded-xl transition-colors ${isPlaying
                                    ? 'bg-accent/10 border border-accent/30'
                                    : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            {/* Position / Now playing indicator */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${isPlaying
                                    ? 'bg-accent text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>
                                {isPlaying ? (
                                    <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                ) : (
                                    index + 1
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {item.title || 'Instagram Reel'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                    Added by {item.addedByName}
                                </p>
                            </div>

                            {/* Actions (host only) */}
                            {isHost && !isPlaying && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handlePlay(item.reelUrl)}
                                        className="btn-icon text-accent"
                                        title="Play now"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleRemove(item.id)}
                                        className="btn-icon text-red-500"
                                        title="Remove"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
