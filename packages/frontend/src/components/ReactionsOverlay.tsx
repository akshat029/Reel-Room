import { useRoomStore } from '../stores/roomStore';

export function ReactionsOverlay() {
    const { reactions } = useRoomStore();

    return (
        <div className="reactions-overlay">
            {reactions.map((reaction) => (
                <div
                    key={reaction.id}
                    className="floating-reaction"
                    style={{ left: `${reaction.x}%` }}
                >
                    {reaction.emoji}
                </div>
            ))}
        </div>
    );
}
