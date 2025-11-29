import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken } from '../lib/http';
import { getMyTouristProfile } from '../lib/tourist';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await getMyTouristProfile();
      const next = data.profile ?? data;
      setProfile(next);
      return next;
    } catch (err) {
      setProfile(null);
      throw err;
    }
  }, []);

  const hydrate = async saved => {
    if (!saved) return;
    const parsed = JSON.parse(saved);
    setToken(parsed.token);
    setAccount(parsed.account);
    setAuthToken(parsed.token);
    try {
      await fetchProfile();
    } catch {
      /* silently ignore 404 until user creates profile */
    }
  };

  useEffect(() => {
    SecureStore.getItemAsync('auth')
      .then(hydrate)
      .finally(() => setLoading(false));
  }, [fetchProfile]);

  const signIn = async payload => {
    await SecureStore.setItemAsync('auth', JSON.stringify(payload));
    setToken(payload.token);
    setAccount(payload.account);
    setAuthToken(payload.token);
    try {
      await fetchProfile();
    } catch {
      setProfile(null);
    }
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync('auth');
    setToken(null);
    setAccount(null);
    setProfile(null);
    setAuthToken(null);
  };

  const value = useMemo(
    () => ({
      loading,
      account,
      profile,
      token,
      signIn,
      signOut,
      refreshProfile: fetchProfile,
    }),
    [loading, account, profile, token, fetchProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
