import axios from 'axios';

let tokenProvider;
export function setApiTokenProvider(provider) { tokenProvider = provider; }
export async function apiRequest(path, options = {}) {
  const token = await tokenProvider?.();
  if (!token) throw new Error('Sign in before using resume services');
  return axios({ ...options, url: `/api/${path}`, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
}
