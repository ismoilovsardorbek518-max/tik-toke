import { AuthUser, setAuthTokenGetter } from "@workspace/api-client-react";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to restore from local storage
    const storedToken = localStorage.getItem("tiktoke_token");
    const storedUser = localStorage.getItem("tiktoke_user");

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Register token getter for custom-fetch
        setAuthTokenGetter(() => storedToken);
      } catch (e) {
        console.error("Failed to parse user from local storage");
      }
    }
    
    setIsLoading(false);
  }, []);

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
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
