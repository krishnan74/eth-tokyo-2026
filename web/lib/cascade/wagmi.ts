import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";

/** Browser-side RPC for reads and receipts. Point it at an anvil fork of Sepolia to rehearse. */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
export const IS_FORK = !!process.env.NEXT_PUBLIC_RPC_URL && /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_RPC_URL);

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: { [sepolia.id]: http(RPC_URL) },
  ssr: true,
});
