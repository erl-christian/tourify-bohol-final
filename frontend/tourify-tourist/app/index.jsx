import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

export default function Index() {
  const { account, loading, } = useAuth();
  if (loading) return null;
  return <Redirect href={account ? '/home' : '/(auth)/welcome'} />;
  
}
