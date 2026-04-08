type PeerRecord = {
  peerConnection: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },

  // Testing TURN servers
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export class WebRTCMeetingService {
  private peers = new Map<string, PeerRecord>();
  private localStream: MediaStream | null = null;

  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
  }

  hasPeer(peerUserId: string) {
    return this.peers.has(peerUserId);
  }

  createPeerConnection(
    peerUserId: string,
    handlers?: {
      onIceCandidate?: (candidate: RTCIceCandidate) => void | Promise<void>;
      onTrack?: (stream: MediaStream) => void;
      onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
    },
  ) {
    const existing = this.peers.get(peerUserId);
    if (existing) return existing.peerConnection;

    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    const record: PeerRecord = {
      peerConnection,
      pendingCandidates: [],
    };

    if (this.localStream) {
      const tracks = this.localStream.getTracks();
      console.log("ADDING LOCAL TRACKS:", tracks.map((t) => t.kind));

      for (const track of tracks) {
        peerConnection.addTrack(track, this.localStream);
      }
    } else {
      console.warn("No local stream was available when creating peer connection.");
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && handlers?.onIceCandidate) {
        void handlers.onIceCandidate(event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      console.log("REMOTE TRACK RECEIVED:", peerUserId, event.streams);
      const [stream] = event.streams;
      if (stream && handlers?.onTrack) {
        handlers.onTrack(stream);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log("PEER STATE:", peerUserId, peerConnection.connectionState);
      handlers?.onConnectionStateChange?.(peerConnection.connectionState);
    };

    this.peers.set(peerUserId, record);
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
    const record = this.peers.get(peerUserId);
    const peerConnection = record?.peerConnection;

    if (!peerConnection || !record) {
      throw new Error(`Peer connection for ${peerUserId} does not exist.`);
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Flush any ICE candidates that arrived early
    if (record.pendingCandidates.length > 0) {
      for (const candidate of record.pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("FAILED TO APPLY PENDING ICE CANDIDATE:", err);
        }
      }
      record.pendingCandidates = [];
    }

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(peerUserId: string, answer: RTCSessionDescriptionInit) {
    const record = this.peers.get(peerUserId);
    const peerConnection = record?.peerConnection;

    if (!peerConnection || !record) {
      throw new Error(`Peer connection for ${peerUserId} does not exist.`);
    }

    if (peerConnection.signalingState === "closed") return;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    // Flush any ICE candidates that arrived early
    if (record.pendingCandidates.length > 0) {
      for (const candidate of record.pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("FAILED TO APPLY PENDING ICE CANDIDATE:", err);
        }
      }
      record.pendingCandidates = [];
    }
  }

  async addIceCandidate(peerUserId: string, candidate: RTCIceCandidateInit) {
    const record = this.peers.get(peerUserId);
    const peerConnection = record?.peerConnection;

    if (!peerConnection || !record) {
      throw new Error(`Peer connection for ${peerUserId} does not exist.`);
    }

    if (peerConnection.signalingState === "closed") return;

    // Queue ICE if remote description is not ready yet
    if (peerConnection.remoteDescription == null) {
      record.pendingCandidates.push(candidate);
      return;
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