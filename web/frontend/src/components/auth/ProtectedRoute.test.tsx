import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>dashboard content</div>} />
        </Route>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<div>login page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state until the stored session has been validated', () => {
    useAuthStore.setState({ isInitialized: false, isAuthenticated: false, user: null });

    renderAt('/dashboard');

    expect(screen.getByText(/restoring your secure session/i)).toBeInTheDocument();
    expect(screen.queryByText('dashboard content')).not.toBeInTheDocument();
  });

  it('redirects to the login page when there is no session', () => {
    useAuthStore.setState({ isInitialized: true, isAuthenticated: false, user: null });

    renderAt('/dashboard');

    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders protected content for an authenticated session', () => {
    useAuthStore.setState({
      isInitialized: true,
      isAuthenticated: true,
      user: { id: 'user-1', name: 'Analyst', email: 'a@b.c' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    renderAt('/dashboard');

    expect(screen.getByText('dashboard content')).toBeInTheDocument();
  });

  it('keeps authenticated users away from the login page', () => {
    useAuthStore.setState({ isInitialized: true, isAuthenticated: true });

    renderAt('/login');

    expect(screen.getByText('dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});
