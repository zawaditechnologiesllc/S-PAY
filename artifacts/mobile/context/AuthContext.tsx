import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "spay_token";

// The session token lives in the device keychain/Keystore (expo-secure-store):
// encrypted at rest and inaccessible to other apps or a filesystem backup —
// unlike AsyncStorage, which is a plaintext file. Older installs stored the
// token in AsyncStorage; on first read we migrate it across and wipe the
// plaintext copy. SecureStore is unavailable on web builds, so AsyncStorage
// remains the fallback there.

async function readToken(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(TOKEN_KEY);
    if (secure) return secure;
    // Migration: pre-SecureStore installs kept the token in AsyncStorage.
    const legacy = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacy);
      await AsyncStorage.removeItem(TOKEN_KEY);
      return legacy;
    }
    return null;
  } catch {
    // SecureStore unsupported (e.g. web) — plain storage keeps the app usable
    return AsyncStorage.getItem(TOKEN_KEY);
  }
}

async function writeToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
}

async function clearStoredToken(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    AsyncStorage.removeItem(TOKEN_KEY),
  ]);
}

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    readToken().then((t) => {
      setToken(t);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  const signIn = async (newToken: string) => {
    await writeToken(newToken);
    setToken(newToken);
  };

  const signOut = async () => {
    await clearStoredToken();
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
