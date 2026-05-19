import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';

const setThemeMock = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    setTheme: setThemeMock,
  }),
}));

import SettingsDialog from './settings-dialog';

describe('SettingsDialog', () => {
  beforeEach(() => {
    setThemeMock.mockReset();
    localStorage.setItem('openaiApiKey', 'sk-existing');
  });

  it('loads the stored API key and saves the updated one', async () => {
    const user = userEvent.setup();
    const onSaveApiKey = vi.fn();

    render(
      <SettingsDialog
        email="sofi@example.com"
        onLogout={vi.fn()}
        onOpenChange={vi.fn()}
        onSaveApiKey={onSaveApiKey}
        open
      />,
    );

    const input = await screen.findByLabelText('OpenAI API key');
    expect(input).toHaveValue('sk-existing');

    await user.clear(input);
    await user.type(input, 'sk-updated');
    await user.click(screen.getByRole('button', { name: 'Save key' }));

    expect(onSaveApiKey).toHaveBeenCalledWith('sk-updated');
  });

  it('switches theme and language and supports logout', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage').mockResolvedValue(i18n);

    render(
      <SettingsDialog
        email="sofi@example.com"
        onLogout={onLogout}
        onOpenChange={vi.fn()}
        onSaveApiKey={vi.fn()}
        open
      />,
    );

    await user.click(screen.getByRole('switch'));
    expect(setThemeMock).toHaveBeenCalledWith('dark');

    await user.selectOptions(screen.getByLabelText('Interface language'), 'en');
    await waitFor(() => {
      expect(changeLanguageSpy).toHaveBeenCalledWith('en');
    });

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalled();

    changeLanguageSpy.mockRestore();
  });
});
