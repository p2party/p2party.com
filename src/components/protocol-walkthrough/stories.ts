export type Point = readonly [
  x: number,
  y: number,
  label: string,
  detail?: string,
];
export type Edge = readonly [from: number, to: number];
export interface Frame {
  title: string;
  detail: string;
  value: string;
  nodes: Point[];
  edges: Edge[];
  active: number[];
  focus?: number[];
  waves?: number[][];
}
export interface Story {
  id: string;
  label: string;
  context: string;
  frames: Frame[];
  sources: [string, string][];
}

// Coordinates are proportions of the illustration. Edge order preserves the direction
// of the message, hash input or DAG parent reference shown in each frame.
const peers: Point[] = [
  [0.19, 0.7, "Alice", "browser"],
  [0.5, 0.22, "Signaling", "room service"],
  [0.81, 0.7, "Bob", "browser"],
];
const peerEdges: Edge[] = [
  [0, 1],
  [2, 1],
  [0, 2],
  [2, 0],
];
const unit: Point[] = [
  [0.18, 0.69, "Input", "unspent unit"],
  [0.5, 0.22, "Signed move", "one input"],
  [0.82, 0.69, "Output", "new unit"],
];
const unitEdges: Edge[] = [
  [0, 1],
  [1, 2],
];
const pay: Point[] = [
  [0.18, 0.69, "Sender", "wallet"],
  [0.5, 0.22, "Validator", "public history"],
  [0.82, 0.69, "Recipient", "wallet"],
];
const payEdges: Edge[] = [
  [2, 0],
  [0, 1],
  [2, 1],
  [1, 2],
];
const firstTree: Point[] = [
  [0.13, 0.79, "H(n₀)"],
  [0.41, 0.79, "H(pk₀)"],
  [0.27, 0.49, "Owner 0"],
  [0.75, 0.49, "v₋₁", "initial root"],
  [0.51, 0.17, "v₀", "unit root"],
];
const treeEdges: Edge[] = [
  [0, 2],
  [1, 2],
  [2, 4],
  [3, 4],
];
const historyTree: Point[] = [
  [0.13, 0.8, "Owner 0"],
  [0.4, 0.8, "v₋₁"],
  [0.26, 0.56, "v₀"],
  [0.54, 0.56, "Owner 1"],
  [0.4, 0.33, "v₁"],
  [0.72, 0.33, "Owner 2"],
  [0.57, 0.11, "v₂"],
];
const historyEdges: Edge[] = [
  [0, 2],
  [1, 2],
  [3, 4],
  [2, 4],
  [5, 6],
  [4, 6],
];
const nativeOwner: Point[] = [
  [0.14, 0.73, "Suite", "1 byte"],
  [0.5, 0.73, "H(nonce)", "64 bytes"],
  [0.86, 0.73, "H(pk)", "64 bytes"],
  [0.5, 0.25, "unit/owner", "64-byte commitment"],
];
const nativeEdges: Edge[] = [
  [0, 3],
  [1, 3],
  [2, 3],
];
const proposals: Point[] = [
  [0.21, 0.19, "A₁"],
  [0.21, 0.5, "B₁"],
  [0.21, 0.81, "C₁"],
  [0.5, 0.19, "A₂"],
  [0.5, 0.5, "B₂"],
  [0.5, 0.81, "C₂"],
  [0.79, 0.19, "A₃"],
  [0.79, 0.5, "B₃"],
  [0.79, 0.81, "C₃"],
];
const parents: Edge[] = [
  [3, 0],
  [3, 1],
  [3, 2],
  [4, 0],
  [4, 1],
  [4, 2],
  [5, 0],
  [5, 1],
  [5, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [7, 3],
  [7, 4],
  [7, 5],
  [8, 3],
  [8, 4],
  [8, 5],
];
const votes: Point[] = [
  [0.13, 0.77, "A", "weight 4"],
  [0.38, 0.77, "B", "weight 4"],
  [0.63, 0.77, "C", "weight 4"],
  [0.88, 0.77, "D", "weight 2"],
  [0.5, 0.25, "Proposal", "availability votes"],
];
const voteEdges: Edge[] = [
  [0, 4],
  [1, 4],
  [2, 4],
  [3, 4],
];
export const stories: Story[] = [
  {
    id: "rooms",
    label: "Encrypted rooms",
    context: "Public rooms · peer v4",
    frames: [
      {
        title: "Find the other browser",
        detail:
          "Alice and Bob open the same invitation. Each signs a challenge for the signaling host and supplies a hash of the room secret. The host introduces the peers.",
        value: "Signaling v5 · signed challenge + room hash",
        nodes: peers,
        edges: peerEdges,
        active: [0, 1],
      },
      {
        title: "Agree on a shared secret",
        detail:
          "Across their WebRTC connection the browsers combine X25519 three-DH with the room’s ML-KEM exchange. Ed25519 authenticates identity keys. Both peers confirm the resulting session before using it.",
        value: "Hybrid key agreement · classical identity signatures",
        nodes: peers,
        edges: peerEdges,
        active: [2, 3],
      },
      {
        title: "Send encrypted cells",
        detail:
          "A ratchet advances the message keys. Alice splits and encrypts the message into fixed-size cells. This example takes a direct path. A TURN relay can forward ciphertext when a direct path is unavailable.",
        value: "65,490 bytes per encrypted cell",
        nodes: peers,
        edges: peerEdges,
        active: [2],
      },
      {
        title: "Verify and reassemble",
        detail:
          "Bob opens the cells and verifies their chunks against the message’s Merkle root. He can assemble the file once all the required chunks verify.",
        value: "Checked chunks → complete message",
        nodes: peers,
        edges: [],
        active: [],
        focus: [2],
      },
    ],
    sources: [
      ["Peer protocol and recovery", "#sending-and-recovering-a-message"],
      ["Try the handshake", "/session-lab"],
    ],
  },
  {
    id: "ledger",
    label: "Testnet ledger",
    context: "Public Testnet 1 · single operator",
    frames: [
      {
        title: "Start with an unspent unit",
        detail:
          "Testnet 1 started with 128 valueless units. Each has an output ID, a weight and an owner commitment. This example follows one unit of weight one.",
        value: "Input · 1 P2PARTY",
        nodes: unit,
        edges: unitEdges,
        active: [],
        focus: [0],
      },
      {
        title: "Authorize the next owner",
        detail:
          "The sender signs a move that names the input, chain, weight, expiry and recipient’s fresh commitment. The input’s suite selects ML-DSA-65 or SLH-DSA-SHA2-192s.",
        value: "One signed instruction · one destination",
        nodes: unit,
        edges: unitEdges,
        active: [0],
      },
      {
        title: "Check and order the spend",
        detail:
          "The public validator checks the signature and opening, confirms the input is unspent and the destination unused, and enforces the weight and expiry. An accepted move receives a place in the ordered history.",
        value: "An invalid spend leaves the unit available",
        nodes: unit,
        edges: [],
        active: [],
        focus: [1],
      },
      {
        title: "Replace the input with its output",
        detail:
          "The previous output becomes spent. The signed move and output index determine a new ID. Anyone can follow that public link, and the recipient can recognize the new commitment.",
        value: "1 P2PARTY in → 1 P2PARTY out",
        nodes: unit,
        edges: unitEdges,
        active: [1],
      },
    ],
    sources: [
      ["Follow a real transfer", "/explorer/testnet"],
      [
        "Native transfer verifier",
        "https://github.com/p2party/libdemos/blob/94c6e968a7cba8dc30e2d53ca781fbfacb3e97c1/ledger/transfer.c",
      ],
    ],
  },
  {
    id: "commitments",
    label: "Commitment tree",
    context: "Karoukis (2023), Fig. 1 · Testnet 1 adaptation",
    frames: [
      {
        title: "Hash the first owner’s two leaves",
        detail:
          "In Figure 1, n₀ is a fresh nonce and pk₀ is the first owner’s public key. Hash each, concatenate the two digests, then hash again to form the owner branch.",
        value: "Owner 0 = H(H(n₀) ∥ H(pk₀))",
        nodes: firstTree,
        edges: treeEdges,
        active: [0, 1],
      },
      {
        title: "Form the first unit root",
        detail:
          "Follow the arrows from the owner branch and the initial root to v₀. The figure starts its history with two copies of H(0). The double bar means concatenation.",
        value: "Figure 1 · v₋₁ = H(H(0) ∥ H(0))",
        nodes: firstTree,
        edges: treeEdges,
        active: [2, 3],
      },
      {
        title: "Follow the same unit across owners",
        detail:
          "Read upward from v₀. Each change adds a fresh owner branch and carries the preceding unit into the new root. The paper’s delegation and reversal rules use information disclosed between participants.",
        value: "Figure 1 · v₀ → v₁ → v₂",
        nodes: historyTree,
        edges: historyEdges,
        active: [0, 1, 2, 3, 4, 5],
        waves: [
          [0, 1],
          [2, 3],
          [4, 5],
        ],
      },
      {
        title: "Compare the native owner commitment",
        detail:
          "In Testnet 1, a tagged SHA-512 hash binds the signature suite, a hash of the 32-byte nonce and a hash of the public key. The signed spend links to the previous output separately. Coin transfers use a fresh destination.",
        value: "tagged SHA-512(“unit/owner”, suite ∥ H(nonce) ∥ H(pk))",
        nodes: nativeOwner,
        edges: nativeEdges,
        active: [0, 1, 2],
      },
    ],
    sources: [
      [
        "D. Karoukis (2023), §3, Figure 1, p. 7",
        "https://arxiv.org/pdf/2302.14421v2#page=7",
      ],
      [
        "Native owner encoding",
        "https://github.com/p2party/libdemos/blob/94c6e968a7cba8dc30e2d53ca781fbfacb3e97c1/ledger/transfer.c",
      ],
    ],
  },
  {
    id: "consensus",
    label: "Validator consensus",
    context: "Local four-process prototype · bonded weight 14",
    frames: [
      {
        title: "Collect availability votes",
        detail:
          "In the local experiment A and B each have four bonded units. They can acknowledge a proposal they have stored, but their combined weight is below the threshold for a certificate.",
        value: "8 of 14 · more than two thirds required",
        nodes: votes,
        edges: voteEdges,
        active: [0, 1],
      },
      {
        title: "Cross the quorum threshold",
        detail:
          "C also stores and signs the proposal. A, B and C now represent twelve of fourteen units. Their availability certificate establishes that a quorum accepted the data. Ordering requires further rounds.",
        value: "12 of 14 · availability certified",
        nodes: votes,
        edges: voteEdges,
        active: [0, 1, 2],
      },
      {
        title: "Connect proposals across rounds",
        detail:
          "Each column is a round. Proposals reference certified parents in the preceding column, forming a directed acyclic graph. The highlighted references show one proposal naming three parents.",
        value: "New proposal → earlier certified parents",
        nodes: proposals,
        edges: parents,
        active: [12, 13, 14],
      },
      {
        title: "Order, execute and certify",
        detail:
          "Later support in the graph can commit an eligible anchor. Validators derive the same order, execute valid spends and sign the resulting height, receipt root and spent-state root. Testnet 1 still uses one public operator.",
        value: "Local pilot · matching order and state",
        nodes: proposals,
        edges: parents,
        active: [3, 4, 5, 10, 13, 16],
        focus: [4],
      },
    ],
    sources: [
      [
        "Voting rules and research references",
        "/whitepaper#how-validators-agree-on-transaction-order",
      ],
      [
        "Danezis et al. (2022), Narwhal and Tusk",
        "https://arxiv.org/abs/2105.11827v4",
      ],
      [
        "Spiegelman et al. (2022), Bullshark, §2.2",
        "https://arxiv.org/abs/2209.05633v1",
      ],
      [
        "Four-process experiment",
        "https://github.com/p2party/p2party-server/blob/ba6f1d00e8159b05fc9b3ce0b4cdac53dc8d3ddc/tools/ordering/peer-network.md",
      ],
    ],
  },
  {
    id: "receive",
    label: "Offline payments",
    context: "Public Testnet 1 · one unit per request",
    frames: [
      {
        title: "Share a backed-up request",
        detail:
          "The recipient saves and checks a wallet backup containing this request’s key and nonce. They give the sender the public payment request and can then close their wallet.",
        value: "Share the suite and full commitment",
        nodes: pay,
        edges: payEdges,
        active: [0],
      },
      {
        title: "Pay while the recipient is offline",
        detail:
          "The sender submits a signed move. The validator can accept and record it while the recipient’s browser is closed. The recipient’s last checked balance can still show the earlier amount.",
        value: "Recipient offline · payment on the ledger",
        nodes: pay,
        edges: payEdges,
        active: [1],
      },
      {
        title: "Reconnect to the validator",
        detail:
          "The recipient opens or restores the backup that contains the request and starts a sync. The wallet obtains the same public history as other readers without sending a list of its receive commitments.",
        value: "Public receipts since the wallet’s trusted checkpoint",
        nodes: pay,
        edges: payEdges,
        active: [2, 3],
      },
      {
        title: "Recognize the payment locally",
        detail:
          "The wallet verifies the history, finds its commitment and counts the output if it remains unspent. It shows the height it checked. If the validator is unreachable, the last checked height still matters.",
        value: "Verified unspent match · +1 P2PARTY in this example",
        nodes: pay,
        edges: [],
        active: [],
        focus: [2],
      },
    ],
    sources: [
      ["Receive and restore a wallet", "/wallet"],
      ["Inspect public receipts", "/explorer/testnet"],
    ],
  },
];
