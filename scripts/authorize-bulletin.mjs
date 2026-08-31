#!/usr/bin/env node

import { Keyring } from "@polkadot/keyring";
import {
  cryptoWaitReady,
  decodeAddress,
  encodeAddress,
} from "@polkadot/util-crypto";
import { createClient, Enum } from "polkadot-api";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws";

const BULLETIN_RPC = "wss://bulletin-paseo.tservices.es:8443";
const AUTHORIZER_SURI = "//Eve";
const AUTHORIZER = "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw";
const TRANSACTION_ALLOWANCE = 10;
const BYTE_ALLOWANCE = 10_000_000n;

function printUsage(exitCode = 0) {
  console.log(`Usage:
  pnpm run authorize:bulletin -- <address> [--submit]

Grants the recipient 10 upload transactions and 10 MB (10,000,000 bytes).
Uses the public ${AUTHORIZER_SURI} authorizer on Bulletin devnet.

Without --submit, the command only validates the recipient, authorizer budget,
and transaction fee. --submit signs and broadcasts the authorization.`);
  process.exit(exitCode);
}

function parseArguments(args) {
  if (args.includes("--help") || args.includes("-h")) printUsage();

  const addresses = [];
  let submit = false;

  for (const arg of args) {
    if (arg === "--") {
      continue;
    } else if (arg === "--submit") {
      submit = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      addresses.push(arg);
    }
  }

  if (addresses.length !== 1) printUsage(1);

  return { address: addresses[0], submit };
}

function canonicalAddress(address) {
  try {
    const publicKey = decodeAddress(address);
    if (publicKey.length !== 32) {
      throw new Error("Expected a 32-byte Substrate account address");
    }
    return encodeAddress(publicKey, 42);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid recipient address: ${message}`);
  }
}

function stringify(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

async function main() {
  const { address, submit } = parseArguments(process.argv.slice(2));

  await cryptoWaitReady();

  const recipient = canonicalAddress(address);
  const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
  const authorizerPair = keyring.addFromUri(AUTHORIZER_SURI);
  const authorizer = encodeAddress(authorizerPair.publicKey, 42);

  if (authorizer !== AUTHORIZER) {
    throw new Error(
      `The supplied SURI derives ${authorizer}, not the required authorizer ${AUTHORIZER}`,
    );
  }

  const client = createClient(getWsProvider(BULLETIN_RPC));

  try {
    const api = client.getUnsafeApi();
    const [currentBlock, authorizerBudget, existingAuthorization] =
      await Promise.all([
        api.query.System.Number.getValue(),
        api.query.TransactionStorage.AllowedAuthorizers.getValue(AUTHORIZER),
        api.query.TransactionStorage.Authorizations.getValue(
          Enum("Account", recipient),
        ),
      ]);

    if (!authorizerBudget) {
      throw new Error(`${AUTHORIZER} is not an allowed Bulletin authorizer`);
    }

    const quota = authorizerBudget.quota;
    if (
      quota &&
      (quota.transactions < TRANSACTION_ALLOWANCE ||
        quota.bytes < BYTE_ALLOWANCE)
    ) {
      throw new Error(
        `Authorizer budget is insufficient: ${quota.transactions} transactions and ${quota.bytes} bytes available`,
      );
    }

    const tx = api.tx.TransactionStorage.authorize_account({
      who: recipient,
      transactions: TRANSACTION_ALLOWANCE,
      bytes: BYTE_ALLOWANCE,
    });
    const estimatedFee = await tx.getEstimatedFees(authorizer);

    console.log(
      stringify({
        action: submit ? "submit authorization" : "dry run",
        rpc: BULLETIN_RPC,
        currentBlock,
        recipient,
        authorization: {
          transactions: TRANSACTION_ALLOWANCE,
          bytes: BYTE_ALLOWANCE,
        },
        authorizer: AUTHORIZER,
        authorizerBudget,
        existingRecipientAuthorization: existingAuthorization,
        estimatedFee,
      }),
    );

    if (!submit) {
      console.log(
        "Dry run complete. Re-run with --submit to sign and broadcast.",
      );
      return;
    }

    const signer = getPolkadotSigner(
      authorizerPair.publicKey,
      "Sr25519",
      (payload) => authorizerPair.sign(payload),
    );
    const result = await tx.signAndSubmit(signer);

    if (!result.ok) {
      throw new Error(`Authorization dispatch failed: ${stringify(result)}`);
    }

    const recipientAuthorization =
      await api.query.TransactionStorage.Authorizations.getValue(
        Enum("Account", recipient),
      );

    console.log(
      stringify({
        authorized: true,
        txHash: result.txHash,
        block: result.block,
        recipientAuthorization,
      }),
    );
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
