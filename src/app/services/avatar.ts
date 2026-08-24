/**
 * Avatar fetching ported from subsquare's next-common/services/avatar:
 * batch POST to the backend /avatars endpoint with a short debounce and cache.
 */

import { API_BASE } from "../api/referenda";

export const AVATAR_PREVIEW_ENDPOINT = "https://static.subsquare.io";

type PendingRequest = {
  address: string;
  resolve: (avatarCid: string | null) => void;
};

const cache = new Map<string, Promise<string | null>>();
let pending: PendingRequest[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (pending.length === 0) return;

  const batch = pending;
  pending = [];
  const addresses = batch.map((req) => req.address);

  fetch(new URL("avatars", `${API_BASE}/`), {
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json;charset=UTF-8",
    },
    method: "POST",
    body: JSON.stringify({ addresses }),
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data: Array<{ address: string; avatarCid: string | null }>) => {
      const avatars = new Map(
        data.map((item) => [item.address, item.avatarCid] as const),
      );
      for (const req of batch) {
        req.resolve(avatars.get(req.address) ?? null);
      }
    })
    .catch(() => {
      for (const req of batch) req.resolve(null);
    });
}

export function fetchAvatar(address: string): Promise<string | null> {
  if (!address) return Promise.resolve(null);

  const cached = cache.get(address);
  if (cached) return cached;

  const promise = new Promise<string | null>((resolve) => {
    pending.push({ address, resolve });
    if (timer === null) {
      timer = setTimeout(flush, 500);
    }
  });

  cache.set(address, promise);
  return promise;
}

/** Same rule as subsquare's storage link: preview endpoint + cid. */
export function getStorageLink(avatarCid: string): string {
  return `${AVATAR_PREVIEW_ENDPOINT}/${avatarCid}`;
}
