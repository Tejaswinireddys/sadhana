import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { peekDeviceId, peekDeviceProof, syncDeviceId } from "./deviceId";
import { notifyApiOk } from "@/components/ConnectivityBanner";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const DEVICE_ECHO_HEADER = "X-Device-Id";
const DEVICE_PROOF_ECHO_HEADER = "X-Device-Proof";

/**
 * Send the device id only when we actually have one. If localStorage was
 * evicted we stay silent so the server can recover our identity from its
 * `sadhana_device` cookie — minting a fresh id here would orphan the data.
 * When a proof is present, send it so cookie-less recovery cannot be forged
 * from a bare UUID alone.
 */
function deviceHeaders(extra?: HeadersInit): HeadersInit {
  const id = peekDeviceId();
  const proof = peekDeviceProof();
  return {
    ...(id ? { [DEVICE_ECHO_HEADER]: id } : {}),
    ...(id && proof ? { [DEVICE_PROOF_ECHO_HEADER]: proof } : {}),
    ...(extra ?? {}),
  };
}

/** Mirror the server-resolved identity back into localStorage. */
function adoptDeviceId(res: Response): Response {
  syncDeviceId(res.headers.get(DEVICE_ECHO_HEADER), res.headers.get(DEVICE_PROOF_ECHO_HEADER));
  if (res.ok) notifyApiOk();
  return res;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  opts?: { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = adoptDeviceId(
      await fetch(`${API_BASE}${url}`, {
        method,
        headers: deviceHeaders(data ? { "Content-Type": "application/json" } : undefined),
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
        signal: ctrl.signal,
      }),
    );

    await throwIfResNotOk(res);
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = adoptDeviceId(
      await fetch(`${API_BASE}${queryKey.join("/")}`, {
        headers: deviceHeaders(),
        credentials: "include",
      }),
    );

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
