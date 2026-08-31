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
status indicator shows the connected chain name (or "Standalone" outside a
container).

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

## Uploading Build Artifacts to Bulletin

Build the app, then export the uploader account as a password-protected
Polkadot.js JSON file and save it at `.bulletin/account.json`. The directory is
ignored by Git. To use a different location, set
`BULLETIN_UPLOAD_ACCOUNT_FILE` in the ignored `.env` file.

```bash
cp .env.example .env
pnpm run build
pnpm run upload:bulletin
pnpm run upload:bulletin -- --submit
```

The first command after the build is a dry run. The submit command converts
`dist/` and its JSON audit manifest into an IPFS UnixFS CAR, then uploads the
CAR chunks and storage root to Bulletin. Successful upload receipts are stored
in the ignored `.bulletin/build-upload-state.json` checkpoint so retained
content is not uploaded again.

Both dry-run and submit output include `contentCid`, the single CID for the
uploaded site content. A dry run reads only the public account data; `--submit`
prompts for the account JSON password with hidden terminal input before signing.
The uploader never writes DotNS records itself.

## Buying a DotNS Domain on Devnet

The DotNS purchase script uses the same password-protected account JSON named
by `BULLETIN_UPLOAD_ACCOUNT_FILE`. It targets PCF Devnet Asset Hub and accepts
either a bare label or a `.dot` name.

```bash
pnpm run purchase:dotns -- mysite.dot
pnpm run purchase:dotns -- mysite.dot --submit
```

The first command is read-only. It checks the account's Revive mapping, domain
availability, personhood eligibility, account balance, and the current
contract price. It prints both the EVM-denominated price and the native PAS
value that the registration transaction will send.

`--submit` prompts for the JSON export password with hidden terminal input. It
maps the account with `Revive.map_account()` when necessary, submits the DotNS
commitment, waits for the chain's minimum commitment age, then submits the
registration. The commitment secret is saved before the first transaction in
the ignored `.dotns/domain-purchase-state.json`, so repeating the same
`--submit` command resumes an interrupted purchase instead of making a new
commitment.

To deliberately discard an expired or abandoned commitment, use:

```bash
pnpm run purchase:dotns -- mysite.dot --reset
```

Keep the account password out of `.env` and command-line arguments; the script
only accepts it through the interactive terminal prompt.

## Setting a DotNS Contenthash on Devnet

After uploading the site and registering a domain, set the domain's contenthash
to the uploader's `contentCid`. The script uses the same password-protected
account JSON named by `BULLETIN_UPLOAD_ACCOUNT_FILE` and accepts a bare label or
a `.dot` name.

```bash
pnpm run contenthash:dotns -- mysite.dot <contentCid>
pnpm run contenthash:dotns -- mysite.dot <contentCid> --submit
```

The first command is read-only. It confirms the PCF Devnet network, account
mapping, domain ownership or resolver approval, CID encoding, current record,
and the contract-call simulation. `--submit` prompts for the JSON export
password with hidden terminal input, writes `setContenthash`, then re-reads the
record to verify the exact CID was stored.
