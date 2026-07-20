import { AuthUser, setAuthTokenGetter } from "@workspace/api-client-react";
import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const s = localStorage.getItem("tiktoke_user");
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem("tiktoke_token");
    if (t) setAuthTokenGetter(() => t);
    return t;
  });

  const login = (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("tiktoke_token", newToken);
    localStorage.setItem("tiktoke_user", JSON.stringify(newUser));
    setAuthTokenGetter(() => newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("tiktoke_token");
    localStorage.removeItem("tiktoke_user");
    setAuthTokenGetter(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
