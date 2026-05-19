import { renderHook, waitFor, act } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

const apiFetchMock = vi.fn();

vi.mock('@/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { AuthProvider, useAuth } from './use-auth';

describe('useAuth', () => {
  function wrapper({ children }: PropsWithChildren) {
    return <AuthProvider>{children}</AuthProvider>;
  }

  beforeEach(() => {
    apiFetchMock.mockReset();
    localStorage.clear();
  });

  it('hydrates an existing session from localStorage', async () => {
    localStorage.setItem('accessToken', 'stored-token');
    apiFetchMock.mockResolvedValue({
      id: 'user-1',
      email: 'sofi@example.com',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/me');
    expect(result.current.user).toEqual({
      id: 'user-1',
      email: 'sofi@example.com',
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logs in and stores the token', async () => {
    apiFetchMock.mockResolvedValue({
      accessToken: 'jwt-token',
      user: {
        id: 'user-1',
        email: 'sofi@example.com',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('sofi@example.com', 'password123');
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'sofi@example.com',
        password: 'password123',
      }),
    });
    expect(localStorage.getItem('accessToken')).toBe('jwt-token');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('clears auth state on logout', async () => {
    apiFetchMock.mockResolvedValue({
      accessToken: 'jwt-token',
      user: {
        id: 'user-1',
        email: 'sofi@example.com',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('sofi@example.com', 'password123');
    });

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
