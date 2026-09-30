/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
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

  it('renders top Bento branding and login form matching 06_login.html', () => {
    render(<LoginPage />);

    expect(screen.getByTestId('login-page')).toBeDefined();
    expect(screen.getByText('My little son')).toBeDefined();
    expect(screen.getByText('режим сна малыша для всей семьи')).toBeDefined();

    expect(screen.getByTestId('login-email-input')).toBeDefined();
    expect(screen.getByTestId('login-password-input')).toBeDefined();
    expect(screen.getByTestId('login-submit-btn')).toBeDefined();
    expect(screen.getByTestId('btn-to-register')).toBeDefined();
  });

  it('handles quick demo buttons for Mom and Dad', () => {
    render(<LoginPage />);

    const emailInput = screen.getByTestId('login-email-input') as HTMLInputElement;
    const passInput = screen.getByTestId('login-password-input') as HTMLInputElement;

    // Default is mama
    expect(emailInput.value).toBe('mama@mail.ru');

    // Click quick demo papa
    fireEvent.click(screen.getByTestId('quick-login-papa'));
    expect(emailInput.value).toBe('papa@mail.ru');
    expect(passInput.value).toBe('password123');

    // Click quick demo mama
    fireEvent.click(screen.getByTestId('quick-login-mama'));
    expect(emailInput.value).toBe('mama@mail.ru');
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
});

describe('RegisterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('handles back button and login link', () => {
    const handleLoginNav = vi.fn();
    render(<RegisterPage onNavigateToLogin={handleLoginNav} />);

    fireEvent.click(screen.getByTestId('btn-back-to-login'));
    expect(handleLoginNav).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('link-to-login'));
    expect(handleLoginNav).toHaveBeenCalledTimes(2);
  });
});
