export function signOut(navigate) {
  sessionStorage.clear();
  navigate('/login', { replace: true });
}
