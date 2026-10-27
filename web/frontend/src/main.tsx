import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ToastProvider } from '@/components/ui/toast';
import { isAuthError } from '@/lib/apiErrors';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Auth failures are not transient: retrying them only hammers the API.
      retry: (failureCount, error) => !isAuthError(error) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
