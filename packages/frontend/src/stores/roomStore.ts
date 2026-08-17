import { create } from 'zustand';
import type {
    Room,
    Participant,
    QueueItem,
    PlaybackState,
    ChatMessage,
    ContentMode,
} from '@reelroom/shared';

interface RoomState {
    // Connection state
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;

    // Room data
    room: Room | null;
    myId: string | null;
    myRole: 'host' | 'cohost' | 'participant' | 'guest' | null;
    token: string | null;

    // Participants
    participants: Participant[];

    // Queue
    queue: QueueItem[];

    // Playback
    playbackState: PlaybackState;

    // Chat
    messages: ChatMessage[];

    // Reactions (ephemeral, for animations)
    reactions: Array<{ id: string; emoji: string; x: number }>;

    // Screen share (WebRTC)
    localStream: MediaStream | null;  // host: captured screen (preview)
    remoteStream: MediaStream | null; // viewer: live stream from the host
    isSharing: boolean;               // host: capture is active

    // Live camera + mic (WebRTC)
    localCameraStream: MediaStream | null;  // host: camera/mic preview
    remoteCameraStream: MediaStream | null; // viewer: live camera stream from the host
    isCameraOn: boolean;                    // host: camera broadcasting
    isMicOn: boolean;                       // host: microphone enabled

    // Actions
    setConnected: (connected: boolean) => void;
    setConnecting: (connecting: boolean) => void;
    setError: (error: string | null) => void;
    setRoom: (room: Room | null) => void;
    setMyInfo: (id: string, role: 'host' | 'cohost' | 'participant' | 'guest', token: string) => void;
    setParticipants: (participants: Participant[]) => void;
    addParticipant: (participant: Participant) => void;
    removeParticipant: (id: string) => void;
    setQueue: (queue: QueueItem[]) => void;
    addToQueue: (item: QueueItem) => void;
    removeFromQueue: (id: string) => void;
    setPlaybackState: (state: Partial<PlaybackState>) => void;
    addMessage: (message: ChatMessage) => void;
    setMessages: (messages: ChatMessage[]) => void;
    addReaction: (id: string, emoji: string) => void;
    removeReaction: (id: string) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setRemoteStream: (stream: MediaStream | null) => void;
    setIsSharing: (sharing: boolean) => void;
    setLocalCameraStream: (stream: MediaStream | null) => void;
    setRemoteCameraStream: (stream: MediaStream | null) => void;
    setIsCameraOn: (on: boolean) => void;
    setIsMicOn: (on: boolean) => void;
    reset: () => void;
}

const initialPlaybackState: PlaybackState = {
    mode: 'none',
    currentItemId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    timestamp: Date.now(),
};

export const useRoomStore = create<RoomState>((set) => ({
    // Initial state
    isConnected: false,
    isConnecting: false,
    error: null,
    room: null,
    myId: null,
    myRole: null,
    token: null,
    participants: [],
    queue: [],
    playbackState: initialPlaybackState,
    messages: [],
    reactions: [],
    localStream: null,
    remoteStream: null,
    isSharing: false,
    localCameraStream: null,
    remoteCameraStream: null,
    isCameraOn: false,
    isMicOn: false,

    // Actions
    setConnected: (isConnected) => set({ isConnected, isConnecting: false }),
    setConnecting: (isConnecting) => set({ isConnecting }),
    setError: (error) => set({ error }),
    setRoom: (room) => set({ room }),
    setMyInfo: (myId, myRole, token) => set({ myId, myRole, token }),
    setParticipants: (participants) => set({ participants }),
    addParticipant: (participant) =>
        set((state) => ({
            participants: [...state.participants.filter(p => p.id !== participant.id), participant]
        })),
    removeParticipant: (id) =>
        set((state) => ({
            participants: state.participants.filter(p => p.id !== id)
        })),
    setQueue: (queue) => set({ queue }),
    addToQueue: (item) =>
        set((state) => ({ queue: [...state.queue, item] })),
    removeFromQueue: (id) =>
        set((state) => ({ queue: state.queue.filter(q => q.id !== id) })),
    setPlaybackState: (newState) =>
        set((state) => ({
            playbackState: { ...state.playbackState, ...newState, timestamp: Date.now() }
        })),
    addMessage: (message) =>
        set((state) => ({
            messages: [...state.messages.slice(-99), message]
        })),
    setMessages: (messages) => set({ messages }),
    addReaction: (id, emoji) =>
        set((state) => ({
            reactions: [...state.reactions, { id, emoji, x: Math.random() * 80 + 10 }]
        })),
    removeReaction: (id) =>
        set((state) => ({
            reactions: state.reactions.filter(r => r.id !== id)
        })),
    setLocalStream: (localStream) => set({ localStream }),
    setRemoteStream: (remoteStream) => set({ remoteStream }),
    setIsSharing: (isSharing) => set({ isSharing }),
    setLocalCameraStream: (localCameraStream) => set({ localCameraStream }),
    setRemoteCameraStream: (remoteCameraStream) => set({ remoteCameraStream }),
    setIsCameraOn: (isCameraOn) => set({ isCameraOn }),
    setIsMicOn: (isMicOn) => set({ isMicOn }),
    reset: () => set({
        isConnected: false,
        isConnecting: false,
        error: null,
        room: null,
        myId: null,
        myRole: null,
        token: null,
        participants: [],
        queue: [],
        playbackState: initialPlaybackState,
        messages: [],
        reactions: [],
        localStream: null,
        remoteStream: null,
        isSharing: false,
        localCameraStream: null,
        remoteCameraStream: null,
        isCameraOn: false,
        isMicOn: false,
    }),
}));
