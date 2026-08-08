export function getStoreId(): string {
  if (typeof window !== 'undefined') {
    const auth = localStorage.getItem('playbox_auth');
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        return parsed.storeId || 'demo';
      } catch (e) {}
    }
  }
  return 'demo'; // default fallback tenant
}
