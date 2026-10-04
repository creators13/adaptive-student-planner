import { afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { closeAllDialogs } from '../ui/dialog';
import { clearToasts } from '../ui/toast';

afterEach(() => {
  act(() => { closeAllDialogs(); clearToasts(); });
  cleanup();
  localStorage.clear();
});
