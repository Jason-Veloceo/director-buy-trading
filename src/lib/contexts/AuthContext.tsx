"use client";

import React, { createContext, useEffect, useState } from "react";
import { Auth } from 'aws-amplify';
import { 
  signIn, 
  signOut, 
  signUp, 
  confirmSignUp, 
  getCurrentUser 
} from '../aws/authUtils';

interface User {
  username: string;
  email: string;
  attributes?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (params: { username: string; password: string }) => Promise<any>;
  signOut: () => Promise<void>;
  signUp: (params: { 
    username: string; 
    password: string; 
    email: string; 
    firstName?: string; 
    lastName?: string 
  }) => Promise<any>;
  confirmSignUp: (params: { username: string; code: string }) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  signIn: async () => null,
  signOut: async () => {},
  signUp: async () => null,
  confirmSignUp: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for authenticated user when the component mounts
    const checkAuthState = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setUser({
            username: user.username,
            email: user.attributes.email,
            attributes: user.attributes,
          });
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Error checking auth state", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthState();
  }, []);

  // Set up Auth change listener
  useEffect(() => {
    const authListener = (data: any) => {
      switch (data.payload.event) {
        case 'signIn':
          setIsAuthenticated(true);
          getCurrentUser().then(user => {
            if (user) {
              setUser({
                username: user.username,
                email: user.attributes.email,
                attributes: user.attributes,
              });
            }
          });
          break;
        case 'signOut':
          setIsAuthenticated(false);
          setUser(null);
          break;
      }
    };

    const subscription = Auth.Hub.listen('auth', authListener);

    return () => {
      subscription();
    };
  }, []);

  const authValues: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    signIn,
    signOut,
    signUp,
    confirmSignUp,
  };

  return (
    <AuthContext.Provider value={authValues}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
