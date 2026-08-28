/**
 * Identity fetching ported from subsquare's next-common/services/identity:
 * batch POST to the statescan short-ids endpoint with caching,
 * so N addresses on a page resolve in a single request.
 */
export interface IdentityInfo {
  address: string;
  info?: {
    display?: string;
    displayParent?: string;
    legal?: string;
    web?: string;
    email?: string;
    riot?: string;
    twitter?: string;
    image?: string;
    status?:
      | "NO_ID"
      | "NOT_VERIFIED"
      | "VERIFIED"
      | "ERRONEOUS"
      | "VERIFIED_LINKED"
      | "LINKED"
      | "ERRONEOUS_LINKED";
    tooltip?: string;
    isBountyIdentity?: boolean;
    [key: string]: unknown;
  };
}

type PendingRequest = {
  address: string;
  resolve: (identity: IdentityInfo | null) => void;
};

const cache = new Map<string, Promise<IdentityInfo | null>>();
let pending: PendingRequest[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (pending.length === 0) return;

  const batch = pending;
  pending = [];
  const addresses = batch.map((req) => req.address);

  fetch("https://id.statescan.io/polkadot/short-ids", {
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json;charset=UTF-8",
    },
    method: "POST",
    body: JSON.stringify({ addresses }),
  })
    .then((res) => res.json())
    .then((data: IdentityInfo[]) => {
      const identities = new Map(
        data.map((item) => [item.address, item] as const),
      );
      for (const req of batch) {
        req.resolve(identities.get(req.address) ?? null);
      }
    })
    .catch(() => {
      for (const req of batch) req.resolve(null);
    });
}

export function fetchIdentity(address: string): Promise<IdentityInfo | null> {
  if (!address) return Promise.resolve(null);

  const cached = cache.get(address);
  if (cached) return cached;

  const promise = new Promise<IdentityInfo | null>((resolve) => {
    pending.push({ address, resolve });
    if (timer === null) {
      timer = setTimeout(flush, 0);
    }
  });

  cache.set(address, promise);
  return promise;
}
