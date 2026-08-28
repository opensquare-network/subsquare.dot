# Redesign Polkadot Subsquare

This is a code bundle for Redesign Polkadot Subsquare. The original project is available at https://www.figma.com/design/MtLuQeRZOpmjX0jwOz1qqe/Redesign-Polkadot-Subsquare.

## Running the code

Run `yarn install` to install the dependencies.

Run `yarn dev` to start the development server.

## Running inside the mock Host

Following browse-list, this app can run inside a simulated Polkadot Host
container (a same-origin test host served by a Vite middleware at
`/__test_host`). The host page embeds the app in a same-origin iframe and, via
the `@parity/product-sdk` bridge, gives it a chain connection; the top-bar Host
status indicator shows the connected chain name (or "Standalone" outside a
container).

```bash
yarn dev:polkadot    # default Polkadot mainnet Asset Hub
# or yarn dev:devnet (new Paseo) / dev:paseo / dev:previewnet
# open http://localhost:5173/__test_host in a browser
```

`/__test_host` is the host page (provided by the `test-host` plugin in
`vite.config.ts`); it embeds the app in a same-origin iframe — inside the iframe
the app detects it is in a Host, so `getHostProvider` can obtain the chain
connection from the host. The host serves Asset Hub and People for the selected
network; the default is Polkadot mainnet Asset Hub.

> Note: the VS Code embedded browser cannot open the mock host (postMessage
> transport issues); use a real browser.
