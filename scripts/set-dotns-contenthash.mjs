#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { decode, encode } from "@ensdomains/content-hash";
import { Keyring } from "@polkadot/keyring";
import {
  cryptoWaitReady,
  decodeAddress,
  encodeAddress,
  keccakAsU8a,
  xxhashAsU8a,
} from "@polkadot/util-crypto";
import { config as loadEnvironment } from "dotenv";
import { Binary, createClient } from "polkadot-api-v1";
import { getPolkadotSigner } from "polkadot-api-signer-v1";
import { getWsProvider } from "polkadot-api-ws-v1";
import {
  concatHex,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  hexToBytes,
  keccak256,
  parseAbi,
  stringToHex,
  zeroAddress,
} from "viem";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_ASSET_HUB_RPC = "wss://asset-hub-paseo-rpc.n.dwellir.com/";
const DEVNET_ASSET_HUB_GENESIS =
  "0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2";
const DOT_NODE =
  "0x3fce7d1364a893e213bc4212792b517ffc88f5b13b86c8ef9c8d390c3a1370ce";
const DOTNS_REGISTRY = "0x527b08a640b527a3dae0C4BE04D7344E430B6E50";
const DOTNS_CONTENT_RESOLVER = "0x326bdE29315199c814B1c58b431D84D16EA5cE41";
const MINIMUM_STORAGE_DEPOSIT_LIMIT = 2_000_000_000_000n;
const DRY_RUN_STORAGE_LIMIT = 18_446_744_073_709_551_615n;
const DRY_RUN_WEIGHT_LIMIT = {
  ref_time: 18_446_744_073_709_551_615n,
  proof_size: 18_446_744_073_709_551_615n,
};

const REGISTRY_ABI = parseAbi([
  "function recordExists(bytes32 node) view returns (bool)",
  "function owner(bytes32 node) view returns (address)",
]);

const CONTENT_RESOLVER_ABI = parseAbi([
  "function contenthash(bytes32 node) view returns (bytes)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setContenthash(bytes32 node, bytes hash)",
]);

loadEnvironment({ path: resolve(REPOSITORY_ROOT, ".env") });

function printUsage(exitCode = 0) {
  console.log(`Usage:
  pnpm run contenthash:dotns -- <label-or-label.dot> <ipfs-cid> [--submit]

Sets an IPFS CID as the contenthash for a DotNS .dot domain on PCF Devnet Asset Hub.

Required environment:
  BULLETIN_UPLOAD_ACCOUNT_FILE='<password-protected Polkadot.js account JSON export>'

Optional environment:
  DOTNS_ASSET_HUB_RPC='${DEFAULT_ASSET_HUB_RPC}'

Without --submit, the command only checks the account mapping, domain ownership,
resolver authorization, CID encoding, and transaction simulation.
--submit prompts for the account password with hidden terminal input before signing.`);
  process.exit(exitCode);
}

function parseArguments(args) {
  if (args.includes("--help") || args.includes("-h")) printUsage();

  const values = [];
  let submit = false;

  for (const arg of args) {
    if (arg === "--") continue;
    if (arg === "--submit") {
      submit = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      values.push(arg);
    }
  }

  if (values.length !== 2) {
    throw new Error("Provide exactly one domain and one IPFS CID");
  }

  return { cid: values[1], domain: values[0], submit };
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in the environment or .env`);
  return value;
}

function canonicalAddress(address, label) {
  try {
    const publicKey = decodeAddress(address);
    if (publicKey.length !== 32) {
      throw new Error("Expected a 32-byte Substrate account address");
    }
    return encodeAddress(publicKey, 42);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${label}: ${message}`);
  }
}

function sameAccount(first, second) {
  return Buffer.from(decodeAddress(first)).equals(
    Buffer.from(decodeAddress(second)),
  );
}

async function loadExportedAccount(path) {
  let accountJson;

  try {
    accountJson = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read account JSON ${path}: ${message}`);
  }

  if (
    !accountJson ||
    typeof accountJson !== "object" ||
    Array.isArray(accountJson) ||
    typeof accountJson.address !== "string"
  ) {
    throw new Error(`Account JSON ${path} must include an address`);
  }

  const account = canonicalAddress(
    accountJson.address,
    "BULLETIN_UPLOAD_ACCOUNT_FILE address",
  );
  const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
  let keyPair;

  try {
    keyPair = keyring.addFromJson(accountJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to import account JSON ${path}: ${message}`);
  }

  if (keyPair.type !== "sr25519") {
    throw new Error(
      `Account JSON ${path} uses ${keyPair.type}; DotNS updates require an sr25519 account export`,
    );
  }
  if (!keyPair.isLocked) {
    throw new Error(`Account JSON ${path} must be password-protected`);
  }

  const signerAddress = encodeAddress(keyPair.publicKey, 42);
  if (!sameAccount(account, signerAddress)) {
    throw new Error(
      `Account JSON ${path} address does not match its exported public key`,
    );
  }

  return { keyPair, signerAddress };
}

async function promptForAccountPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "An interactive terminal is required to unlock BULLETIN_UPLOAD_ACCOUNT_FILE",
    );
  }

  const reader = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 0,
  });
  reader._writeToOutput = () => {};
  process.stdout.write("DotNS account password: ");

  try {
    const password = await new Promise((resolve, reject) => {
      reader.once("line", resolve);
      reader.once("SIGINT", () =>
        reject(new Error("Password entry cancelled")),
      );
      reader.once("close", () => reject(new Error("Password entry cancelled")));
    });

    if (!password) throw new Error("Account password cannot be empty");
    return password;
  } finally {
    reader.close();
    process.stdout.write("\n");
  }
}

async function unlockAccount(keyPair) {
  let password = await promptForAccountPassword();

  try {
    keyPair.decodePkcs8(password);
  } catch {
    throw new Error("Unable to unlock account JSON: check the password");
  } finally {
    password = "";
  }
}

function normaliseLabel(name) {
  const raw = name.trim().toLowerCase();
  return raw.endsWith(".dot") ? raw.slice(0, -4) : raw;
}

function trailingDigitCount(label) {
  let count = 0;

  for (let index = label.length - 1; index >= 0; index -= 1) {
    const character = label.charCodeAt(index);
    if (character >= 48 && character <= 57) {
      count += 1;
    } else {
      break;
    }
  }

  return count;
}

function validateDomainLabel(label) {
  if (!/^[a-z0-9-]{3,}$/.test(label)) {
    throw new Error(
      "Invalid domain label: use lowercase letters, digits, and hyphens with a minimum length of 3",
    );
  }
  if (label.startsWith("-") || label.endsWith("-")) {
    throw new Error("Invalid domain label: cannot start or end with a hyphen");
  }

  const digits = trailingDigitCount(label);
  if (digits !== 0 && digits !== 2) {
    throw new Error(
      `Invalid domain label: use no trailing digits or exactly two, found ${digits}`,
    );
  }
}

function bytesToHex(bytes) {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function accountToEvmAddress(publicKey) {
  return bytesToHex(keccakAsU8a(publicKey).slice(12));
}

function originalAccountStorageKey(evmAddress) {
  return bytesToHex(
    new Uint8Array([
      ...xxhashAsU8a("Revive", 128),
      ...xxhashAsU8a("OriginalAccount", 128),
      ...hexToBytes(evmAddress),
    ]),
  );
}

async function readAccountMapping(client, evmAddress, publicKey) {
  const storageKey = originalAccountStorageKey(evmAddress);
  const value = await client.rawQuery(storageKey);

  if (value === null) {
    return { mapped: false, mappedAccount: null, storageKey };
  }
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("Unexpected Revive.OriginalAccount storage value");
  }

  const mappedPublicKey = hexToBytes(value);
  return {
    mapped: Buffer.from(mappedPublicKey).equals(Buffer.from(publicKey)),
    mappedAccount: encodeAddress(mappedPublicKey, 42),
    storageKey,
  };
}

function namehash(label) {
  return keccak256(concatHex([DOT_NODE, keccak256(stringToHex(label))]));
}

function sameEvmAddress(first, second) {
  try {
    return getAddress(first) === getAddress(second);
  } catch {
    return false;
  }
}

function encodeCidToContenthash(cid) {
  const input = cid.trim();
  if (!input) throw new Error("IPFS CID cannot be empty");

  try {
    const encoded = encode("ipfs", input);
    const contenthash = encoded.startsWith("0x") ? encoded : `0x${encoded}`;
    const canonicalCid = decode(contenthash.slice(2));
    return { canonicalCid, contenthash };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid IPFS CID: ${message}`);
  }
}

function decodeContenthash(contenthash) {
  if (!contenthash || contenthash === "0x" || contenthash === "0x0") {
    return null;
  }

  try {
    return decode(contenthash.slice(2));
  } catch {
    return null;
  }
}

function stringify(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

function extractReturnData(response, operation, { requireData = true } = {}) {
  const result = response?.result;
  const flags = BigInt(result?.value?.flags ?? 1);
  const data = result?.value?.data ? result.value.data.asHex() : "0x";

  if (!result?.success || (flags & 1n) !== 0n) {
    const suffix = data === "0x" ? "" : `: ${data}`;
    throw new Error(`${operation} contract call reverted${suffix}`);
  }
  if (requireData && data === "0x") {
    throw new Error(`${operation} contract call returned no data`);
  }

  return data;
}

async function dryRunContractCall(
  api,
  origin,
  contractAddress,
  value,
  encodedData,
) {
  return api.apis.ReviveApi.call(
    origin,
    Binary.fromHex(contractAddress),
    value,
    DRY_RUN_WEIGHT_LIMIT,
    DRY_RUN_STORAGE_LIMIT,
    Binary.fromHex(encodedData),
  );
}

async function readContract(api, origin, address, abi, functionName, args) {
  const encodedData = encodeFunctionData({ abi, functionName, args });
  const response = await dryRunContractCall(
    api,
    origin,
    address,
    0n,
    encodedData,
  );
  const data = extractReturnData(response, functionName);

  try {
    return decodeFunctionResult({ abi, functionName, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to decode ${functionName} response: ${message}`);
  }
}

function storageDepositCharge(storageDeposit) {
  if (typeof storageDeposit === "bigint") return storageDeposit;
  if (storageDeposit?.type === "Charge") {
    return BigInt(storageDeposit.value ?? 0);
  }
  return 0n;
}

function storageDepositLimit(estimate) {
  const charge = storageDepositCharge(estimate.storage_deposit);
  const withMargin = (charge * 120n + 99n) / 100n;
  return withMargin > MINIMUM_STORAGE_DEPOSIT_LIMIT
    ? withMargin
    : MINIMUM_STORAGE_DEPOSIT_LIMIT;
}

async function submitContenthash(api, origin, getSigner, node, contenthash) {
  const encodedData = encodeFunctionData({
    abi: CONTENT_RESOLVER_ABI,
    functionName: "setContenthash",
    args: [node, contenthash],
  });
  const estimate = await dryRunContractCall(
    api,
    origin,
    DOTNS_CONTENT_RESOLVER,
    0n,
    encodedData,
  );
  extractReturnData(estimate, "setContenthash", { requireData: false });
  const weightLimit = estimate.weight_required ?? estimate.weight_consumed;

  if (!weightLimit) {
    throw new Error("setContenthash did not return a gas estimate");
  }

  const transaction = api.tx.Revive.call({
    dest: Binary.fromHex(DOTNS_CONTENT_RESOLVER),
    value: 0n,
    weight_limit: weightLimit,
    storage_deposit_limit: storageDepositLimit(estimate),
    data: Binary.fromHex(encodedData),
  });
  const result = await transaction.signAndSubmit(await getSigner());

  if (!result.ok || !result.block) {
    throw new Error(`setContenthash dispatch failed: ${stringify(result)}`);
  }

  return { blockNumber: Number(result.block.number), txHash: result.txHash };
}

async function readResolverInfo(api, origin, node, caller) {
  const [exists, owner] = await Promise.all([
    readContract(api, origin, DOTNS_REGISTRY, REGISTRY_ABI, "recordExists", [
      node,
    ]),
    readContract(api, origin, DOTNS_REGISTRY, REGISTRY_ABI, "owner", [node]),
  ]);

  if (!exists || sameEvmAddress(owner, zeroAddress)) {
    throw new Error("Domain is not registered");
  }

  const approved = await readContract(
    api,
    origin,
    DOTNS_CONTENT_RESOLVER,
    CONTENT_RESOLVER_ABI,
    "isApprovedForAll",
    [owner, caller],
  );
  const authorized = sameEvmAddress(owner, caller) || approved;

  if (!authorized) {
    throw new Error(
      `Configured account is not authorized to update this domain. Owner is ${owner}.`,
    );
  }

  const currentContenthash = await readContract(
    api,
    origin,
    DOTNS_CONTENT_RESOLVER,
    CONTENT_RESOLVER_ABI,
    "contenthash",
    [node],
  );

  return {
    approved,
    currentCid: decodeContenthash(currentContenthash),
    currentContenthash,
    owner,
  };
}

async function main() {
  const {
    cid,
    domain: requestedDomain,
    submit,
  } = parseArguments(process.argv.slice(2));
  const label = normaliseLabel(requestedDomain);
  validateDomainLabel(label);
  const domain = `${label}.dot`;
  const { canonicalCid, contenthash } = encodeCidToContenthash(cid);
  const accountFile = resolve(
    REPOSITORY_ROOT,
    requireEnvironment("BULLETIN_UPLOAD_ACCOUNT_FILE"),
  );
  const rpc = process.env.DOTNS_ASSET_HUB_RPC ?? DEFAULT_ASSET_HUB_RPC;

  await cryptoWaitReady();
  const { keyPair, signerAddress } = await loadExportedAccount(accountFile);
  const evmAddress = accountToEvmAddress(keyPair.publicKey);
  const client = createClient(getWsProvider(rpc));
  let signer;

  async function getSigner() {
    if (!signer) {
      await unlockAccount(keyPair);
      signer = getPolkadotSigner(keyPair.publicKey, "Sr25519", (payload) =>
        keyPair.sign(payload),
      );
    }
    return signer;
  }

  try {
    const api = client.getUnsafeApi();
    const genesisHash = (await api.query.System.BlockHash.getValue(0)).asHex();
    if (genesisHash.toLowerCase() !== DEVNET_ASSET_HUB_GENESIS) {
      throw new Error(
        `Unexpected network genesis ${genesisHash}; expected PCF Devnet Asset Hub ${DEVNET_ASSET_HUB_GENESIS}`,
      );
    }

    const node = namehash(label);
    const mapping = await readAccountMapping(
      client,
      evmAddress,
      keyPair.publicKey,
    );
    if (!mapping.mapped) {
      const mappedTo = mapping.mappedAccount
        ? ` It is mapped to ${mapping.mappedAccount}.`
        : "";
      throw new Error(
        `Configured account is not mapped to EVM address ${evmAddress}.${mappedTo} Map it before setting a DotNS contenthash.`,
      );
    }

    const resolver = await readResolverInfo(
      api,
      signerAddress,
      node,
      evmAddress,
    );
    const encodedData = encodeFunctionData({
      abi: CONTENT_RESOLVER_ABI,
      functionName: "setContenthash",
      args: [node, contenthash],
    });
    const estimate = await dryRunContractCall(
      api,
      signerAddress,
      DOTNS_CONTENT_RESOLVER,
      0n,
      encodedData,
    );
    extractReturnData(estimate, "setContenthash", { requireData: false });
    const plan = {
      action: submit ? "set DotNS contenthash" : "dry run",
      account: signerAddress,
      cid: canonicalCid,
      contenthash,
      currentCid: resolver.currentCid,
      currentContenthash: resolver.currentContenthash,
      domain,
      evmAddress,
      mapping: {
        mapped: true,
        mappedAccount: mapping.mappedAccount,
      },
      node,
      owner: resolver.owner,
      resolverAuthorized: true,
      storageDepositLimit: storageDepositLimit(estimate),
      transactionWeight: estimate.weight_required ?? estimate.weight_consumed,
    };
    console.log(stringify(plan));

    if (!submit) {
      console.log(
        "Dry run complete. Re-run with --submit to set the contenthash.",
      );
      return;
    }

    console.log("Submitting DotNS contenthash update...");
    const receipt = await submitContenthash(
      api,
      signerAddress,
      getSigner,
      node,
      contenthash,
    );
    const storedContenthash = await readContract(
      api,
      signerAddress,
      DOTNS_CONTENT_RESOLVER,
      CONTENT_RESOLVER_ABI,
      "contenthash",
      [node],
    );

    if (storedContenthash.toLowerCase() !== contenthash.toLowerCase()) {
      throw new Error(
        "setContenthash transaction completed but the stored record does not match the requested CID",
      );
    }

    console.log(
      stringify({
        blockNumber: receipt.blockNumber,
        cid: canonicalCid,
        contenthash: storedContenthash,
        domain,
        txHash: receipt.txHash,
        updated: true,
      }),
    );
  } finally {
    if (!keyPair.isLocked) keyPair.lock();
    client.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
