/// <reference types="vite/client" />

/**
 * Host integration — the Polkadot Browser/Desktop host gives this app its
 * chain connection.
 *
 * Inside a host container `getHostProvider` returns a papi-compatible JSON-RPC
 * provider routed through the host's shared connection; outside a container it
 * returns null and the app keeps working with its HTTP API data alone.
 *
 * Same as browse-list: the network is selected via the `NETWORK_GENESIS_HASH`
 * env var (dev:polkadot / dev:devnet / dev:paseo / dev:previewnet). The default
 * is Polkadot mainnet Asset Hub.
 */
import { getHostProvider, isInsideContainer } from "@parity/product-sdk/host";
import { createClient, type PolkadotClient } from "polkadot-api";

// Polkadot mainnet Asset Hub — default network
const POLKADOT_ASSETHUB_GENESIS =
  "0xc1ef26b567de07159e4ecd415fbbb0340c56a09c4d72c82516d0f3bc2b782c80";

export const HOST_GENESIS: string =
  import.meta.env.NETWORK_GENESIS_HASH ?? POLKADOT_ASSETHUB_GENESIS;

type HostWindow = Window & { __HOST_API_PORT__?: MessagePort };

/**
 * Manually run the truapi-ready → truapi-init handshake and pin the host's
 * MessagePort to `window.__HOST_API_PORT__` before the SDK builds its client.
 *
 * Why handshake by hand: the SDK's iframe handshake is one-shot — a
 * `truapi-ready` posted before the host bundle is ready is silently dropped,
 * while the host eagerly pushes legacy SCALE frames into the iframe, making the
 * SDK adopt the legacy transport and ignore the later `truapi-init` port,
 * wedging the connection forever. With the port pre-pinned,
 * `createIframeCompatibilityProvider` adopts the MessagePort channel directly
 * (`win.__HOST_API_PORT__` already present), bypassing that race entirely.
 */
function ensureHostPort(): Promise<MessagePort | null> {
  const win = window as HostWindow;
  if (win.__HOST_API_PORT__) return Promise.resolve(win.__HOST_API_PORT__);
  if (window === window.top) return Promise.resolve(null);

  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        window.removeEventListener("message", onMessage);
        resolve(null);
      }
    }, 5000);

    function onMessage(event: MessageEvent) {
      if (done) return;
      if (event.source !== window.parent) return;
      const data = event.data as { type?: string } | null;
      if (data?.type !== "truapi-init") return;
      const port = (event.ports ?? [])[0];
      if (!port) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      win.__HOST_API_PORT__ = port;
      resolve(port);
    }

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "truapi-ready" }, "*");
  });
}

let clientPromise: Promise<PolkadotClient | null> | null = null;

/**
 * Lazily build a host-backed papi client; null when not inside a container.
 * On first failure (e.g. the host does not support the chain) the cache is
 * cleared to allow retry; the error is surfaced by the caller (useHostConnection).
 */
export function getHostClient(): Promise<PolkadotClient | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      if (!(await isInsideContainer())) return null;
      await ensureHostPort();
      const provider = await getHostProvider(HOST_GENESIS as `0x${string}`);
      if (!provider) return null;
      return createClient(provider);
    })().catch((err: unknown) => {
      console.warn("host connection failed", err);
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}
