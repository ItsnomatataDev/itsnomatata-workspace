type PeerRecord = {
  peerConnection: RTCPeerConnection;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export class WebRTCMeetingService {
  private peers = new Map<string, PeerRecord>();
  private localStream: MediaStream | null = null;

  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
  }

  createPeerConnection(
    peerUserId: string,
    handlers?: {
      onIceCandidate?: (candidate: RTCIceCandidate) => void;
      onTrack?: (stream: MediaStream) => void;
      onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
    },
  ) {
    const existing = this.peers.get(peerUserId);
    if (existing) return existing.peerConnection;

    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        peerConnection.addTrack(track, this.localStream);
      }
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && handlers?.onIceCandidate) {
        handlers.onIceCandidate(event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && handlers?.onTrack) {
        handlers.onTrack(stream);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      handlers?.onConnectionStateChange?.(peerConnection.connectionState);
    };

    this.peers.set(peerUserId, { peerConnection });

    return peerConnection;
  }

  async createOffer(peerUserId: string) {
    const peerConnection = this.peers.get(peerUserId)?.peerConnection;
    if (!peerConnection) {
      throw new Error(`Peer connection for ${peerUserId} does not exist.`);
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(peerUserId: string, offer: RTCSessionDescriptionInit) {
    const peerConnection = this.peers.get(peerUserId)?.peerConnection;
    if (!peerConnection) {
      throw new Error(`Peer connection for ${peerUserId} does not exist.`);
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(peerUserId: string, answer: RTCSessionDescriptionInit) {
    const peerConnection = this.peers.get(peerUserId)?.peerConnection;
    if (!peerConnection) {
      throw new Error(`Peer connection for ${peerUserId} does not exist.`);
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(peerUserId: string, candidate: RTCIceCandidateInit) {
    const peerConnection = this.peers.get(peerUserId)?.peerConnection;
    if (!peerConnection) {
      throw new Error(`Peer connection for ${peerUserId} does not exist.`);
    }

    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  replaceVideoTrack(track: MediaStreamTrack | null) {
    this.peers.forEach(({ peerConnection }) => {
      const sender = peerConnection
        .getSenders()
        .find((item) => item.track?.kind === "video");

      if (sender) {
        void sender.replaceTrack(track);
      }
    });
  }

  replaceAudioTrack(track: MediaStreamTrack | null) {
    this.peers.forEach(({ peerConnection }) => {
      const sender = peerConnection
        .getSenders()
        .find((item) => item.track?.kind === "audio");

      if (sender) {
        void sender.replaceTrack(track);
      }
    });
  }

  removePeer(peerUserId: string) {
    const peer = this.peers.get(peerUserId);
    if (!peer) return;

    peer.peerConnection.close();
    this.peers.delete(peerUserId);
  }

  cleanup() {
    this.peers.forEach(({ peerConnection }) => {
      peerConnection.close();
    });
    this.peers.clear();
  }
}