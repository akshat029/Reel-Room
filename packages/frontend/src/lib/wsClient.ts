import { useRoomStore } from '../stores/roomStore';
import { handleRTCSignal, hostViewerJoined, hostViewerLeft, setMediaState } from './screenShare';
import type {
    ChatMessage,
    Participant,
    PlaybackState,
    QueueItem,
    Room,
    UserRole,
    WSMessage,
} from '@reelroom/shared';

const WS_URL = import.meta.env.VITE_WS_URL
    || `${window.location.protocol === 'https:' ? 'wss://' : 'ws://'}${window.location.host}`;

// Module-level singleton: every component that calls useWebSocket shares the
// same connection. (Previously each hook instance created its own WebSocket,
// so sends from any component other than the one that called connect() were
// silently dropped.)
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let joinParams: { roomCode: string; displayName: string; token?: string } | null = null;
let manualClose = false;

export function connectSocket(roomCode: string, displayName: string, token?: string): void {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    joinParams = { roomCode, displayName, token };
    manualClose = false;
    openSocket();
}

function openSocket(): void {
    const store = useRoomStore.getState();
    store.setConnecting(true);
    store.setError(null);

    ws = new WebSocket(`${WS_URL}/ws`);

    ws.onopen = () => {
        if (joinParams) {
            send('join', {
                roomCode: joinParams.roomCode,
                displayName: joinParams.displayName,
                token: joinParams.token,
            });
        }
    };

    ws.onmessage = (event) => {
        let message: WSMessage;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }
        handleMessage(message);
    };

    ws.onerror = () => {
        // The close event that follows handles reconnection.
    };

    ws.onclose = () => {
        ws = null;
        useRoomStore.getState().setConnected(false);
        if (manualClose || !joinParams) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(openSocket, 3000);
    };
}

export function send(type: string, payload: object): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
}

export function disconnectSocket(): void {
    manualClose = true;
    joinParams = null;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
    useRoomStore.getState().reset();
}

function handleMessage(message: WSMessage): void {
    const store = useRoomStore.getState();

    switch (message.type) {
        case 'join': {
            const payload = message.payload as {
                success: boolean;
                room: Room;
                participants: Participant[];
                queue: QueueItem[];
                playbackState: PlaybackState;
                messages: ChatMessage[];
                yourId: string;
                yourRole: string;
            };
            if (payload.success) {
                store.setConnected(true);
                store.setRoom(payload.room);
                store.setMyInfo(payload.yourId, payload.yourRole as UserRole, '');
                store.setParticipants(payload.participants);
                store.setQueue(payload.queue);
                store.setPlaybackState(payload.playbackState);
                store.setMessages(payload.messages);
            }
            break;
        }

        case 'participant_joined': {
            const payload = message.payload as { participant: Participant };
            store.addParticipant(payload.participant);
            if (store.myRole === 'host' || store.myRole === 'cohost') {
                hostViewerJoined(payload.participant.id);
            }
            break;
        }

        case 'participant_left': {
            const payload = message.payload as { userId: string };
            store.removeParticipant(payload.userId);
            hostViewerLeft(payload.userId);
            break;
        }

        case 'participant_update': {
            const payload = message.payload as { participants: Participant[] };
            store.setParticipants(payload.participants);
            break;
        }

        case 'playback_sync':
        case 'playback_control': {
            store.setPlaybackState(message.payload as PlaybackState);
            break;
        }

        case 'chat': {
            store.addMessage(message.payload as ChatMessage);
            break;
        }

        case 'reaction': {
            const payload = message.payload as { id: string; emoji: string };
            store.addReaction(payload.id, payload.emoji);
            setTimeout(() => store.removeReaction(payload.id), 2000);
            break;
        }

        case 'queue_update': {
            const payload = message.payload as { queue: QueueItem[] };
            store.setQueue(payload.queue);
            break;
        }

        case 'media_state': {
            const payload = message.payload as {
                screenOn: boolean;
                screenStreamId?: string | null;
                cameraOn: boolean;
                cameraStreamId?: string | null;
                micOn: boolean;
            };
            setMediaState({
                screenOn: payload.screenOn,
                screenStreamId: payload.screenStreamId ?? null,
                cameraOn: payload.cameraOn,
                cameraStreamId: payload.cameraStreamId ?? null,
                micOn: payload.micOn,
            });
            break;
        }

        case 'rtc_offer':
        case 'rtc_answer':
        case 'rtc_ice':
            handleRTCSignal(message.type, message.payload as { fromId?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit });
            break;

        case 'moderation': {
            const payload = message.payload as { action: string };
            if (payload.action === 'kicked') {
                store.reset();
                store.setError('You have been removed from the room.');
            }
            break;
        }

        case 'room_closed': {
            store.reset();
            store.setError('The room has been closed by the host.');
            break;
        }

        case 'error': {
            const payload = message.payload as { message: string };
            store.setError(payload.message);
            store.setConnecting(false);
            break;
        }
    }
}
