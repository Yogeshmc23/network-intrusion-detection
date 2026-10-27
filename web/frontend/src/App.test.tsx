import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
