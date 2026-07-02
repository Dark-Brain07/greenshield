import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from "@privy-io/react-auth";
import App from './App.tsx'
import './index.css'

export const bradbury = {
  id: 4221,
  name: "GenLayer Bradbury",
  network: "genlayer-bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { 
    default: { http: ["https://rpc-bradbury.genlayer.com"] },
    public: { http: ["https://rpc-bradbury.genlayer.com"] }
  },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer-bradbury.genlayer.com" } },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId="cmr34yzbx000u0cl1dewsavlz" // User's custom Privy App ID
      config={{
        defaultChain: bradbury as any,
        supportedChains: [bradbury as any],
        embeddedWallets: { createOnLogin: "users-without-wallets" } as any,
        appearance: { theme: "dark", accentColor: "#00ff66" }, // updated accent for GreenShield
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
)
