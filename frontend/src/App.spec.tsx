import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import type { Mock } from 'vitest';

const useAuthMock = vi.fn();

vi.mock('@/hooks/use-auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/use-notifications', () => ({
  NotificationsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/NotificationsViewport', () => ({
  default: () => null,
}));

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/pages/AuthPage', () => ({
  default: () => <div>Auth page content</div>,
}));

vi.mock('@/pages/HomePage', () => ({
  default: () => <div>Home page content</div>,
}));

import App from './App';

describe('App routing', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('renders auth page for guests on /auth', () => {
    (useAuthMock as Mock).mockReturnValue({
      isReady: true,
      isAuthenticated: false,
    });

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <App />
      </MemoryRouter>,
    );

    return expect(screen.findByText('Auth page content')).resolves.toBeInTheDocument();
  });

  it('renders home page for authenticated users on /', () => {
    (useAuthMock as Mock).mockReturnValue({
      isReady: true,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    return expect(screen.findByText('Home page content')).resolves.toBeInTheDocument();
  });

  it('shows session check fallback while auth is not ready', () => {
    (useAuthMock as Mock).mockReturnValue({
      isReady: false,
      isAuthenticated: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('Checking session...')).toBeInTheDocument();
  });
});
