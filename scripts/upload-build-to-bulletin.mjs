#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { CarWriter } from "@ipld/car";
import * as dagPb from "@ipld/dag-pb";
import { calculateCid } from "@parity/product-sdk";
import { Keyring } from "@polkadot/keyring";
import {
  cryptoWaitReady,
  decodeAddress,
  encodeAddress,
} from "@polkadot/util-crypto";
import { config as loadEnvironment } from "dotenv";
import { UnixFS } from "ipfs-unixfs";
import { importer } from "ipfs-unixfs-importer";
import { createClient, Enum } from "polkadot-api";
import { getPolkadotSigner } from "polkadot-api/signer";
import { getWsProvider } from "polkadot-api/ws";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_BULLETIN_RPC = "wss://bulletin-paseo.tservices.es:8443";
const DEFAULT_BUILD_DIRECTORY = "dist";
const DEFAULT_STATE_FILE = ".bulletin/build-upload-state.json";
const MAX_BULLETIN_CHUNK_BYTES = 2 * 1024 * 1024;
const RAW_CODEC = 0x55;
const DAG_PB_CODEC = 0x70;
const STATE_VERSION = 2;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

loadEnvironment({ path: resolve(REPOSITORY_ROOT, ".env") });

function printUsage(exitCode = 0) {
  console.log(`Usage:
  pnpm run upload:bulletin -- [--submit] [--force]

Uploads the files under dist/ to Bulletin devnet and stores a CID manifest.

Required environment:
  ACCOUNT_FILE='<password-protected account JSON export>'

Optional environment:
  BULLETIN_RPC='${DEFAULT_BULLETIN_RPC}'
  BULLETIN_BUILD_DIRECTORY='${DEFAULT_BUILD_DIRECTORY}'
  BULLETIN_UPLOAD_STATE_FILE='${DEFAULT_STATE_FILE}'

Without --submit, the command only checks the upload plan and account allowance.
--force bypasses the local CID checkpoint and uploads every artifact again.

The command prints the CAR storage CID for the site content.`);
  process.exit(exitCode);
}

function parseArguments(args) {
  if (args.includes("--help") || args.includes("-h")) printUsage();

  let submit = false;
  let force = false;

  for (const arg of args) {
    if (arg === "--") continue;
    if (arg === "--submit") {
      submit = true;
    } else if (arg === "--force") {
      force = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { force, submit };
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in the environment or .env`);
  return value;
}

function resolveEnvironmentPath(name) {
  return resolve(REPOSITORY_ROOT, requireEnvironment(name));
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
    "ACCOUNT_FILE address",
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
      `Account JSON ${path} uses ${keyPair.type}; Bulletin uploads require an sr25519 account export`,
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
      "An interactive terminal is required to unlock ACCOUNT_FILE",
    );
  }

  const reader = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 0,
  });
  reader._writeToOutput = () => {};
  process.stdout.write("Bulletin account password: ");

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

function relativePath(path) {
  return path.split(sep).join("/");
}

function contentType(path) {
  return (
    CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream"
  );
}

function stringify(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

async function collectArtifacts(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries.sort((first, second) =>
    first.name.localeCompare(second.name),
  )) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      artifacts.push(...(await collectArtifacts(entryPath, root)));
      continue;
    }

    if (!entry.isFile()) {
      throw new Error(
        `Unsupported build entry: ${relativePath(relative(root, entryPath))}`,
      );
    }

    const data = new Uint8Array(await readFile(entryPath));
    const path = relativePath(relative(root, entryPath));

    if (data.length === 0) {
      throw new Error(`Cannot upload an empty artifact: ${path}`);
    }
    artifacts.push({
      path,
      bytes: data.length,
      cid: (await calculateCid(data)).toString(),
      contentType: contentType(path),
      data,
    });
  }

  return artifacts;
}

function createArtifactManifest(artifacts) {
  return {
    format: "subsquare-bulletin-build/v2",
    files: artifacts.map(({ path, bytes, cid, contentType: type }) => ({
      path,
      bytes,
      cid,
      contentType: type,
    })),
  };
}

class CidPreservingBlockstore {
  blocks = new Map();

  async put(cid, bytes) {
    this.blocks.set(cid.toString(), { cid, bytes });
    return cid;
  }

  *all() {
    yield* this.blocks.values();
  }
}

function chunkData(data, size = MAX_BULLETIN_CHUNK_BYTES) {
  const chunks = [];

  for (let offset = 0; offset < data.length; offset += size) {
    chunks.push(data.subarray(offset, Math.min(offset + size, data.length)));
  }

  return chunks;
}

async function collectBytes(source) {
  const parts = [];
  let length = 0;

  for await (const part of source) {
    parts.push(part);
    length += part.length;
  }

  const data = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    data.set(part, offset);
    offset += part.length;
  }

  return data;
}

function asAsyncContent(data) {
  return (async function* () {
    yield data;
  })();
}

async function createSiteCar(artifacts) {
  const blockstore = new CidPreservingBlockstore();
  const source = artifacts.map(({ path, data }) => ({
    path,
    content: asAsyncContent(data),
  }));
  let ipfsCid;

  for await (const entry of importer(source, blockstore, {
    cidVersion: 1,
    rawLeaves: true,
    wrapWithDirectory: true,
  })) {
    ipfsCid = entry.cid;
  }

  if (!ipfsCid) {
    throw new Error("CAR generation produced no IPFS root CID");
  }

  const { writer, out } = CarWriter.create([ipfsCid]);
  const carDataPromise = collectBytes(out);

  for (const block of blockstore.all()) {
    await writer.put(block);
  }
  await writer.close();

  return { carData: await carDataPromise };
}

async function createBulletinContent(artifacts) {
  const { carData } = await createSiteCar(artifacts);
  const storageArtifacts = await Promise.all(
    chunkData(carData).map(async (data, index) => {
      const cidValue = await calculateCid(data);

      return {
        path: `bulletin/car/${String(index).padStart(6, "0")}`,
        bytes: data.length,
        cid: cidValue.toString(),
        cidValue,
        codec: RAW_CODEC,
        contentType: "application/vnd.ipld.car",
        data,
      };
    }),
  );
  const unixFs = new UnixFS({
    type: "file",
    blockSizes: storageArtifacts.map((artifact) => BigInt(artifact.bytes)),
  });
  const rootData = dagPb.encode(
    dagPb.prepare({
      Data: unixFs.marshal(),
      Links: storageArtifacts.map((artifact) => ({
        Name: "",
        Tsize: artifact.bytes,
        Hash: artifact.cidValue,
      })),
    }),
  );

  if (rootData.length > MAX_BULLETIN_CHUNK_BYTES) {
    throw new Error(
      `CAR storage root exceeds the ${MAX_BULLETIN_CHUNK_BYTES}-byte Bulletin chunk limit`,
    );
  }

  const rootCidValue = await calculateCid(rootData, DAG_PB_CODEC);

  return {
    carBytes: carData.length,
    artifacts: storageArtifacts,
    root: {
      path: "bulletin/car/root",
      bytes: rootData.length,
      cid: rootCidValue.toString(),
      cidValue: rootCidValue,
      codec: DAG_PB_CODEC,
      contentType: "application/vnd.ipld.dag-pb",
      data: rootData,
    },
  };
}

async function readState(path) {
  try {
    const state = JSON.parse(await readFile(path, "utf8"));
    if (state.version === 1) return null;
    if (state.version !== STATE_VERSION || !Array.isArray(state.artifacts)) {
      throw new Error("unsupported state format");
    }
    return state;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read upload state ${path}: ${message}`);
  }
}

async function writeState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporaryPath, path);
}

function isRetained(record, cid, currentBlock, retentionPeriod) {
  return (
    record?.cid === cid &&
    Number.isSafeInteger(record.blockNumber) &&
    currentBlock < record.blockNumber + retentionPeriod
  );
}

function authorizationStatus(authorization, currentBlock) {
  const transactionsAllowance = Number(
    authorization?.extent?.transactions_allowance ?? 0,
  );
  const transactionsUsed = Number(authorization?.extent?.transactions ?? 0);
  const bytesAllowance = BigInt(authorization?.extent?.bytes_allowance ?? 0);
  const bytesUsed = BigInt(authorization?.extent?.bytes ?? 0);
  const expiration = Number(authorization?.expiration ?? 0);
  const remainingTransactions = transactionsAllowance - transactionsUsed;
  const remainingBytes = bytesAllowance - bytesUsed;

  return {
    expiration,
    remainingBytes,
    remainingTransactions,
    usable:
      Boolean(authorization) &&
      currentBlock < expiration &&
      remainingTransactions > 0 &&
      remainingBytes > 0n,
  };
}

async function storeArtifact(api, signer, artifact) {
  const tx = api.tx.TransactionStorage.store_with_cid_config({
    cid: { codec: BigInt(artifact.codec), hashing: Enum("Blake2b256") },
    data: artifact.data,
  });
  const result = await tx.signAndSubmit(signer);

  if (!result.ok || !result.block) {
    throw new Error(`Upload dispatch failed: ${stringify(result)}`);
  }

  return {
    blockNumber: Number(result.block.number),
    txHash: result.txHash,
  };
}

function checkpoint({ artifacts, content, genesisHash, retentionPeriod, rpc }) {
  return {
    version: STATE_VERSION,
    bulletin: { genesisHash, retentionPeriod, rpc },
    artifacts: [...artifacts.values()].sort((first, second) =>
      first.path.localeCompare(second.path),
    ),
    content,
  };
}

function stateArtifact(artifact, receipt) {
  return {
    path: artifact.path,
    bytes: artifact.bytes,
    cid: artifact.cid,
    codec: artifact.codec,
    contentType: artifact.contentType,
    ...receipt,
  };
}

async function main() {
  const { force, submit } = parseArguments(process.argv.slice(2));
  const accountFile = resolveEnvironmentPath("ACCOUNT_FILE");
  const rpc = process.env.BULLETIN_RPC ?? DEFAULT_BULLETIN_RPC;
  const buildDirectory = resolve(
    REPOSITORY_ROOT,
    process.env.BULLETIN_BUILD_DIRECTORY ?? DEFAULT_BUILD_DIRECTORY,
  );
  const stateFile = resolve(
    REPOSITORY_ROOT,
    process.env.BULLETIN_UPLOAD_STATE_FILE ?? DEFAULT_STATE_FILE,
  );

  await cryptoWaitReady();

  const { keyPair, signerAddress } = await loadExportedAccount(accountFile);

  const sourceArtifacts = await collectArtifacts(buildDirectory);
  if (sourceArtifacts.length === 0) {
    throw new Error(`No files found in build directory: ${buildDirectory}`);
  }

  const manifestData = new TextEncoder().encode(
    `${JSON.stringify(createArtifactManifest(sourceArtifacts), null, 2)}\n`,
  );
  const manifest = {
    path: "subsquare-bulletin-build.json",
    bytes: manifestData.length,
    cid: (await calculateCid(manifestData)).toString(),
    contentType: "application/json",
    data: manifestData,
  };
  const content = await createBulletinContent([...sourceArtifacts, manifest]);

  const client = createClient(getWsProvider(rpc));

  try {
    const api = client.getUnsafeApi();
    const [
      currentBlockValue,
      genesisHash,
      retentionPeriodValue,
      authorization,
    ] = await Promise.all([
      api.query.System.Number.getValue(),
      api.query.System.BlockHash.getValue(0),
      api.query.TransactionStorage.RetentionPeriod.getValue(),
      api.query.TransactionStorage.Authorizations.getValue(
        Enum("Account", signerAddress),
      ),
    ]);
    const currentBlock = Number(currentBlockValue);
    const retentionPeriod = Number(retentionPeriodValue);
    const previousState = await readState(stateFile);
    const matchesChain = previousState?.bulletin?.genesisHash === genesisHash;
    const cachedArtifacts = new Map(
      matchesChain
        ? previousState.artifacts.map((artifact) => [artifact.path, artifact])
        : [],
    );
    const availableArtifacts = new Map();
    const artifactsToUpload = content.artifacts.filter((artifact) => {
      const cached = cachedArtifacts.get(artifact.path);
      const available =
        !force &&
        isRetained(cached, artifact.cid, currentBlock, retentionPeriod);
      if (available) availableArtifacts.set(artifact.path, cached);
      return !available;
    });
    const cachedContent = matchesChain ? previousState.content : null;
    const contentAvailable =
      !force &&
      isRetained(
        cachedContent,
        content.root.cid,
        currentBlock,
        retentionPeriod,
      );
    const uploadPlan = [
      ...artifactsToUpload,
      ...(contentAvailable ? [] : [content.root]),
    ];
    const requiredBytes = uploadPlan.reduce(
      (total, artifact) => total + BigInt(artifact.bytes),
      0n,
    );
    const allowance = authorizationStatus(authorization, currentBlock);
    const allowanceSufficient =
      allowance.usable &&
      allowance.remainingTransactions >= uploadPlan.length &&
      allowance.remainingBytes >= requiredBytes;

    console.log(
      stringify({
        action: submit ? "upload build artifacts" : "dry run",
        rpc,
        genesisHash,
        currentBlock,
        retentionPeriod,
        uploader: signerAddress,
        buildDirectory: relativePath(relative(REPOSITORY_ROOT, buildDirectory)),
        stateFile: relativePath(relative(REPOSITORY_ROOT, stateFile)),
        contentCid: content.root.cid,
        artifacts: createArtifactManifest(sourceArtifacts).files,
        manifest: {
          path: manifest.path,
          bytes: manifest.bytes,
          cid: manifest.cid,
        },
        storage: {
          carBytes: content.carBytes,
          chunks: content.artifacts.map(({ path, bytes, cid }) => ({
            path,
            bytes,
            cid,
          })),
          root: {
            path: content.root.path,
            bytes: content.root.bytes,
            cid: content.root.cid,
          },
        },
        uploadPlan: {
          artifacts: uploadPlan.map((artifact) => artifact.path),
          bytes: requiredBytes,
          transactions: uploadPlan.length,
        },
        allowance: {
          ...allowance,
          sufficient: allowanceSufficient,
        },
      }),
    );

    if (!submit) {
      console.log(
        allowanceSufficient
          ? "Dry run complete. Re-run with --submit to upload."
          : "Dry run complete. The uploader needs a live Bulletin authorization with the listed allowance before submission.",
      );
      return;
    }

    if (uploadPlan.length === 0) {
      console.log(
        "The CAR content CID is still retained on Bulletin. Nothing to upload.",
      );
      return;
    }

    if (!allowanceSufficient) {
      throw new Error(
        `Insufficient Bulletin allowance: need ${uploadPlan.length} transactions and ${requiredBytes} bytes`,
      );
    }

    await unlockAccount(keyPair);

    try {
      const signer = getPolkadotSigner(
        keyPair.publicKey,
        "Sr25519",
        (payload) => keyPair.sign(payload),
      );
      let contentRecord = contentAvailable ? cachedContent : null;

      for (const artifact of artifactsToUpload) {
        console.log(`Uploading ${artifact.path} (${artifact.bytes} bytes)...`);
        const receipt = await storeArtifact(api, signer, artifact);
        availableArtifacts.set(artifact.path, {
          ...stateArtifact(artifact, receipt),
        });
        await writeState(
          stateFile,
          checkpoint({
            artifacts: availableArtifacts,
            content: contentRecord,
            genesisHash,
            retentionPeriod,
            rpc,
          }),
        );
        console.log(`Stored ${artifact.path}: ${artifact.cid}`);
      }

      if (!contentAvailable) {
        console.log(
          `Uploading ${content.root.path} (${content.root.bytes} bytes)...`,
        );
        const receipt = await storeArtifact(api, signer, content.root);
        contentRecord = stateArtifact(content.root, receipt);
        await writeState(
          stateFile,
          checkpoint({
            artifacts: availableArtifacts,
            content: contentRecord,
            genesisHash,
            retentionPeriod,
            rpc,
          }),
        );
        console.log(`Stored ${content.root.path}: ${content.root.cid}`);
      }

      console.log(
        stringify({
          uploaded: artifactsToUpload.map(({ path, cid }) => ({ path, cid })),
          contentCid: contentRecord?.cid,
        }),
      );
    } finally {
      keyPair.lock();
    }
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
