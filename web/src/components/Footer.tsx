import Image from "next/image";
import Link from "next/link";
import {
  BOTCHAIN_EXPLORER_URL, BOTCHAIN_SITE_URL, DOCS_URL, FAUCET_URL, activeChain, addressUrl, explorerUrl, stakeAddress,
} from "@/lib/chains";
import { StakeWordmark } from "./Icons";

export function Footer() {
  const contractLink = stakeAddress ? addressUrl(stakeAddress) : null;
  // The explorer for the active network (mainnet in production); falls back to the mainnet explorer.
  const chainExplorer = explorerUrl ?? BOTCHAIN_EXPLORER_URL;
  return (
    <footer className="footer">
      <div>
        <Link href="/" className="brand" aria-label="STAKE home">
          <StakeWordmark className="brand-name" />
        </Link>
        <p className="footer-desc">
          A fast, low-cost prediction market built for the BOT Chain ecosystem. Short YES/NO markets, staked in BOT,
          settled and claimed on-chain.
        </p>
        <p className="footer-meta">Network: {activeChain.name} · chain {activeChain.id}</p>
      </div>
      <div>
        <h3>Markets</h3>
        <ul>
          <li><Link href="/markets?tab=active">Active</Link></li>
          <li><Link href="/markets?tab=closing">Closing Soon</Link></li>
          <li><Link href="/markets?tab=resolved">Resolved</Link></li>
          <li><Link href="/leaderboard">Leaderboard</Link></li>
        </ul>
      </div>
      <div>
        <h3>Resources</h3>
        <ul>
          <li><a className="ext" href={DOCS_URL} target="_blank" rel="noreferrer">BOT Chain docs</a></li>
          {activeChain.testnet && activeChain.id !== 31337 && <li><a className="ext" href={FAUCET_URL} target="_blank" rel="noreferrer">Testnet faucet</a></li>}
          {contractLink && <li><a className="ext" href={contractLink} target="_blank" rel="noreferrer">STAKE contract</a></li>}
        </ul>
      </div>
      <div>
        <h3>Community</h3>
        <ul>
          <li><a className="ext" href="https://t.me/BOTChainNetwork" target="_blank" rel="noreferrer">BOT Chain Telegram</a></li>
        </ul>
      </div>

      <div className="footer-chain">
        <span className="label">Built on</span>
        <a href={BOTCHAIN_SITE_URL} target="_blank" rel="noreferrer" className="footer-chain-logo" aria-label="BOT Chain official website">
          <Image src="/brand/botchain-logo.png" alt="BOT Chain" width={164} height={32} />
        </a>
        <nav className="footer-chain-links" aria-label="BOT Chain">
          <a className="ext" href={BOTCHAIN_SITE_URL} target="_blank" rel="noreferrer">BOT Chain official website</a>
          <a className="ext" href={chainExplorer} target="_blank" rel="noreferrer">BOT Chain Explorer</a>
        </nav>
      </div>
    </footer>
  );
}
