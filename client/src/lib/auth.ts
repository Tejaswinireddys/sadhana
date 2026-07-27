/**
 * Optional accounts. Signing in switches which owner the API reads and writes,
 * so every cached query belongs to the previous owner and must be dropped.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import { KEYS, writeString } from "./localPrefs";
import type { PublicUser } from "@shared/schema";

export type AuthState = {
  user: PublicUser | null;
  /** Rows still owned by this browser's guest identity while signed in. */
  deviceRows: number;
};

export const AUTH_QUERY_KEY = ["/api/auth/me"];

export function useAuth() {
  const { data, isLoading } = useQuery<AuthState>({
    queryKey: AUTH_QUERY_KEY,
    // Auth is cheap and changes rarely, but it must be fresh after sign in/out.
    staleTime: 30_000,
  });
  return {
    user: data?.user ?? null,
    deviceRows: data?.deviceRows ?? 0,
    isSignedIn: !!data?.user,
    isLoading,
  };
}

/**
 * Practice data differs per owner, so every cached query has to be re-fetched.
 * `resetQueries` (not `clear`) keeps mounted observers attached — clearing the
 * cache orphans them, so components that don't re-render keep the old owner's
 * data on screen.
 */
async function resetOwnedCaches() {
  await queryClient.resetQueries();
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string; displayName?: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", input);
      return (await res.json()) as { user: PublicUser; claimed: number };
    },
    onSuccess: async ({ user }) => {
      if (user.displayName) writeString(KEYS.practitionerName, user.displayName);
      await resetOwnedCaches();
      qc.setQueryData(AUTH_QUERY_KEY, { user, deviceRows: 0 } satisfies AuthState);
    },
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", input);
      return (await res.json()) as { user: PublicUser; deviceRows: number };
    },
    onSuccess: async ({ user, deviceRows }) => {
      if (user.displayName) writeString(KEYS.practitionerName, user.displayName);
      await resetOwnedCaches();
      qc.setQueryData(AUTH_QUERY_KEY, { user, deviceRows } satisfies AuthState);
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: resetOwnedCaches,
  });
}

/** Move practice recorded on this device before signing in into the account. */
export function useClaimDevice() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/claim-device");
      return (await res.json()) as { claimed: number };
    },
    onSuccess: resetOwnedCaches,
  });
}

/** Server errors arrive as `409: {"error":"…"}` — surface just the message. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  const match = raw.match(/\{.*\}$/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      // fall through to the generic message
    }
  }
  return fallback;
}
