#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
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
import { getWsProvider as getTransactionWsProvider } from "polkadot-api-ws-v1";
import {
  concatHex,
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  hexToBytes,
  keccak256,
  parseAbi,
  stringToHex,
  zeroAddress,
} from "viem";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_ASSET_HUB_RPC = "wss://asset-hub-paseo-rpc.n.dwellir.com/";
const DEFAULT_STATE_FILE = ".dotns/domain-purchase-state.json";
const DEVNET_ASSET_HUB_GENESIS =
  "0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2";
const DOT_NODE =
  "0x3fce7d1364a893e213bc4212792b517ffc88f5b13b86c8ef9c8d390c3a1370ce";
const DOTNS_REGISTRAR = "0x7f0dF075cc8B7FE7218E90fFC5a553450dB120F3";
const DOTNS_REGISTRAR_CONTROLLER = "0x45fDEa4Ad7b8607Fc22DBC3DBE3cD8b350F8bede";
const DOTNS_RULES = "0x2181a14081fF2D4477BAA8FB1aEB4C9c44F5F2b0";
const NATIVE_TOKEN_DECIMALS = 10;
const EVM_TOKEN_DECIMALS = 18;
const MINIMUM_STORAGE_DEPOSIT_LIMIT = 2_000_000_000_000n;
const DRY_RUN_STORAGE_LIMIT = 18_446_744_073_709_551_615n;
const DRY_RUN_WEIGHT_LIMIT = {
  ref_time: 18_446_744_073_709_551_615n,
  proof_size: 18_446_744_073_709_551_615n,
};
const STATE_VERSION = 1;

const REGISTRAR_CONTROLLER_ABI = parseAbi([
  "function makeCommitment((string label, address owner, bytes32 secret, bool reserved) registration) view returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function commitments(bytes32 commitment) view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function maxCommitmentAge() view returns (uint256)",
  "function register((string label, address owner, bytes32 secret, bool reserved) registration) payable",
]);

const REGISTRAR_ABI = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

const RULES_ABI = parseAbi([
  "function priceWithCheck(string name, address userAddress) view returns ((uint256 price, uint8 status, uint8 userStatus, string message) metadata)",
]);

loadEnvironment({ path: resolve(REPOSITORY_ROOT, ".env") });

function printUsage(exitCode = 0) {
  console.log(`Usage:
  pnpm run purchase:dotns -- <label-or-label.dot> [--submit]
  pnpm run purchase:dotns -- <label-or-label.dot> --reset

Uses DotNS on PCF Devnet Asset Hub. A normal invocation is read-only and
prints mapping status, availability, and a registration price estimate.

Required environment:
  BULLETIN_UPLOAD_ACCOUNT_FILE='<password-protected Polkadot.js account JSON export>'

Optional environment:
  DOTNS_ASSET_HUB_RPC='${DEFAULT_ASSET_HUB_RPC}'
  DOTNS_PURCHASE_STATE_FILE='${DEFAULT_STATE_FILE}'

--submit unlocks the account in the terminal, maps it when necessary, commits,
waits for the chain's minimum commitment age, and registers the domain.
The local state file preserves the commitment secret so a later --submit can
resume after an interruption. --reset only deletes a matching local state file.`);
  process.exit(exitCode);
}

function parseArguments(args) {
  if (args.includes("--help") || args.includes("-h")) printUsage();

  let domain;
  let reset = false;
  let submit = false;

  for (const arg of args) {
    if (arg === "--") continue;
    if (arg === "--submit") {
      submit = true;
    } else if (arg === "--reset") {
      reset = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (domain) {
      throw new Error("Provide exactly one domain label");
    } else {
      domain = arg;
    }
  }

  if (!domain) {
    printUsage(1);
  }
  if (reset && submit) {
    throw new Error("Use --reset by itself; it never submits a transaction");
  }

  return { domain, reset, submit };
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
      `Account JSON ${path} uses ${keyPair.type}; DotNS purchases require an sr25519 account export`,
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

function stringify(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

async function readState(path) {
  try {
    const state = JSON.parse(await readFile(path, "utf8"));
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error("expected a JSON object");
    }
    if (state.version !== STATE_VERSION) {
      throw new Error("unsupported state format");
    }
    return state;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read DotNS purchase state ${path}: ${message}`);
  }
}

async function writeState(path, state) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${stringify(state)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

function validateState(state, { label, owner, signerAddress, genesisHash }) {
  const registration = state.registration;
  const validStage = ["prepared", "committed", "registered"].includes(
    state.stage,
  );

  if (
    !registration ||
    typeof registration !== "object" ||
    registration.label !== label ||
    !sameEvmAddress(registration.owner, owner) ||
    registration.reserved !== false ||
    typeof registration.secret !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(registration.secret) ||
    typeof state.commitment !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(state.commitment) ||
    !validStage ||
    !sameAccount(state.account, signerAddress) ||
    state.genesisHash?.toLowerCase() !== genesisHash.toLowerCase()
  ) {
    throw new Error(
      `The local state file does not match ${label}.dot and this account. Use --reset only when you intend to discard its commitment.`,
    );
  }
}

function sameEvmAddress(first, second) {
  try {
    return getAddress(first) === getAddress(second);
  } catch {
    return false;
  }
}

function randomSecret() {
  return `0x${randomBytes(32).toString("hex")}`;
}

function computeDomainTokenId(label) {
  const labelHash = keccak256(stringToHex(label));
  return BigInt(keccak256(concatHex([DOT_NODE, labelHash])));
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
  const encodedData = encodeFunctionData({
    abi,
    functionName,
    args,
  });
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

async function submitExtrinsic(transaction, signer, operation) {
  const result = await transaction.signAndSubmit(signer);

  if (!result.ok || !result.block) {
    throw new Error(`${operation} dispatch failed: ${stringify(result)}`);
  }

  return {
    blockNumber: Number(result.block.number),
    txHash: result.txHash,
  };
}

async function submitContractCall(
  api,
  origin,
  signer,
  address,
  value,
  abi,
  functionName,
  args,
  operation,
) {
  const encodedData = encodeFunctionData({
    abi,
    functionName,
    args,
  });
  const estimate = await dryRunContractCall(
    api,
    origin,
    address,
    value,
    encodedData,
  );
  extractReturnData(estimate, operation, { requireData: false });
  const weightLimit = estimate.weight_required ?? estimate.weight_consumed;

  if (!weightLimit) {
    throw new Error(`${operation} did not return a gas estimate`);
  }

  const transaction = api.tx.Revive.call({
    dest: Binary.fromHex(address),
    value,
    weight_limit: weightLimit,
    storage_deposit_limit: storageDepositLimit(estimate),
    data: Binary.fromHex(encodedData),
  });
  return submitExtrinsic(transaction, signer, operation);
}

async function ensureAccountMapped({
  api,
  client,
  evmAddress,
  getSigner,
  publicKey,
}) {
  let mapping = await readAccountMapping(client, evmAddress, publicKey);
  if (mapping.mapped) return mapping;

  if (mapping.mappedAccount) {
    throw new Error(
      `EVM address ${evmAddress} is already mapped to a different account: ${mapping.mappedAccount}`,
    );
  }

  console.log("Submitting Revive.map_account()...");
  try {
    await submitExtrinsic(
      api.tx.Revive.map_account(),
      await getSigner(),
      "Account mapping",
    );
  } catch (error) {
    mapping = await readAccountMapping(client, evmAddress, publicKey);
    if (mapping.mapped) return mapping;
    throw error;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    mapping = await readAccountMapping(client, evmAddress, publicKey);
    if (mapping.mapped) return mapping;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    "Account mapping transaction completed but mapping is not visible",
  );
}

async function readDomainOwner(api, origin, label) {
  try {
    return await readContract(
      api,
      origin,
      DOTNS_REGISTRAR,
      REGISTRAR_ABI,
      "ownerOf",
      [computeDomainTokenId(label)],
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("ownerOf contract call reverted")
    ) {
      return zeroAddress;
    }
    throw error;
  }
}

function statusName(status) {
  if (status === 0) return "none";
  if (status === 1) return "personhood-lite";
  if (status === 2) return "personhood-full";
  if (status === 3) return "reserved";
  return `unknown-${status}`;
}

function canRegister(status, userStatus) {
  if (status === 0) return true;
  if (status === 1) return userStatus === 1 || userStatus === 2;
  if (status === 2) return userStatus === 2;
  return false;
}

function convertWeiToNativeCeil(wei) {
  const ratio = 10n ** BigInt(EVM_TOKEN_DECIMALS - NATIVE_TOKEN_DECIMALS);
  return (wei + ratio - 1n) / ratio;
}

async function quoteDomain(api, origin, label, owner) {
  const currentOwner = await readDomainOwner(api, origin, label);
  if (!sameEvmAddress(currentOwner, zeroAddress)) {
    throw new Error(`${label}.dot is already registered to ${currentOwner}`);
  }

  const metadata = await readContract(
    api,
    origin,
    DOTNS_RULES,
    RULES_ABI,
    "priceWithCheck",
    [label, owner],
  );
  const priceWei = BigInt(metadata.price);
  const status = Number(metadata.status);
  const userStatus = Number(metadata.userStatus);
  const paymentPlancks = convertWeiToNativeCeil(priceWei);
  const accountInfo = await api.query.System.Account.getValue(origin);
  const freePlancks = BigInt(accountInfo.data.free);

  return {
    freePas: formatUnits(freePlancks, NATIVE_TOKEN_DECIMALS),
    freePlancks,
    message: metadata.message,
    paymentPas: formatUnits(paymentPlancks, NATIVE_TOKEN_DECIMALS),
    paymentPlancks,
    pricePas: formatUnits(priceWei, EVM_TOKEN_DECIMALS),
    priceWei,
    requiredStatus: statusName(status),
    status,
    sufficientForRegistrationValue: freePlancks >= paymentPlancks,
    userStatus: statusName(userStatus),
    userStatusCode: userStatus,
    eligible: canRegister(status, userStatus),
  };
}

async function readCommitmentTimestamp(api, origin, commitment) {
  return Number(
    await readContract(
      api,
      origin,
      DOTNS_REGISTRAR_CONTROLLER,
      REGISTRAR_CONTROLLER_ABI,
      "commitments",
      [commitment],
    ),
  );
}

async function readCommitmentTiming(api, origin, commitment) {
  const [minimumAge, maximumAge, committedAt, timestamp] = await Promise.all([
    readContract(
      api,
      origin,
      DOTNS_REGISTRAR_CONTROLLER,
      REGISTRAR_CONTROLLER_ABI,
      "minCommitmentAge",
      [],
    ),
    readContract(
      api,
      origin,
      DOTNS_REGISTRAR_CONTROLLER,
      REGISTRAR_CONTROLLER_ABI,
      "maxCommitmentAge",
      [],
    ),
    readCommitmentTimestamp(api, origin, commitment),
    api.query.Timestamp.Now.getValue(),
  ]);

  return {
    committedAt: Number(committedAt),
    maximumAge: Number(maximumAge),
    minimumAge: Number(minimumAge),
    now: Math.floor(Number(timestamp) / 1_000),
  };
}

async function waitForCommitmentMaturity(api, origin, commitment) {
  let announcedWait = false;

  while (true) {
    const timing = await readCommitmentTiming(api, origin, commitment);
    if (timing.committedAt === 0) {
      throw new Error("Commitment was not found on-chain");
    }

    const age = timing.now - timing.committedAt;
    if (age > timing.maximumAge) {
      throw new Error(
        `Commitment expired after ${timing.maximumAge} seconds. Use --reset to discard it before starting again.`,
      );
    }
    if (age >= timing.minimumAge) {
      return { ...timing, age };
    }

    if (!announcedWait) {
      const remaining = timing.minimumAge - age;
      console.log(
        `Commitment is ${age} seconds old; waiting about ${remaining} seconds before registration...`,
      );
      announcedWait = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

async function resetState(path, label) {
  const state = await readState(path);
  if (!state) {
    console.log("No local DotNS purchase state exists.");
    return;
  }
  if (state.registration?.label !== label) {
    throw new Error(
      `The local state belongs to ${state.registration?.label ?? "another domain"}. It was not deleted.`,
    );
  }

  await unlink(path);
  console.log(`Deleted local DotNS purchase state for ${label}.dot.`);
}

async function main() {
  const { domain, reset, submit } = parseArguments(process.argv.slice(2));
  const label = normaliseLabel(domain);
  validateDomainLabel(label);
  const stateFile = resolve(
    REPOSITORY_ROOT,
    process.env.DOTNS_PURCHASE_STATE_FILE ?? DEFAULT_STATE_FILE,
  );

  if (reset) {
    await resetState(stateFile, label);
    return;
  }

  const accountFile = resolve(
    REPOSITORY_ROOT,
    requireEnvironment("BULLETIN_UPLOAD_ACCOUNT_FILE"),
  );
  const rpc = process.env.DOTNS_ASSET_HUB_RPC ?? DEFAULT_ASSET_HUB_RPC;

  await cryptoWaitReady();
  const { keyPair, signerAddress } = await loadExportedAccount(accountFile);
  const evmAddress = accountToEvmAddress(keyPair.publicKey);
  const client = createClient(getTransactionWsProvider(rpc));
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

    let state = await readState(stateFile);
    if (state) {
      validateState(state, {
        genesisHash,
        label,
        owner: evmAddress,
        signerAddress,
      });
    }

    let mapping = await readAccountMapping(
      client,
      evmAddress,
      keyPair.publicKey,
    );
    if (!mapping.mapped && mapping.mappedAccount) {
      throw new Error(
        `EVM address ${evmAddress} is already mapped to a different account: ${mapping.mappedAccount}`,
      );
    }

    if (!mapping.mapped && !submit) {
      console.log(
        stringify({
          action: "dry run",
          account: signerAddress,
          domain: `${label}.dot`,
          evmAddress,
          mapping: {
            mapped: false,
            storageKey: mapping.storageKey,
          },
          price: null,
        }),
      );
      console.log(
        "Dry run complete. Re-run with --submit to map the account before obtaining a contract price quote.",
      );
      return;
    }

    if (!mapping.mapped) {
      mapping = await ensureAccountMapped({
        api,
        client,
        evmAddress,
        getSigner,
        publicKey: keyPair.publicKey,
      });
    }

    if (state?.stage === "registered") {
      const owner = await readDomainOwner(api, signerAddress, label);
      if (!sameEvmAddress(owner, evmAddress)) {
        throw new Error(
          `The saved registration is not owned by ${evmAddress}; local state was retained for review.`,
        );
      }
      await unlink(stateFile);
      console.log(
        stringify({
          domain: `${label}.dot`,
          owner,
          registered: true,
          txHash: state.registerTxHash,
        }),
      );
      return;
    }

    const quote = await quoteDomain(api, signerAddress, label, evmAddress);
    let registration;
    let commitment;

    if (state) {
      registration = state.registration;
      commitment = state.commitment;
    } else {
      registration = {
        label,
        owner: evmAddress,
        reserved: false,
        secret: randomSecret(),
      };
      commitment = await readContract(
        api,
        signerAddress,
        DOTNS_REGISTRAR_CONTROLLER,
        REGISTRAR_CONTROLLER_ABI,
        "makeCommitment",
        [registration],
      );
    }

    const existingTiming = state
      ? await readCommitmentTiming(api, signerAddress, commitment)
      : null;
    const purchasePlan = {
      action: submit ? "purchase domain" : "dry run",
      account: signerAddress,
      commitment,
      commitmentTiming: existingTiming,
      domain: `${label}.dot`,
      evmAddress,
      mapping: {
        mapped: mapping.mapped,
        mappedAccount: mapping.mappedAccount,
      },
      price: {
        accountFreePas: quote.freePas,
        accountFreePlancks: quote.freePlancks,
        eligible: quote.eligible,
        message: quote.message,
        paymentPas: quote.paymentPas,
        paymentPlancks: quote.paymentPlancks,
        pricePas: quote.pricePas,
        priceWei: quote.priceWei,
        requiredStatus: quote.requiredStatus,
        sufficientForRegistrationValue: quote.sufficientForRegistrationValue,
        userStatus: quote.userStatus,
      },
      stateFile,
    };
    console.log(stringify(purchasePlan));

    if (!quote.eligible) {
      throw new Error(`Domain cannot be registered: ${quote.message}`);
    }
    if (!quote.sufficientForRegistrationValue) {
      throw new Error(
        `Insufficient balance for registration value: need ${quote.paymentPas} PAS plus transaction fees`,
      );
    }
    if (!submit) {
      console.log("Dry run complete. Re-run with --submit to purchase.");
      return;
    }

    if (!state) {
      state = {
        account: signerAddress,
        commitment,
        genesisHash,
        registration,
        rpc,
        stage: "prepared",
        version: STATE_VERSION,
      };
      await writeState(stateFile, state);
      console.log("Saved local commitment state before submission.");
    }

    let timing = await readCommitmentTiming(api, signerAddress, commitment);
    if (timing.committedAt === 0) {
      console.log("Submitting DotNS commitment...");
      const receipt = await submitContractCall(
        api,
        signerAddress,
        await getSigner(),
        DOTNS_REGISTRAR_CONTROLLER,
        0n,
        REGISTRAR_CONTROLLER_ABI,
        "commit",
        [commitment],
        "DotNS commitment",
      );
      state = {
        ...state,
        commitBlockNumber: receipt.blockNumber,
        commitTxHash: receipt.txHash,
        stage: "committed",
      };
      await writeState(stateFile, state);
      timing = await readCommitmentTiming(api, signerAddress, commitment);
    } else if (state.stage === "prepared") {
      state = { ...state, stage: "committed" };
      await writeState(stateFile, state);
    }

    if (timing.committedAt === 0) {
      throw new Error(
        "Commitment transaction completed but the commitment is not yet visible. Re-run with --submit to resume.",
      );
    }
    if (timing.now - timing.committedAt > timing.maximumAge) {
      throw new Error(
        `Commitment expired after ${timing.maximumAge} seconds. Use --reset to discard it before starting again.`,
      );
    }

    await waitForCommitmentMaturity(api, signerAddress, commitment);
    const refreshedQuote = await quoteDomain(
      api,
      signerAddress,
      label,
      evmAddress,
    );
    console.log(
      stringify({
        action: "registration price refreshed",
        domain: `${label}.dot`,
        price: {
          eligible: refreshedQuote.eligible,
          message: refreshedQuote.message,
          paymentPas: refreshedQuote.paymentPas,
          paymentPlancks: refreshedQuote.paymentPlancks,
          pricePas: refreshedQuote.pricePas,
          priceWei: refreshedQuote.priceWei,
          requiredStatus: refreshedQuote.requiredStatus,
          sufficientForRegistrationValue:
            refreshedQuote.sufficientForRegistrationValue,
          userStatus: refreshedQuote.userStatus,
        },
      }),
    );

    if (!refreshedQuote.eligible) {
      throw new Error(
        `Domain can no longer be registered: ${refreshedQuote.message}`,
      );
    }
    if (!refreshedQuote.sufficientForRegistrationValue) {
      throw new Error(
        `Insufficient balance for registration value: need ${refreshedQuote.paymentPas} PAS plus transaction fees`,
      );
    }

    console.log("Submitting DotNS registration...");
    const receipt = await submitContractCall(
      api,
      signerAddress,
      await getSigner(),
      DOTNS_REGISTRAR_CONTROLLER,
      refreshedQuote.paymentPlancks,
      REGISTRAR_CONTROLLER_ABI,
      "register",
      [registration],
      "DotNS registration",
    );
    state = {
      ...state,
      registerBlockNumber: receipt.blockNumber,
      registerTxHash: receipt.txHash,
      stage: "registered",
    };
    await writeState(stateFile, state);

    const owner = await readDomainOwner(api, signerAddress, label);
    if (!sameEvmAddress(owner, evmAddress)) {
      throw new Error(
        `Registration was submitted but ${label}.dot is not owned by ${evmAddress}. Local state was retained for review.`,
      );
    }

    await unlink(stateFile);
    console.log(
      stringify({
        domain: `${label}.dot`,
        owner,
        registered: true,
        txHash: receipt.txHash,
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
