import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { GlobalTools } from './GlobalTools';

function CurrentRoute() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

describe('GlobalTools search', () => {
  it('filters actual app destinations and navigates from the keyboard', async () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><GlobalTools /><CurrentRoute /></MemoryRouter>);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const search = await screen.findByRole('textbox', { name: 'Search pages, features, and help' });
    fireEvent.change(search, { target: { value: 'feature' } });
    expect(screen.getByRole('option', { name: /Feature Importance/ })).toBeInTheDocument();
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/features'));
    expect(screen.queryByRole('dialog', { name: 'Search CyberShield' })).not.toBeInTheDocument();
  });
});
