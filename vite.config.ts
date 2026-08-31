import { defineConfig } from "vite";
import path from "path";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(__dirname, "src/assets", filename);
      }
    },
  };
}

// RPC config for the chains. The host page picks the matching RPC for
// the selected genesis (same as browse-list).
//
// ┌─────────────┬──────────────────────────────────────────────────────────┐
// │ Chain       │ Notes                                                    │
// ├─────────────┼──────────────────────────────────────────────────────────┤
// │ polkadot    │ = Polkadot mainnet Asset Hub (asset-hub-polkadot).        │
// │             │ Default source.                                          │
// │ devnet      │ = new Paseo (asset-hub-paseo, spec 2004002), live; the    │
// │             │ one browse.dev-dot.li uses. TLD=.dot.                     │
// │ paseo       │ = old paseo (next-asset-hub-paseo, spec 2000036).        │
// │ previewnet  │ = preview network, TLD=.dot, chain was reset.            │
// └─────────────┴──────────────────────────────────────────────────────────┘
const NETWORKS: Record<
  string,
  { assetHubRpc: string; peopleGenesis: string; peopleRpc: string }
> = {
  // —— polkadot (mainnet Asset Hub): default ——
  "0xc1ef26b567de07159e4ecd415fbbb0340c56a09c4d72c82516d0f3bc2b782c80": {
    assetHubRpc: "wss://polkadot-asset-hub-rpc.polkadot.io",
    peopleGenesis:
      "0x7a62a14ebf9b2e86292593414d58818324acc5701ea369734c0074f7c962bc0f",
    peopleRpc: "wss://polkadot-people-rpc.polkadot.io",
  },
  // —— devnet (new Paseo): same source as browse.dev-dot.li ——
  "0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2": {
    assetHubRpc: "wss://asset-hub-paseo-rpc.n.dwellir.com/",
    peopleGenesis:
      "0xe6c30d6e148f250b887105237bcaa5cb9f16dd203bf7b5b9d4f1da7387cb86ec",
    peopleRpc: "wss://people-paseo.rotko.net",
  },
  // —— paseo (old) ——
  "0x23e730eb1c6fecae09c917439a5038cb6122d0d48980e8b9bbf0ff56f94a2ca6": {
    assetHubRpc: "wss://paseo-asset-hub-next-rpc.polkadot.io",
    peopleGenesis:
      "0x89a63b11fef2c0273fc72c0d864da0793a665dade5db153e0cab995348c5440f",
    peopleRpc: "wss://paseo-people-next-system-rpc.polkadot.io",
  },
  // —— previewnet ——
  "0x4d11c803cc6921429e3876638977ad006ea1bba8cd3976a0bca2f164e7026210": {
    assetHubRpc: "wss://previewnet.substrate.dev/asset-hub",
    peopleGenesis:
      "0x3138c6d4ce58c760047a413c2a930e919b4673a841ab4890de59aac3bd037f3d",
    peopleRpc: "wss://previewnet.substrate.dev/people",
  },
};
// Default: Polkadot mainnet Asset Hub
const POLKADOT =
  "0xc1ef26b567de07159e4ecd415fbbb0340c56a09c4d72c82516d0f3bc2b782c80";

// Host-side protocol implementation (simulates the real Host, from host-api-test-sdk)
const HOST_BUNDLE = readFileSync(
  resolve(
    __dirname,
    "node_modules/@parity/host-api-test-sdk/dist/host-bundle.js",
  ),
  "utf-8",
);

export default defineConfig({
  envPrefix: ["NETWORK_"], // expose NETWORK_GENESIS_HASH to import.meta.env
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    {
      name: "test-host",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          if (url.pathname !== "/__test_host") return next();
          // A request for the same path from the app iframe → let Vite serve the app
          if (req.headers["sec-fetch-dest"] === "iframe") return next();
          // Top-level → serve the host page (protocol + config)
          const genesis = process.env.NETWORK_GENESIS_HASH ?? POLKADOT;
          const net = NETWORKS[genesis] ?? NETWORKS[POLKADOT];
          const config = JSON.stringify({
            productUrl: `http://localhost:${server.config.server.port ?? 5173}/`,
            accounts: [{ name: "Alice", uri: "//Alice" }],
            networks: [
              {
                genesisHash: genesis,
                rpcUrl: net.assetHubRpc,
                name: "Asset Hub",
              },
              {
                genesisHash: net.peopleGenesis,
                rpcUrl: net.peopleRpc,
                name: "People",
              },
            ],
          }).replace(/<\//g, "<\\/");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Test Host</title>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:none}</style>
</head><body>
<iframe id="product-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
<script>window.__TEST_HOST_CONFIG__ = ${config};</script>
<script>${HOST_BUNDLE}</script>
<script>
window.setInterval(() => {
  const host = window.__TEST_HOST__;
  if (!host) return;
  host.setTheme(host.getTheme().variant === "Dark" ? "light" : "dark");
}, 10_000);
</script>
</body></html>`);
        });
      },
    },
  ],
  resolve: {
    dedupe: ["@polkadot-api/json-rpc-provider"],
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
