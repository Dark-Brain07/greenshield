# 🌱 GreenShield Protocol

GreenShield is a decentralized **Anti-Greenwashing Oracle** and ESG verification platform built on the **GenLayer Bradbury Testnet**. 

By leveraging GenLayer's AI Equivalence Principle, GreenShield allows corporations to mint "Green Bonds" by staking GEN tokens against their environmental claims. The network's validator LLMs continuously audit these claims against live, untrusted web evidence, assigning dynamic "Authenticity Scores." If a claim is found to be exaggerated or verifiably false (greenwashing), the bond's score drops, penalizing the staked tokens.

---

## 🌐 Live Demo & Deployment

- **Live Dashboard:** [GreenShield on Vercel](https://app-seven-eta-87.vercel.app)
- **Intelligent Contract Address (Bradbury):** `0xc354Eb6eeFc803f255C0Fbd63A0f29397814109F`
- **GenLayer Studio View:** [Import & View Contract](https://studio.genlayer.com/contracts?import-contract=0xc354Eb6eeFc803f255C0Fbd63A0f29397814109F)

## 🏗️ Architecture

### 1. Intelligent Contract (`contracts/greenshield.py`)
Built using the GenLayer Python SDK `v0.1.0`.
- **Non-Deterministic Execution (`gl.vm.run_nondet_unsafe`)**: Uses Web3 fetching (`gl.nondet.web.get`) and LLM evaluation (`gl.nondet.exec_prompt`) to actively read ESG reports and assess their validity.
- **Consensus Enforcement**: Custom `leader_fn` and `validator_fn` ensure all nodes independently verify the URL data and reach an agreement on the Authenticity Score before state is committed.
- **Sybil Resistance**: Minting requires a minimum stake of `0.01 GEN`, which scales up based on "Domain Tag Density" to prevent spam.

### 2. Frontend Web App (`web/app`)
A premium, dark-mode glassmorphism React dashboard built with Vite.
- **`genlayer-js` Integration**: Syncs live protocol state, epoch changes, and bond feeds directly from the Bradbury testnet.
- **Privy Authentication**: Seamless wallet connection allowing users to securely sign the `mint_green_bond` transaction using their injected Web3 wallets.

## 🚀 How to Test on Bradbury

1. Visit the [Live Dashboard](https://app-seven-eta-87.vercel.app)
2. Click **Connect Wallet** and log in via Privy (ensure you have testnet GEN on the Bradbury network).
3. Fill out an Environmental Claim. (Example: *"Patagonia pledges 1% of all sales to the preservation and restoration of the natural environment."*)
4. Provide a valid Evidence URL (Example: `https://www.patagonia.com/one-percent-for-the-planet.html`)
5. Click **Mint Green Bond** and approve the transaction. 
6. Wait ~15 seconds for the GenLayer validators to fetch the URL, run their LLMs, and reach consensus. Your bond will automatically appear in the network feed!

## 📜 GenLayer Points Portal Submission Details

#### GreenShield Core Oracle
**Title:** GreenShield Protocol: Anti-Greenwashing AI Oracle
**Description:**
GreenShield utilizes GenLayer's AI Equivalence Principle to create the first on-chain ESG oracle. By wrapping Web2 corporate sustainability reports into non-deterministic LLM prompts, GenLayer validators reach decentralized consensus on an "Authenticity Score," creating a financially staked deterrent against corporate greenwashing.

- **Contract Address:** `0xc354Eb6eeFc803f255C0Fbd63A0f29397814109F`
- **Explorer/Studio Link:** [View on GenLayer Studio](https://studio.genlayer.com/contracts?import-contract=0xc354Eb6eeFc803f255C0Fbd63A0f29397814109F)
- **Source Code:** [https://github.com/Dark-Brain07/greenshield](https://github.com/Dark-Brain07/greenshield)
- **Live MVP (Projects & Milestones):** [https://app-seven-eta-87.vercel.app](https://app-seven-eta-87.vercel.app)

---
*Built for the GenLayer Testnet Builders Program.*
