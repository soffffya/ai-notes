import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const navigateMock = vi.fn();
const authState = {
  mode: 'login' as 'login' | 'register',
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  setMode: vi.fn((mode: 'login' | 'register') => {
    authState.mode = mode;
  }),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => authState,
}));

import AuthPage from './AuthPage';

describe('AuthPage', () => {
  beforeEach(() => {
    authState.mode = 'login';
    authState.isLoading = false;
    authState.login.mockReset();
    authState.register.mockReset();
    authState.setMode.mockClear();
    navigateMock.mockReset();
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );
  }

  it('switches between login and register tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Register' }));

    expect(authState.setMode).toHaveBeenCalledWith('register');
  });

  it('submits login credentials and navigates to home', async () => {
    const user = userEvent.setup();
    authState.login.mockResolvedValue(undefined);
    renderPage();

    await user.type(screen.getByLabelText('Email'), 'sofi@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(authState.login).toHaveBeenCalledWith('sofi@example.com', 'password123');
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('shows backend error message on failed login', async () => {
    const user = userEvent.setup();
    authState.login.mockRejectedValue(new Error('Invalid credentials'));
    renderPage();

    await user.type(screen.getByLabelText('Email'), 'sofi@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
