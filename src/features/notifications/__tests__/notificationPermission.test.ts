/**
 * Unit tests for the notification permission state machine and single-global-ask policy.
 *
 * These tests validate the store state transitions and the requestNotificationPermission
 * utility without exercising React render cycles.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: { openSettings: jest.fn() },
  Platform: { OS: 'ios' },
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotificationPrefs } from '../../../store/notifications';
import { requestNotificationPermission } from '../requestNotificationPermission';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetStore() {
  useNotificationPrefs.setState({
    permissionAskedOnce: false,
    lastPermissionStatus: undefined,
    masterEnabled: true,
  });
}

function mockOsStatus(status: string) {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status });
}

function mockOsPromptResult(status: string) {
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status });
}

/**
 * Simulate user tapping the given button in the most recent Alert.
 * Must be called after awaiting microtasks so the alert has been rendered.
 */
function tapAlertButton(buttonLabel: string) {
  const alertMock = Alert.alert as jest.Mock;
  const lastCall = alertMock.mock.calls[alertMock.mock.calls.length - 1];
  if (!lastCall) throw new Error('Alert.alert was not called');
  const buttons: { text: string; onPress?: () => void }[] = lastCall[2] ?? [];
  const btn = buttons.find((b) => b.text === buttonLabel);
  if (!btn) throw new Error(`Button "${buttonLabel}" not found in Alert`);
  btn.onPress?.();
}

/** Flush pending microtasks (resolved Promises) without advancing fake timers. */
async function flushMicrotasks() {
  await Promise.resolve();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  (Alert.alert as jest.Mock).mockClear();
  (Notifications.getPermissionsAsync as jest.Mock).mockReset();
  (Notifications.requestPermissionsAsync as jest.Mock).mockReset();
});

// ── Store state machine ───────────────────────────────────────────────────────

describe('useNotificationPrefs store', () => {
  it('starts with permissionAskedOnce = false and lastPermissionStatus = undefined', () => {
    const s = useNotificationPrefs.getState();
    expect(s.permissionAskedOnce).toBe(false);
    expect(s.lastPermissionStatus).toBeUndefined();
  });

  it('markPermissionAsked sets permissionAskedOnce = true and records status', () => {
    useNotificationPrefs.getState().markPermissionAsked('granted');
    const s = useNotificationPrefs.getState();
    expect(s.permissionAskedOnce).toBe(true);
    expect(s.lastPermissionStatus).toBe('granted');
  });

  it('syncPermissionStatus updates lastPermissionStatus without touching permissionAskedOnce', () => {
    useNotificationPrefs.getState().syncPermissionStatus('denied');
    const s = useNotificationPrefs.getState();
    expect(s.lastPermissionStatus).toBe('denied');
    expect(s.permissionAskedOnce).toBe(false);
  });

  it('markPermissionAsked called twice keeps permissionAskedOnce = true', () => {
    useNotificationPrefs.getState().markPermissionAsked('granted');
    useNotificationPrefs.getState().markPermissionAsked('denied');
    expect(useNotificationPrefs.getState().permissionAskedOnce).toBe(true);
    expect(useNotificationPrefs.getState().lastPermissionStatus).toBe('denied');
  });
});

// ── requestNotificationPermission — no automatic prompt on cold start ─────────

describe('requestNotificationPermission — single-global-ask policy', () => {
  it('returns true and calls onGranted if permission is already granted', async () => {
    mockOsStatus('granted');
    const onGranted = jest.fn();
    const result = await requestNotificationPermission('settings', onGranted);
    expect(result).toBe(true);
    expect(onGranted).toHaveBeenCalledTimes(1);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('returns true for provisional status', async () => {
    mockOsStatus('provisional');
    const result = await requestNotificationPermission('settings');
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('shows Settings alert (not OS prompt) when status is denied', async () => {
    mockOsStatus('denied');
    const result = await requestNotificationPermission('medication_alert');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Enable notifications in Settings',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Open Settings' }),
      ]),
    );
    expect(result).toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('shows Settings alert (not rationale or OS prompt) when permissionAskedOnce is true', async () => {
    mockOsStatus('undetermined');
    useNotificationPrefs.getState().markPermissionAsked('undetermined');

    const result = await requestNotificationPermission('calendar_reminder');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Enable notifications in Settings',
      expect.any(String),
      expect.any(Array),
    );
    expect(result).toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('shows in-app rationale first, then OS prompt when user taps Enable', async () => {
    mockOsStatus('undetermined');
    mockOsPromptResult('granted');

    const resultPromise = requestNotificationPermission('medication_alert');
    // Yield so getPermissionsAsync resolves and Alert.alert is called.
    await flushMicrotasks();
    tapAlertButton('Enable');
    const result = await resultPromise;

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(useNotificationPrefs.getState().permissionAskedOnce).toBe(true);
    expect(useNotificationPrefs.getState().lastPermissionStatus).toBe('granted');
    expect(result).toBe(true);
  });

  it('does NOT call OS prompt when user taps Not now in the rationale', async () => {
    mockOsStatus('undetermined');

    const resultPromise = requestNotificationPermission('calendar_reminder');
    await flushMicrotasks();
    tapAlertButton('Not now');
    const result = await resultPromise;

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(useNotificationPrefs.getState().permissionAskedOnce).toBe(false);
    expect(result).toBe(false);
  });

  it('marks asked-once and returns false when OS prompt is denied', async () => {
    mockOsStatus('undetermined');
    mockOsPromptResult('denied');

    const resultPromise = requestNotificationPermission('settings');
    await flushMicrotasks();
    tapAlertButton('Enable');
    const result = await resultPromise;

    expect(useNotificationPrefs.getState().permissionAskedOnce).toBe(true);
    expect(useNotificationPrefs.getState().lastPermissionStatus).toBe('denied');
    expect(result).toBe(false);
  });

  it('does NOT show rationale or OS prompt when permission already granted (simulates no-prompt on login)', async () => {
    // Simulates what happens on cold start / sign-in when permission was previously granted.
    mockOsStatus('granted');
    const result = await requestNotificationPermission('settings');
    expect(result).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('uses context-specific copy in the rationale message', async () => {
    mockOsStatus('undetermined');
    mockOsPromptResult('granted');

    const resultPromise = requestNotificationPermission('calendar_reminder');
    await flushMicrotasks();
    // Verify the alert body mentions calendar-related copy.
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    expect(alertCall[1]).toContain('event reminders');
    tapAlertButton('Enable');
    await resultPromise;
  });
});
