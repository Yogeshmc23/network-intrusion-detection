import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';
import { ToastProvider } from '@/components/ui/toast';
import { resetSessionBootstrap } from '@/lib/session';
import { useAuthStore } from '@/stores/authStore';

function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App routing', () => {
  beforeEach(() => {
    resetSessionBootstrap();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
    });
  });

  it('sends an unauthenticated visitor from a protected route to the login page', async () => {
    renderApp('/dashboard');

    expect(await screen.findByText(/sign in to terminal/i)).toBeInTheDocument();
    expect(screen.queryByText(/threat operations dashboard/i)).not.toBeInTheDocument();
  });

  it('stores allow-listed campaign parameters only after optional analytics consent', async () => {
    window.history.replaceState({}, '', '/login?utm_source=partner&utm_campaign=fall-briefing');
    renderApp('/login');

    expect(sessionStorage.getItem('cybershield_utm')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    expect(JSON.parse(sessionStorage.getItem('cybershield_utm') ?? '{}')).toEqual({
      utm_source: 'partner',
      utm_campaign: 'fall-briefing',
    });

    act(() => window.dispatchEvent(new CustomEvent('cybershield:cookie-settings')));
    fireEvent.click(screen.getByRole('button', { name: 'Reject optional' }));
    expect(sessionStorage.getItem('cybershield_utm')).toBeNull();
  });
});
