/**
 * Authentication Service
 *
 * Handles all authentication-related API calls: login, register,
 * session validation, onboarding completion, and security questions.
 */

import { getApiBaseUrl } from '../config/apiConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePhoto?: string;
  isOnboarded: boolean;
  assessmentScores?: Record<string, number>;
  dataConsent?: boolean;
  clinicianSharing?: boolean;
  birthday?: string;
  gender?: string;
  region?: string;
  language?: string;
  approach?: 'western' | 'eastern' | 'hybrid';
  emergencyContact?: string;
  emergencyPhone?: string;
  hasPassword?: boolean;
  isGoogleUser?: boolean;
  securityQuestion?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToken = (): string | null =>
  localStorage.getItem('token');

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

// ─── Auth Functions ───────────────────────────────────────────────────────────

/**
 * Validate the stored JWT and return the current user.
 * Returns null when no token is present or the token is invalid.
 */
export async function getCurrentUser(): Promise<StoredUser | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
      }
      return null;
    }

    const data = await response.json();
    return (data?.data?.user ?? null) as StoredUser | null;
  } catch {
    return null;
  }
}

/**
 * Login with email and password.
 * Returns `{ user, token }` on success; throws on failure.
 */
export async function loginUser(credentials: {
  email: string;
  password: string;
}): Promise<{ user: StoredUser; token: string }> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    const err: any = new Error(data?.error || 'Invalid credentials');
    err.response = { data };
    throw err;
  }

  if (!data?.data?.token || !data?.data?.user) {
    throw new Error('Invalid response from server');
  }

  localStorage.setItem('token', data.data.token);
  return { user: data.data.user as StoredUser, token: data.data.token };
}

/**
 * Register a new user.
 * Returns `{ user, token }` on success; throws on failure.
 */
export async function registerUser(userData: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: StoredUser; token: string }> {
  const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    const err: any = new Error(data?.error || 'Registration failed');
    if (data?.error?.toLowerCase().includes('already exists') || response.status === 409) {
      (err as any).suggestLogin = true;
      (err as any).email = userData.email;
    }
    (err as any).status = response.status;
    throw err;
  }

  if (!data?.data?.token || !data?.data?.user) {
    throw new Error('Invalid response from server');
  }

  localStorage.setItem('token', data.data.token);
  return { user: data.data.user as StoredUser, token: data.data.token };
}

/**
 * Clear authentication tokens from localStorage (client-side logout).
 */
export function signOut(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/**
 * Complete onboarding with approach and optional profile data.
 * Returns the updated user on success.
 */
export async function completeOnboarding(
  approach: 'western' | 'eastern' | 'hybrid',
  profileData?: {
    firstName?: string;
    lastName?: string;
    birthday?: string;
    gender?: string;
    region?: string;
    language?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  }
): Promise<StoredUser | null> {
  const response = await fetch(`${getApiBaseUrl()}/users/complete-onboarding`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ approach, ...profileData }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to complete onboarding');
  }

  return (data?.data?.user ?? null) as StoredUser | null;
}

/**
 * Set up a password for OAuth (Google) users.
 * Returns the updated user on success.
 */
export async function setupUserPassword(password: string): Promise<StoredUser | null> {
  const response = await fetch(`${getApiBaseUrl()}/auth/setup-password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to set up password');
  }

  return (data?.data?.user ?? null) as StoredUser | null;
}

/**
 * Look up a user's security question for the forgot-password flow (unauthenticated).
 */
export async function requestSecurityQuestion(
  email: string
): Promise<{ questionAvailable: boolean; question?: string }> {
  const response = await fetch(`${getApiBaseUrl()}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to look up security question');
  }

  return data?.data ?? { questionAvailable: false };
}

/**
 * Reset password by verifying a security question answer (unauthenticated).
 */
export async function resetPasswordWithSecurityAnswer(params: {
  email: string;
  answer: string;
  password: string;
}): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: params.email, answer: params.answer, newPassword: params.password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to reset password');
  }
}

/**
 * Set or update the security question for the authenticated user.
 */
export async function setupSecurityQuestion(params: {
  question: string;
  answer: string;
}): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/auth/security-question`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to set security question');
  }
}
