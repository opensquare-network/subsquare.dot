# Redesign Polkadot Subsquare

This is a code bundle for Redesign Polkadot Subsquare. The original project is available at https://www.figma.com/design/MtLuQeRZOpmjX0jwOz1qqe/Redesign-Polkadot-Subsquare.

## Running the code

Run `pnpm install` to install the dependencies.

Run `pnpm dev` to start the development server.

## Running inside the mock Host

Following browse-list, this app can run inside a simulated Polkadot Host
container (a same-origin test host served by a Vite middleware at
`/__test_host`). The host page embeds the app in a same-origin iframe and, via
the `@parity/product-sdk` bridge, gives it a chain connection; the top-bar Host
status indicator shows `Host` (or `Standalone` outside a container).

```bash
pnpm dev:polkadot    # default Polkadot mainnet Asset Hub
# or pnpm dev:devnet (new Paseo) / dev:paseo / dev:previewnet
# open http://localhost:5173/__test_host in a browser
```

`/__test_host` is the host page (provided by the `test-host` plugin in
`vite.config.ts`); it embeds the app in a same-origin iframe — inside the iframe
the app detects it is in a Host, so `getHostProvider` can obtain the chain
connection from the host. The host serves Asset Hub and People for the selected
network; the default is Polkadot mainnet Asset Hub.

> Note: the VS Code embedded browser cannot open the mock host (postMessage
> transport issues); use a real browser.

the ignored `.dotns/domain-purchase-state.json`, so repeating the same

## Publishing to PCF Devnet

Publish the application in this order: configure the account, register the
DotNS domain, authorize Bulletin storage, upload the build, then point the
domain at the uploaded CID. The DotNS scripts target PCF Devnet Asset Hub and
the uploader targets Bulletin devnet.

### 1. Configure the account file

Export the publishing account from Polkadot.js as a password-protected sr25519
JSON file. Keep it outside Git, then configure its path in the ignored `.env`
file. Relative paths are resolved from the repository root.

```bash
cp .env.example .env
```

```dotenv
ACCOUNT_FILE=.bulletin/account.json
```

The account must have enough PAS for the DotNS registration and be eligible for
the registration checks. Never put its password in `.env` or on the command
line; scripts request it through hidden terminal input only when a transaction
needs signing.

### 2. Buy the DotNS domain

Replace `mysite.dot` with the domain to publish. Run the read-only preflight
first, then submit after reviewing its mapping, availability, eligibility,
balance, and price output.

```bash
pnpm run purchase:dotns -- mysite.dot
pnpm run purchase:dotns -- mysite.dot --submit
```

The submit command maps the account when needed, commits the registration,
waits for the required commitment age, and registers the domain. Its checkpoint
in `.dotns/domain-purchase-state.json` lets a repeated command resume an
interrupted registration. To discard an expired or abandoned commitment:

```bash
pnpm run purchase:dotns -- mysite.dot --reset
```

### 3. Allocate Bulletin upload quota

Bulletin must authorize the account that will upload the build. Use the SS58
address in the `ACCOUNT_FILE` JSON export as `<account-address>`. The included
devnet authorizer grants 10 upload transactions and 10 MB.

```bash
pnpm run authorize:bulletin -- <account-address>
pnpm run authorize:bulletin -- <account-address> --submit
```

The first command checks the public authorizer budget and fee. The submit
command uses the public devnet authorizer; it does not unlock `ACCOUNT_FILE`.

### 4. Build and upload the application

Build the site, then run the uploader preflight before submitting. The uploader
converts `dist/` into an IPFS UnixFS CAR and prints `contentCid`, which the next
step needs.

```bash
pnpm run build
pnpm run upload:bulletin
pnpm run upload:bulletin -- --submit
```

Successful upload receipts are retained in the ignored
`.bulletin/build-upload-state.json` checkpoint, so previously uploaded content
is not sent again unless `--force` is supplied.

### 5. Set the DotNS contenthash

Replace `<contentCid>` with the CID printed by the upload step. The preflight
checks the domain, resolver authorization, CID encoding, current record, and
transaction simulation before you submit.

```bash
pnpm run contenthash:dotns -- mysite.dot <contentCid>
pnpm run contenthash:dotns -- mysite.dot <contentCid> --submit
```

The submit command unlocks `ACCOUNT_FILE` through hidden terminal input, writes
`setContenthash`, then reads the record back to confirm the CID.
