/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { PasswordResetModal } from '../components/modals/PasswordResetModal';
import * as authApi from '../api/authApi';

const mockAuthSuccess: authApi.AuthResponse = {
  user: {
    id: 'user-mom-1',
    name: 'Мама',
    email: 'mama@mail.ru',
    role: 'Мама',
    familyId: 'demo-family-1',
  },
  family: {
    id: 'demo-family-1',
    name: 'Семья Сына',
    inviteCode: '7K4-Q9M',
  },
  child: {
    id: 'demo-child-1',
    name: 'Сын',
  },
  token: 'mock-jwt-token-xyz',
};

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders top Bento branding and login form without text subtitles in logo card', () => {
    render(<LoginPage />);

    expect(screen.getByTestId('login-page')).toBeDefined();
    expect(screen.queryByText('режим сна малыша для всей семьи')).toBeNull();
    expect(screen.queryByText('My little son')).toBeNull();

    const logoImg = screen.getByTestId('auth-logo-img') as HTMLImageElement;
    expect(logoImg).toBeDefined();
    expect(logoImg.getAttribute('src')).toBe('/logo.svg');

    // Logo card should not contain text captions
    const logoCard = logoImg.closest('section');
    expect(logoCard).toBeDefined();
    expect(logoCard?.textContent?.trim()).toBe('');

    expect(screen.getByTestId('login-email-input')).toBeDefined();
    expect(screen.getByTestId('login-password-input')).toBeDefined();
    expect(screen.getByTestId('login-submit-btn')).toBeDefined();
    expect(screen.getByTestId('btn-to-register')).toBeDefined();
  });

  it('renders brand top strip and logo image', () => {
    render(<LoginPage />);

    const topStrip = screen.getByTestId('brand-top-strip');
    expect(topStrip).toBeDefined();
    expect(topStrip.textContent).toContain('My little sun');
    expect(topStrip.style.padding).toBe('14px 18px');
    expect(topStrip.style.minHeight).toBe('48px');
    expect(topStrip.style.fontSize).toBe('16px');
    expect(topStrip.style.letterSpacing).toBe('1.2px');
    expect(topStrip.style.marginBottom).toBe('4px');
    expect(topStrip.style.borderRadius).toBe('20px');

    const logoImg = screen.getByTestId('auth-logo-img') as HTMLImageElement;
    expect(logoImg).toBeDefined();
    expect(logoImg.getAttribute('src')).toBe('/logo.svg');
    expect(logoImg.style.width).toBe('124px');
    expect(logoImg.style.height).toBe('124px');
    expect(logoImg.style.borderRadius).toBe('24px');
  });

  it('does not render quick demo buttons for Mom and Dad', () => {
    render(<LoginPage />);

    expect(screen.queryByTestId('quick-login-mama')).toBeNull();
    expect(screen.queryByTestId('quick-login-papa')).toBeNull();
  });

  it('submits login form and invokes onSuccess callback', async () => {
    const loginSpy = vi.spyOn(authApi, 'loginApi').mockResolvedValue(mockAuthSuccess);
    const handleSuccess = vi.fn();

    render(<LoginPage onSuccess={handleSuccess} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('login-submit-btn'));
    });

    expect(loginSpy).toHaveBeenCalledWith({
      email: 'mama@mail.ru',
      password: 'password123',
    });
    expect(handleSuccess).toHaveBeenCalledWith(mockAuthSuccess);
  });

  it('displays error banner when loginApi throws an error', async () => {
    vi.spyOn(authApi, 'loginApi').mockRejectedValue(new Error('Неверный пароль'));

    render(<LoginPage />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('login-submit-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('login-error-banner').textContent).toBe('Неверный пароль');
    });
  });

  it('navigates to register when clicking register button', () => {
    const handleNav = vi.fn();
    render(<LoginPage onNavigateToRegister={handleNav} />);

    fireEvent.click(screen.getByTestId('btn-to-register'));
    expect(handleNav).toHaveBeenCalledTimes(1);
  });

  it('opens PasswordResetModal when clicking forgot password link', async () => {
    render(<LoginPage />);

    expect(screen.queryByTestId('reset-password-modal')).toBeNull();

    fireEvent.click(screen.getByTestId('forgot-password-btn'));

    expect(screen.getByTestId('reset-password-modal')).toBeDefined();
    expect(screen.getByTestId('reset-password-title').textContent).toBe('Восстановление пароля');
    expect(screen.getByTestId('reset-password-email')).toBeDefined();
    expect(screen.getByTestId('reset-password-code')).toBeDefined();
    expect(screen.getByTestId('reset-password-new-password')).toBeDefined();
  });

  it('successfully resets password via modal and displays success banner', async () => {
    const resetSpy = vi.spyOn(authApi, 'resetPasswordApi').mockResolvedValue({
      success: true,
      message: 'Пароль успешно изменён',
    });

    render(<LoginPage />);

    fireEvent.click(screen.getByTestId('forgot-password-btn'));

    await act(async () => {
      fireEvent.change(screen.getByTestId('reset-password-email'), { target: { value: 'mama@mail.ru' } });
      fireEvent.change(screen.getByTestId('reset-password-code'), { target: { value: 'солнышко' } });
      fireEvent.change(screen.getByTestId('reset-password-new-password'), { target: { value: 'newpassword123' } });
      fireEvent.click(screen.getByTestId('reset-password-submit-btn'));
    });

    expect(resetSpy).toHaveBeenCalledWith({
      email: 'mama@mail.ru',
      recoveryCode: 'солнышко',
      newPassword: 'newpassword123',
    });

    expect(screen.getByTestId('reset-password-success')).toBeDefined();

    // Click finish button in modal
    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-password-done-btn'));
    });

    // Modal is closed
    expect(screen.queryByTestId('reset-password-modal')).toBeNull();
    // Success banner is visible on LoginPage
    expect(screen.getByTestId('login-reset-success-banner')).toBeDefined();
  });

  it('displays error in modal when resetPasswordApi fails', async () => {
    vi.spyOn(authApi, 'resetPasswordApi').mockRejectedValue(new Error('Неверное кодовое слово семьи'));

    render(<LoginPage />);

    fireEvent.click(screen.getByTestId('forgot-password-btn'));

    await act(async () => {
      fireEvent.change(screen.getByTestId('reset-password-code'), { target: { value: 'wrong-word' } });
      fireEvent.change(screen.getByTestId('reset-password-new-password'), { target: { value: 'newpassword123' } });
      fireEvent.click(screen.getByTestId('reset-password-submit-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('reset-password-error').textContent).toBe('Неверное кодовое слово семьи');
    });
  });

  it('closes PasswordResetModal when close button is clicked', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByTestId('forgot-password-btn'));
    expect(screen.getByTestId('reset-password-modal')).toBeDefined();

    fireEvent.click(screen.getByTestId('reset-password-close-btn'));
    expect(screen.queryByTestId('reset-password-modal')).toBeNull();
  });

  it('renders biometric login button next to submit button', () => {
    render(<LoginPage />);
    const bioBtn = screen.getByTestId('biometric-login-btn');
    expect(bioBtn).toBeDefined();
    expect(bioBtn.getAttribute('aria-label')).toBe('Войти по биометрии');
  });

  it('clicking biometric button with saved credentials authenticates and triggers onSuccess', async () => {
    const handleSuccess = vi.fn();
    localStorage.setItem('mls_biometrics_enabled', 'true');
    localStorage.setItem(
      'mls_biometric_user',
      JSON.stringify({
        id: 'user-mom-1',
        name: 'Мама',
        email: 'mama@mail.ru',
        role: 'Мама',
        familyId: 'demo-family-1',
        token: 'mock-bio-token-123',
      })
    );

    render(<LoginPage onSuccess={handleSuccess} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('biometric-login-btn'));
    });

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'mock-bio-token-123',
        user: expect.objectContaining({
          id: 'user-mom-1',
          email: 'mama@mail.ru',
        }),
      })
    );
  });

  it('clicking biometric button without saved credentials displays error prompting to enable in Settings', async () => {
    localStorage.clear();

    render(<LoginPage />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('biometric-login-btn'));
    });

    await waitFor(() => {
      const errorBanner = screen.getByTestId('login-error-banner');
      expect(errorBanner.textContent).toContain('Сначала включите вход по биометрии в Настройках');
    });
  });

  it('displays error when biometric authentication returns null', async () => {
    localStorage.setItem('mls_biometrics_enabled', 'true');
    localStorage.setItem(
      'mls_biometric_user',
      JSON.stringify({
        id: 'user-mom-1',
        name: 'Мама',
        email: 'mama@mail.ru',
        token: 'mock-token',
      })
    );
    const originalCredentials = navigator.credentials;
    Object.defineProperty(navigator, 'credentials', {
      value: {
        get: vi.fn().mockRejectedValue({ name: 'NotAllowedError' }),
      },
      configurable: true,
      writable: true,
    });

    render(<LoginPage />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('biometric-login-btn'));
    });

    await waitFor(() => {
      const errorBanner = screen.getByTestId('login-error-banner');
      expect(errorBanner.textContent).toBe('Биометрическая аутентификация не выполнена');
    });

    Object.defineProperty(navigator, 'credentials', {
      value: originalCredentials,
      configurable: true,
      writable: true,
    });
  });

  it('disables biometric button when loading is true', async () => {
    let resolveLogin: (val: any) => void = () => {};
    vi.spyOn(authApi, 'loginApi').mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );

    render(<LoginPage />);

    const submitBtn = screen.getByTestId('login-submit-btn');
    const bioBtn = screen.getByTestId('biometric-login-btn') as HTMLButtonElement;

    expect(bioBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(bioBtn.disabled).toBe(true);
    expect(bioBtn.style.opacity).toBe('0.6');

    await act(async () => {
      resolveLogin(mockAuthSuccess);
    });

    expect(bioBtn.disabled).toBe(false);
  });
});

describe('RegisterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form inside scrollable content container', () => {
    render(<RegisterPage />);

    const registerPage = screen.getByTestId('register-page');
    expect(registerPage.style.height).toBe('100%');
    expect(registerPage.style.overflow).toBe('hidden');

    const contentContainer = screen.getByTestId('register-content');
    expect(contentContainer).toBeDefined();
    expect(contentContainer.className).toContain('screen-content');
    expect(contentContainer.style.overflowY).toBe('auto');
  });

  it('renders registration form matching 07_register.html', () => {
    render(<RegisterPage />);

    expect(screen.getByTestId('register-page')).toBeDefined();
    expect(screen.getByText('Регистрация')).toBeDefined();
    expect(screen.getByTestId('btn-back-to-login')).toBeDefined();

    expect(screen.getByTestId('register-name-input')).toBeDefined();
    expect(screen.getByTestId('role-btn-Мама')).toBeDefined();
    expect(screen.getByTestId('role-btn-Папа')).toBeDefined();
    expect(screen.getByTestId('role-btn-Другое')).toBeDefined();

    expect(screen.getByTestId('register-email-input')).toBeDefined();
    expect(screen.getByTestId('register-password-input')).toBeDefined();

    // Default family mode: INVITE
    expect(screen.getByTestId('invite-code-container')).toBeDefined();
    expect(screen.getByTestId('register-invite-code-input')).toBeDefined();
  });

  it('renders brand top strip and logo image', () => {
    render(<RegisterPage />);

    const topStrip = screen.getByTestId('brand-top-strip');
    expect(topStrip).toBeDefined();
    expect(topStrip.textContent).toContain('My little sun');
    expect(topStrip.style.padding).toBe('14px 18px');
    expect(topStrip.style.minHeight).toBe('48px');
    expect(topStrip.style.fontSize).toBe('16px');
    expect(topStrip.style.letterSpacing).toBe('1.2px');
    expect(topStrip.style.marginBottom).toBe('4px');
    expect(topStrip.style.borderRadius).toBe('20px');

    const logoImg = screen.getByTestId('auth-logo-img') as HTMLImageElement;
    expect(logoImg).toBeDefined();
    expect(logoImg.getAttribute('src')).toBe('/logo.svg');
  });

  it('switches role when clicking role buttons', async () => {
    render(<RegisterPage />);

    const papaBtn = screen.getByTestId('role-btn-Папа');
    await act(async () => {
      fireEvent.click(papaBtn);
    });

    expect(papaBtn.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('role-btn-Мама').getAttribute('aria-pressed')).toBe('false');
  });

  it('switches between family invitation code and creating new family', async () => {
    render(<RegisterPage />);

    // Default: invite code is visible
    expect(screen.getByTestId('invite-code-container')).toBeDefined();
    expect(screen.queryByTestId('child-name-container')).toBeNull();

    // Switch to new family
    await act(async () => {
      fireEvent.click(screen.getByTestId('family-mode-new'));
    });

    expect(screen.queryByTestId('invite-code-container')).toBeNull();
    expect(screen.getByTestId('child-name-container')).toBeDefined();
    expect(screen.getByTestId('register-child-name-input')).toBeDefined();
  });

  it('registers successfully with invite code (e.g. Papa joining)', async () => {
    const registerSpy = vi.spyOn(authApi, 'registerApi').mockResolvedValue(mockAuthSuccess);
    const handleSuccess = vi.fn();

    render(<RegisterPage onSuccess={handleSuccess} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('register-name-input'), { target: { value: 'Папа' } });
      fireEvent.click(screen.getByTestId('role-btn-Папа'));
      fireEvent.change(screen.getByTestId('register-email-input'), { target: { value: 'papa@mail.ru' } });
      fireEvent.change(screen.getByTestId('register-password-input'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByTestId('register-invite-code-input'), { target: { value: '7K4-Q9M' } });
      fireEvent.click(screen.getByTestId('register-submit-btn'));
    });

    expect(registerSpy).toHaveBeenCalledWith({
      name: 'Папа',
      role: 'Папа',
      email: 'papa@mail.ru',
      password: 'password123',
      inviteCode: '7K4-Q9M',
    });
    expect(handleSuccess).toHaveBeenCalledWith(mockAuthSuccess);
  });

  it('registers successfully creating new family (e.g. Mom creating)', async () => {
    const registerSpy = vi.spyOn(authApi, 'registerApi').mockResolvedValue(mockAuthSuccess);
    const handleSuccess = vi.fn();

    render(<RegisterPage onSuccess={handleSuccess} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('register-name-input'), { target: { value: 'Мама' } });
      fireEvent.change(screen.getByTestId('register-email-input'), { target: { value: 'newmom@mail.ru' } });
      fireEvent.change(screen.getByTestId('register-password-input'), { target: { value: 'secretpass' } });
      fireEvent.click(screen.getByTestId('family-mode-new'));
      fireEvent.change(screen.getByTestId('register-child-name-input'), { target: { value: 'Марк' } });
      fireEvent.click(screen.getByTestId('register-submit-btn'));
    });

    expect(registerSpy).toHaveBeenCalledWith({
      name: 'Мама',
      role: 'Мама',
      email: 'newmom@mail.ru',
      password: 'secretpass',
      childName: 'Марк',
      familyName: 'Семья Марк',
    });
    expect(handleSuccess).toHaveBeenCalledWith(mockAuthSuccess);
  });

  it('displays recovery code input and hint when creating new family', async () => {
    render(<RegisterPage />);

    // Default: invite code is visible, recovery code is not
    expect(screen.queryByTestId('register-recovery-code')).toBeNull();

    // Switch to new family
    await act(async () => {
      fireEvent.click(screen.getByTestId('family-mode-new'));
    });

    const recoveryInput = screen.getByTestId('register-recovery-code');
    expect(recoveryInput).toBeDefined();
    expect(screen.getByText(/Используется для восстановления доступа/)).toBeDefined();
  });

  it('registers successfully creating new family with recovery code', async () => {
    const registerSpy = vi.spyOn(authApi, 'registerApi').mockResolvedValue(mockAuthSuccess);
    const handleSuccess = vi.fn();

    render(<RegisterPage onSuccess={handleSuccess} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('register-name-input'), { target: { value: 'Ольга' } });
      fireEvent.change(screen.getByTestId('register-email-input'), { target: { value: 'olga@mail.ru' } });
      fireEvent.change(screen.getByTestId('register-password-input'), { target: { value: 'secretpass' } });
      fireEvent.click(screen.getByTestId('family-mode-new'));
      fireEvent.change(screen.getByTestId('register-child-name-input'), { target: { value: 'Артём' } });
      fireEvent.change(screen.getByTestId('register-recovery-code'), { target: { value: 'Барсик' } });
      fireEvent.click(screen.getByTestId('register-submit-btn'));
    });

    expect(registerSpy).toHaveBeenCalledWith({
      name: 'Ольга',
      role: 'Мама',
      email: 'olga@mail.ru',
      password: 'secretpass',
      childName: 'Артём',
      familyName: 'Семья Артём',
      recoveryCode: 'Барсик',
    });
    expect(handleSuccess).toHaveBeenCalledWith(mockAuthSuccess);
  });

  it('handles back button and login link', () => {
    const handleLoginNav = vi.fn();
    render(<RegisterPage onNavigateToLogin={handleLoginNav} />);

    fireEvent.click(screen.getByTestId('btn-back-to-login'));
    expect(handleLoginNav).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('link-to-login'));
    expect(handleLoginNav).toHaveBeenCalledTimes(2);
  });
});

describe('PasswordResetModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<PasswordResetModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('reset-password-modal')).toBeNull();
  });

  it('renders all required form controls and triggers close on backdrop click', () => {
    const handleClose = vi.fn();
    render(<PasswordResetModal isOpen={true} onClose={handleClose} initialEmail="test@example.com" />);

    expect(screen.getByTestId('reset-password-modal')).toBeDefined();
    const emailInput = screen.getByTestId('reset-password-email') as HTMLInputElement;
    expect(emailInput.value).toBe('test@example.com');

    // Click backdrop
    fireEvent.click(screen.getByTestId('reset-password-modal-backdrop'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    render(<PasswordResetModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('validates required fields before submitting', async () => {
    const resetSpy = vi.spyOn(authApi, 'resetPasswordApi');
    render(<PasswordResetModal isOpen={true} onClose={vi.fn()} />);

    // Empty email
    await act(async () => {
      fireEvent.change(screen.getByTestId('reset-password-email'), { target: { value: '' } });
      fireEvent.click(screen.getByTestId('reset-password-submit-btn'));
    });
    expect(screen.getByTestId('reset-password-error').textContent).toContain('эл. почту');
    expect(resetSpy).not.toHaveBeenCalled();

    // Fill email, empty recovery code
    await act(async () => {
      fireEvent.change(screen.getByTestId('reset-password-email'), { target: { value: 'user@example.com' } });
      fireEvent.change(screen.getByTestId('reset-password-code'), { target: { value: '' } });
      fireEvent.click(screen.getByTestId('reset-password-submit-btn'));
    });
    expect(screen.getByTestId('reset-password-error').textContent).toContain('кодовое слово');
    expect(resetSpy).not.toHaveBeenCalled();

    // Fill code, short password
    await act(async () => {
      fireEvent.change(screen.getByTestId('reset-password-code'), { target: { value: 'secret' } });
      fireEvent.change(screen.getByTestId('reset-password-new-password'), { target: { value: '123' } });
      fireEvent.click(screen.getByTestId('reset-password-submit-btn'));
    });
    expect(screen.getByTestId('reset-password-error').textContent).toContain('не менее 6');
    expect(resetSpy).not.toHaveBeenCalled();
  });
});
