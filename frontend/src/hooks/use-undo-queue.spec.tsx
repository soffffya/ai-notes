import { act, renderHook } from '@testing-library/react';

const notifications = {
  push: vi.fn(),
};

vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => notifications,
}));

import { useUndoQueue } from './use-undo-queue';

describe('useUndoQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notifications.push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('commits action after undo timeout', async () => {
    const optimistic = vi.fn();
    const rollback = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();

    const { result } = renderHook(() => useUndoQueue(onError, 1000));

    act(() => {
      result.current.scheduleUndoableAction({
        key: 'note:1',
        title: 'Deleting note',
        optimistic,
        rollback,
        commit,
      });
    });

    expect(optimistic).toHaveBeenCalledTimes(1);
    expect(notifications.push).toHaveBeenCalledWith('Deleting note', 'info', expect.any(Object));

    await act(async () => {
      vi.advanceTimersByTimeAsync(1000);
    });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(rollback).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('rolls back action when user clicks undo', () => {
    const optimistic = vi.fn();
    const rollback = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();

    const { result } = renderHook(() => useUndoQueue(onError, 1000));

    act(() => {
      result.current.scheduleUndoableAction({
        key: 'note:2',
        title: 'Deleting note',
        optimistic,
        rollback,
        commit,
      });
    });

    const actionOptions = notifications.push.mock.calls[0]?.[2];

    act(() => {
      actionOptions?.onAction?.();
    });

    expect(rollback).toHaveBeenCalledTimes(1);
    expect(notifications.push).toHaveBeenLastCalledWith('Action reverted', 'success');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(commit).not.toHaveBeenCalled();
  });
});
