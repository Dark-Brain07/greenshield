import { useState, useEffect } from 'react';
import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import './index.css';

const CONTRACT_ADDRESS = "0x1020171756f72e3C282EEB88D64364895Bf700BD";

// Read-only client for fetching state without wallet
const reader = createClient({
  chain: testnetBradbury,
  account: createAccount(),
});

interface GreenBond {
  id: string;
  claim: string;
  score: number;
  status: 'ACTIVE' | 'GREENWASHING' | 'VERIFIED';
  stake: string;
  tags: string[];
}

interface NetworkState {
  current_epoch: number;
  total_bonds: number;
  total_staked_wei: string;
  network_score_mean: number;
}

const formatGen = (weiStr: string) => {
  try {
    return (Number(BigInt(weiStr)) / 1e18).toFixed(2);
  } catch {
    return "0.00";
  }
};

const shortAddr = (s?: string) => s ? `${s.slice(0, 6)}...${s.slice(-4)}` : "";

function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  
  const [bonds, setBonds] = useState<GreenBond[]>([]);
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [claim, setClaim] = useState("");
  const [urls, setUrls] = useState("");
  const [tags, setTags] = useState("");
  const [stakeAmount, setStakeAmount] = useState("0.02");
  
  const wallet = wallets[0];

  useEffect(() => {
    let active = true;

    async function fetchProtocol() {
      try {
        const state: any = await reader.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_network_state",
          args: []
        });
        
        const ids: any = await reader.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "list_bonds",
          args: []
        });

        const fetchedBonds: GreenBond[] = [];
        for (const id of (ids || []).slice(0, 10)) {
          try {
            const b: any = await reader.readContract({
              address: CONTRACT_ADDRESS,
              functionName: "get_bond",
              args: [id]
            });
            fetchedBonds.push({
              id: b.bond_id,
              claim: b.claim || atob(b.claim_encoded || ""),
              score: Number(b.current_score || 0),
              status: b.status,
              stake: `${formatGen(b.stake_wei)} GEN`,
              tags: b.domain_tags || []
            });
          } catch (e) {
            console.error("Failed to fetch bond", id, e);
          }
        }

        if (active) {
          setNetworkState({
            current_epoch: Number(state.current_epoch),
            total_bonds: Number(state.total_bonds),
            total_staked_wei: String(state.total_staked_wei),
            network_score_mean: Number(state.network_score_mean)
          });
          setBonds(fetchedBonds);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch protocol state:", err);
        if (active) setLoading(false);
      }
    }

    fetchProtocol();
    const interval = setInterval(fetchProtocol, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const writeTx = async (functionName: string, args: any[]) => {
    if (!authenticated || !wallet) { login(); return; }
    try {
      await wallet.switchChain(4221);
      const provider = await wallet.getEthereumProvider();
      const client = createClient({ chain: testnetBradbury, account: wallet.address as any, provider });
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args
      });
      await client.waitForTransactionReceipt({ hash: tx });
      alert(`Transaction successful!`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleEvolve = (id: string) => writeTx("evolve_bond_epoch", [id]);
  const handleRelease = (id: string) => writeTx("release_bond", [id]);
  const handleSlash = (id: string) => writeTx("slash_bond", [id]);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authenticated || !wallet) {
      login();
      return;
    }
    
    setIsMinting(true);
    try {
      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
      const urlList = urls.split(/[\n,]/).map(t => t.trim()).filter(Boolean);
      const weiAmount = BigInt(Math.floor(parseFloat(stakeAmount) * 1e18));
      
      await wallet.switchChain(4221);
      const provider = await wallet.getEthereumProvider();
      
      const client = createClient({ 
        chain: testnetBradbury, 
        account: wallet.address as any, 
        provider 
      });
      
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "mint_green_bond",
        args: [claim.trim(), tagList, urlList, 30], // maturity = 30 epochs
        value: weiAmount
      });
      
      // Wait for the transaction to be processed by GenLayer consensus
      await client.waitForTransactionReceipt({ hash: tx });
      
      alert(`Mint successful! Green Bond deployed to Bradbury.`);
      setClaim("");
      setUrls("");
      setTags("");
    } catch (err: any) {
      alert(`Error minting: ${err.message}`);
      console.error(err);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          GreenShield
        </div>
        <div>
          {ready && (
            authenticated ? (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span className="btn">
                  <span className="live-indicator"></span>
                  {shortAddr(wallet?.address || user?.wallet?.address)}
                </span>
                <button className="btn" style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }} onClick={logout}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={login} disabled={!ready}>
                Connect Wallet
              </button>
            )
          )}
        </div>
      </header>

      {networkState && (
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '2rem', padding: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Epoch</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{networkState.current_epoch}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Bonds</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{networkState.total_bonds}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Staked</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>
              {formatGen(networkState.total_staked_wei)} <span style={{fontSize: '1rem'}}>GEN</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Avg Score</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{(networkState.network_score_mean / 10).toFixed(1)}</div>
          </div>
        </div>
      )}

      <main>
        <div className="subtitle">
          <span className="live-indicator"></span>
          Connected to GenLayer Bradbury: {CONTRACT_ADDRESS}
        </div>

        <div className="grid-2">
          {/* Left Column: Mint Form */}
          <div className="glass-panel">
            <h2 style={{ marginBottom: '1.5rem' }}>Stake a Green Claim</h2>
            <form onSubmit={handleMint}>
              <div className="form-group">
                <label className="form-label">Environmental Claim</label>
                <textarea 
                  className="form-input" 
                  rows={4} 
                  placeholder="E.g., 'We have reduced supply chain emissions by 30%...'"
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Evidence URLs (comma separated)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="https://company.com/esg-report, https://auditor.org/..."
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Stake Amount (GEN)</label>
                  <input type="number" step="0.01" className="form-input" placeholder="0.02" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <input type="text" className="form-input" placeholder="Energy, Transport" value={tags} onChange={(e) => setTags(e.target.value)} required />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isMinting || (!authenticated && ready)}>
                {isMinting ? "Awaiting Consensus..." : (!authenticated ? "Connect Wallet to Mint" : "Mint Green Bond")}
              </button>
            </form>
          </div>

          {/* Right Column: Active Bonds Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ paddingLeft: '1rem' }}>Network Bonds</h2>
            
            {loading ? (
              <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                Syncing with GenLayer {CONTRACT_ADDRESS}...
              </div>
            ) : bonds.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌱</div>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No bonds yet</h3>
                <p>Be the first to stake and verify an environmental claim on-chain.</p>
              </div>
            ) : (
              bonds.map((bond, idx) => (
                <div key={idx} className="glass-panel bond-card">
                  <div className="bond-header">
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Bond {bond.id.substring(0,6)}...{bond.id.substring(bond.id.length-4)}
                    </span>
                    <span className={`bond-status status-${bond.status.toLowerCase()}`}>
                      {bond.status}
                    </span>
                  </div>
                  
                  <p style={{ margin: '0.5rem 0' }}>"{bond.claim}"</p>
                  
                  <div className="tag-list">
                    {bond.tags.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                    <div>
                      <div className="form-label">Authenticity Score</div>
                      <div className="bond-score">
                        <span className={bond.score >= 850 ? 'text-accent' : bond.score < 250 ? 'text-danger' : ''}>
                          {(bond.score / 10).toFixed(1)}
                        </span>
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>/ 100</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="form-label">Staked</div>
                      <div style={{ fontWeight: '600' }}>{bond.stake}</div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    {bond.status === 'ACTIVE' && (
                       <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', minHeight: '36px', fontSize: '0.85rem' }} onClick={() => handleEvolve(bond.id)}>Evolve Bond</button>
                    )}
                    {bond.status === 'VERIFIED' && (
                       <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', backgroundColor: 'var(--accent-color)', minHeight: '36px', fontSize: '0.85rem' }} onClick={() => handleRelease(bond.id)}>Release Stake</button>
                    )}
                    {bond.status === 'GREENWASHING' && (
                       <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', backgroundColor: '#e74c3c', minHeight: '36px', fontSize: '0.85rem' }} onClick={() => handleSlash(bond.id)}>Slash Bond</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
