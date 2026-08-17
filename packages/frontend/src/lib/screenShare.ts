import { useRoomStore } from '../stores/roomStore';
import { send } from './wsClient';
import type { Participant } from '@reelroom/shared';

export type RTCSignalType = 'rtc_offer' | 'rtc_answer' | 'rtc_ice';

interface RTCSignalPayload {
    fromId?: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

export interface MediaState {
    screenOn: boolean;
    screenStreamId: string | null;
    cameraOn: boolean;
    cameraStreamId: string | null;
    micOn: boolean;
}

const ICE_CONFIG: RTCConfiguration = {
    // Public STUN only. Behind a strict symmetric NAT the connection may fail —
    // deploy a TURN server (e.g. Coturn) and add its credentials here.
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// Host side: one peer connection per viewer. Both the screen capture and the
// camera/mic stream are attached to these same connections, so viewers receive
// them as two separate MediaStreams (identified by their stream id).
const peers = new Map<string, RTCPeerConnection>();
const hostIceQueues = new Map<string, RTCIceCandidateInit[]>();

let screenStream: MediaStream | null = null; // display capture (host)
let cameraStream: MediaStream | null = null; // camera + mic (host)

// Viewer-side bookkeeping of what the host is broadcasting.
let mediaState: MediaState = {
    screenOn: false,
    screenStreamId: null,
    cameraOn: false,
    cameraStreamId: null,
    micOn: false,
};

// Viewer side: a single peer connection to the host.
let viewerPc: RTCPeerConnection | null = null;
let viewerIceQueue: RTCIceCandidateInit[] = [];

function isHostRole(): boolean {
    const role = useRoomStore.getState().myRole;
    return role === 'host' || role === 'cohost';
}

function hasAnyMedia(): boolean {
    return !!screenStream || !!cameraStream;
}

// ---------- Host ----------

function createHostPeer(viewerId: string): void {
    const conn = new RTCPeerConnection(ICE_CONFIG);
    peers.set(viewerId, conn);

    if (screenStream) {
        screenStream.getTracks().forEach((track) => conn.addTrack(track, screenStream!));
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach((track) => conn.addTrack(track, cameraStream!));
    }

    conn.onicecandidate = (event) => {
        if (event.candidate) {
            send('rtc_ice', { candidate: event.candidate.toJSON(), targetId: viewerId });
        }
    };

    conn.onnegotiationneeded = async () => {
        try {
            const offer = await conn.createOffer();
            await conn.setLocalDescription(offer);
            send('rtc_offer', { sdp: conn.localDescription, targetId: viewerId });
        } catch (error) {
            console.error('[screenShare] Host offer failed:', error);
        }
    };
}

function ensureHostPeers(): void {
    const store = useRoomStore.getState();
    store.participants.forEach((participant: Participant) => {
        if (participant.id !== store.myId && !peers.has(participant.id)) {
            createHostPeer(participant.id);
        }
    });
}

function addTrackToPeers(track: MediaStreamTrack, stream: MediaStream): void {
    peers.forEach((conn) => conn.addTrack(track, stream));
}

function removeTrackFromPeers(track: MediaStreamTrack): void {
    peers.forEach((conn) => {
        conn.getSenders().forEach((sender) => {
            if (sender.track === track) {
                conn.removeTrack(sender);
            }
        });
    });
}

export function hostViewerJoined(viewerId: string): void {
    if (hasAnyMedia()) {
        createHostPeer(viewerId);
    }
}

export function hostViewerLeft(viewerId: string): void {
    const conn = peers.get(viewerId);
    if (conn) {
        conn.close();
        peers.delete(viewerId);
        hostIceQueues.delete(viewerId);
    }
}

export function hostStartSharing(stream: MediaStream): void {
    if (screenStream) {
        hostStopSharing();
    }

    screenStream = stream;
    useRoomStore.getState().setLocalStream(stream);
    useRoomStore.getState().setIsSharing(true);

    ensureHostPeers();
    broadcastMediaState();

    // Chrome fires "ended" on the capture track when the user clicks the
    // browser's own "Stop sharing" button — stop gracefully in that case too.
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        hostStopSharing();
    });
}

export function hostStopSharing(): void {
    if (screenStream) {
        screenStream.getTracks().forEach((track) => {
            track.stop();
            removeTrackFromPeers(track);
        });
        screenStream = null;
    }
    useRoomStore.getState().setLocalStream(null);
    useRoomStore.getState().setIsSharing(false);
    broadcastMediaState();

    if (!hasAnyMedia()) {
        tearDownHost();
    }
}

export async function hostStartCamera(): Promise<boolean> {
    if (cameraStream) return true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true,
        });

        cameraStream = stream;
        useRoomStore.getState().setLocalCameraStream(stream);
        useRoomStore.getState().setIsCameraOn(true);
        useRoomStore.getState().setIsMicOn(true);

        ensureHostPeers();
        cameraStream.getTracks().forEach((track) => addTrackToPeers(track, cameraStream!));

        broadcastMediaState();
        return true;
    } catch (error) {
        console.error('[screenShare] Camera start failed:', error);
        return false;
    }
}

export function hostStopCamera(): void {
    if (!cameraStream) return;

    cameraStream.getTracks().forEach((track) => {
        track.stop();
        removeTrackFromPeers(track);
    });
    cameraStream = null;
    useRoomStore.getState().setLocalCameraStream(null);
    useRoomStore.getState().setIsCameraOn(false);
    useRoomStore.getState().setIsMicOn(false);
    broadcastMediaState();

    if (!hasAnyMedia()) {
        tearDownHost();
    }
}

export function hostToggleMic(): void {
    if (!cameraStream) return;
    const audioTracks = cameraStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const next = !audioTracks[0].enabled;
    audioTracks.forEach((track) => { track.enabled = next; });
    useRoomStore.getState().setIsMicOn(next);
    broadcastMediaState();
}

function broadcastMediaState(): void {
    send('media_state', {
        screenOn: !!screenStream,
        screenStreamId: screenStream?.id ?? null,
        cameraOn: !!cameraStream,
        cameraStreamId: cameraStream?.id ?? null,
        micOn: useRoomStore.getState().isMicOn,
    });
}

function tearDownHost(): void {
    if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        screenStream = null;
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
    }
    peers.forEach((conn) => conn.close());
    peers.clear();
    hostIceQueues.clear();
    const store = useRoomStore.getState();
    store.setLocalStream(null);
    store.setLocalCameraStream(null);
    store.setIsCameraOn(false);
    store.setIsMicOn(false);
    store.setIsSharing(false);
}

// ---------- Viewer ----------

export function setMediaState(state: MediaState): void {
    mediaState = state;
    const store = useRoomStore.getState();
    store.setIsCameraOn(state.cameraOn);
    store.setIsMicOn(state.micOn);
    if (!state.cameraOn) store.setRemoteCameraStream(null);
    if (!state.screenOn) store.setRemoteStream(null);
}

function ensureViewerPeer(): RTCPeerConnection {
    if (viewerPc) return viewerPc;

    viewerPc = new RTCPeerConnection(ICE_CONFIG);

    viewerPc.onicecandidate = (event) => {
        if (event.candidate) {
            const hostId = useRoomStore.getState().room?.hostId;
            if (hostId) {
                send('rtc_ice', { candidate: event.candidate.toJSON(), targetId: hostId });
            }
        }
    };

    viewerPc.ontrack = (event) => {
        const stream = event.streams[0];
        const store = useRoomStore.getState();

        // The host labels streams by their MediaStream id in media_state; fall
        // back to "first stream is the main content" when unknown.
        if (mediaState.cameraStreamId && stream.id === mediaState.cameraStreamId) {
            store.setRemoteCameraStream(stream);
        } else if (mediaState.screenStreamId && stream.id === mediaState.screenStreamId) {
            store.setRemoteStream(stream);
        } else if (!store.remoteStream) {
            store.setRemoteStream(stream);
        } else {
            store.setRemoteCameraStream(stream);
        }

        event.track.addEventListener('ended', () => {
            const s = useRoomStore.getState();
            if (stream === s.remoteStream) s.setRemoteStream(null);
            if (stream === s.remoteCameraStream) s.setRemoteCameraStream(null);
        });
    };

    viewerPc.onconnectionstatechange = () => {
        if (viewerPc && viewerPc.connectionState === 'failed') {
            const s = useRoomStore.getState();
            s.setRemoteStream(null);
            s.setRemoteCameraStream(null);
        }
    };

    return viewerPc;
}

// ---------- Signaling ----------

export function handleRTCSignal(type: RTCSignalType, payload: RTCSignalPayload): void {
    if (isHostRole()) {
        handleHostSignal(type, payload);
    } else {
        handleViewerSignal(type, payload);
    }
}

function handleHostSignal(type: RTCSignalType, payload: RTCSignalPayload): void {
    const viewerId = payload.fromId;
    if (!viewerId) return;
    const conn = peers.get(viewerId);
    if (!conn) return;

    if (type === 'rtc_answer' && payload.sdp) {
        conn.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            .then(async () => {
                const queue = hostIceQueues.get(viewerId);
                if (queue) {
                    while (queue.length) {
                        await conn.addIceCandidate(new RTCIceCandidate(queue.shift()!));
                    }
                    hostIceQueues.delete(viewerId);
                }
            })
            .catch((error) => console.error('[screenShare] Host setRemoteDescription failed:', error));
    } else if (type === 'rtc_ice' && payload.candidate) {
        if (!conn.remoteDescription) {
            const queue = hostIceQueues.get(viewerId) ?? [];
            queue.push(payload.candidate);
            hostIceQueues.set(viewerId, queue);
        } else {
            conn.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        }
    }
}

function handleViewerSignal(type: RTCSignalType, payload: RTCSignalPayload): void {
    const conn = ensureViewerPeer();

    if (type === 'rtc_offer' && payload.sdp) {
        conn.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            .then(async () => {
                while (viewerIceQueue.length) {
                    await conn.addIceCandidate(new RTCIceCandidate(viewerIceQueue.shift()!));
                }
                const answer = await conn.createAnswer();
                await conn.setLocalDescription(answer);
                const hostId = useRoomStore.getState().room?.hostId;
                if (hostId) {
                    send('rtc_answer', { sdp: conn.localDescription, targetId: hostId });
                }
            })
            .catch((error) => console.error('[screenShare] Viewer setRemoteDescription failed:', error));
    } else if (type === 'rtc_ice' && payload.candidate) {
        if (!conn.remoteDescription) {
            viewerIceQueue.push(payload.candidate);
        } else {
            conn.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        }
    }
}

export function resetScreenShare(): void {
    tearDownHost();
    if (viewerPc) {
        viewerPc.close();
        viewerPc = null;
    }
    viewerIceQueue = [];
    mediaState = { screenOn: false, screenStreamId: null, cameraOn: false, cameraStreamId: null, micOn: false };
    const store = useRoomStore.getState();
    store.setRemoteStream(null);
    store.setRemoteCameraStream(null);
    store.setIsSharing(false);
}
