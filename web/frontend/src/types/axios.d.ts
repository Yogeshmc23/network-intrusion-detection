import 'axios';

/**
 * Extra flags used by the API client's auth interceptors.
 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Set once a request has already been retried after a token refresh. */
    _retry?: boolean;
    /** Opt a request out of the automatic refresh-and-retry behaviour. */
    skipAuthRefresh?: boolean;
  }
}
