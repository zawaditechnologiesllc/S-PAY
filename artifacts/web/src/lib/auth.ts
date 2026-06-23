import { useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { clearAppCache } from "@/lib/query-client";

const TOKEN_KEY = "spay_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  // Drop the persisted query cache too, so the next user never sees the previous
  // user's balance/history from local storage.
  clearAppCache();
}

// Initialize the API client with the auth token
setAuthTokenGetter(() => getToken());
