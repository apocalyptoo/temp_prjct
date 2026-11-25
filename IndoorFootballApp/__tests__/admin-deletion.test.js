/* eslint-env jest */
// Tests for the admin's delete confirmation (feature 4, docs/features/account-deletion.md,
// section e): the sentences, and the dialog on the Users tab and on the venue review
// screen. The rest of the review screen is in admin-venues.test.js.

import React from 'react';
import { Alert, Text as NativeText, TouchableOpacity } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { ConfirmDialog, ListRow } from '../src/components/ui';
import ManageUsersScreen from '../src/screens/Admin/ManageUsersScreen';
import AdminVenueScreen from '../src/screens/Admin/AdminVenueScreen';
import {
  DELETE_MESSAGE,
  PREVIEW_FAILED,
} from '../src/screens/Admin/adminDeletion';
import { outcomesForAdmin } from '../src/screens/Shared/deletionOutcomes';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  API_URL: 'https://api.example.test',
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

const user = fields => ({
  id: 1,
  email: 'someone@gmail.com',
  role: 'PLAYER',
  createdAt: '2026-11-20T10:00:00.000Z',
  verified: true,
  name: 'Someone',
  ...fields,
});
const KARIM = user({ id: 10, name: 'Karim' });
const ARENA = user({ id: 20, name: 'Arena 71', role: 'OWNER' });
const ADMIN = user({ id: 30, name: 'Admin', role: 'ADMIN' });

const CODE = 'a'.repeat(64);
const NEW_CODE = 'b'.repeat(64);
const SOLO = { id: 9, name: 'Mirpur Mavericks', outcome: 'delete' };
const KEPT = {
  id: 7,
  name: 'Dhanmondi Strikers',
  outcome: 'handover',
  newCaptain: { id: 19, name: 'Rahim' },
};
const NOTHING = {
  previewCode: CODE,
  captainedTeams: [],
  otherTeams: [{ id: 12, name: 'Gulshan FC' }],
  pendingCount: 3,
  venue: null,
};
const CAPTAIN = { ...NOTHING, captainedTeams: [SOLO, KEPT] };
const OWNER = {
  ...NOTHING,
  otherTeams: [],
  venue: { name: 'Arena 71', live: true },
};

const VENUE = {
  userId: 20,
  indoorName: 'Arena 71',
  phone: '01712345678',
  address: 'Road 5',
  area: 'Mirpur',
  website: null,
  description: null,
  openingHours: null,
  pricingInfo: null,
  approvedAt: '2026-11-23T12:00:00.000Z',
  reviewNote: null,
  email: 'arena@gmail.com',
  createdAt: '2026-11-20T10:00:00.000Z',
  verified: true,
  missingFields: [],
};

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });
const noConnection = () => new Error('Network Error');

// What each GET replies. A function is called; an Error is thrown.
let replies;
const previewCalls = () =>
  api.get.mock.calls.filter(([path]) => path.endsWith('/deletion-preview'));

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');
const openDialog = renderer =>
  renderer.root.findAllByType(ConfirmDialog).find(node => node.props.visible);
const dialogRows = renderer =>
  openDialog(renderer)
    .findAllByType(ListRow)
    .map(node => [node.props.icon, node.props.name]);
const confirm = async renderer => {
  await act(async () => openDialog(renderer).props.onConfirm());
  await settle();
};

const trash = (renderer, name) =>
  renderer.root
    .findAllByType(TouchableOpacity)
    .filter(node => node.props.accessibilityLabel === `Delete ${name}`);
const tapTrash = async (renderer, name) => {
  // Not awaited: the tap's own request may stay pending on purpose.
  await act(async () => {
    trash(renderer, name)[0].props.onPress();
  });
  await settle();
};

async function render(element) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>{element}</ThemeProvider>,
    );
  });
  await settle();
  return renderer;
}
const usersTab = () => render(<ManageUsersScreen />);

async function venueScreen() {
  const listeners = [];
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn((event, fn) => {
      listeners.push(fn);
      return () => {};
    }),
  };
  const renderer = await render(
    <AdminVenueScreen
      navigation={navigation}
      route={{ params: { userId: 20, venueName: 'Arena 71' } }}
    />,
  );
  await act(async () => listeners.forEach(fn => fn()));
  await settle();
  return { renderer, navigation };
}
const tapDeleteVenue = async renderer => {
  const button = renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Delete venue' &&
      typeof node.props.style === 'function',
  )[0];
  await act(async () => {
    button.props.onPress();
  });
  await settle();
};

// FlatList updates itself on a timer, which React reports as "not wrapped in act(...)".
// That message is noise here; every other error still shows.
const realConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    realConsoleError(...args);
  });
});
afterAll(() => console.error.mockRestore());

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  api.delete.mockReset();
  api.delete.mockResolvedValue({ data: {} });
  replies = {
    '/admin/users': [KARIM, ARENA, ADMIN],
    '/admin/indoors': [VENUE],
    '/admin/users/10/deletion-preview': CAPTAIN,
    '/admin/users/20/deletion-preview': OWNER,
    '/admin/indoors/20/deletion-preview': OWNER,
  };
  api.get.mockReset();
  api.get.mockImplementation(async path => {
    const reply = replies[path];
    if (reply instanceof Error) throw reply;
    return { data: typeof reply === 'function' ? await reply() : reply };
  });
});

describe('The sentences for the admin', () => {
  test('each team in the third person, then the venue', () => {
    expect(outcomesForAdmin(CAPTAIN)).toEqual([
      {
        key: 9,
        icon: 'delete',
        text: "Mirpur Mavericks will be deleted (they're the only member)",
      },
      {
        key: 7,
        icon: 'transfer',
        text: 'Dhanmondi Strikers will be handed to Rahim',
      },
    ]);
    expect(outcomesForAdmin(OWNER)).toEqual([
      {
        key: 'venue',
        icon: 'venue',
        text: 'The venue listing will be removed',
      },
    ]);
    expect(outcomesForAdmin(NOTHING)).toEqual([]);
  });
});

describe('Users tab', () => {
  test('players and owners have a trash button, the admin has none (P21)', async () => {
    const renderer = await usersTab();
    expect(trash(renderer, 'Karim')).toHaveLength(1);
    expect(trash(renderer, 'Arena 71')).toHaveLength(1);
    expect(shownText(renderer)).toContain('Admin');
    expect(trash(renderer, 'Admin')).toHaveLength(0);
  });

  test('the dialog opens only once the preview has loaded; meanwhile the button spins', async () => {
    let finish;
    replies['/admin/users/10/deletion-preview'] = () =>
      new Promise(resolve => {
        finish = resolve;
      });
    const renderer = await usersTab();
    await tapTrash(renderer, 'Karim');

    expect(openDialog(renderer)).toBeUndefined();
    expect(trash(renderer, 'Karim')[0].props.disabled).toBe(true);
    // A second tap, on any row, starts nothing more.
    await tapTrash(renderer, 'Karim');
    await tapTrash(renderer, 'Arena 71');
    expect(previewCalls()).toHaveLength(1);

    await act(async () => finish(CAPTAIN));
    await settle();
    expect(trash(renderer, 'Karim')[0].props.disabled).toBe(false);
    const dialog = openDialog(renderer);
    expect(dialog.props).toMatchObject({
      title: 'Delete Karim?',
      message: DELETE_MESSAGE,
      confirmTitle: 'Delete account',
      destructive: true,
    });
    expect(dialogRows(renderer)).toEqual([
      ['delete', "Mirpur Mavericks will be deleted (they're the only member)"],
      ['transfer', 'Dhanmondi Strikers will be handed to Rahim'],
    ]);
    expect(api.delete).not.toHaveBeenCalled();
  });

  test('an owner gets the venue line; someone with no teams and no venue gets no lines', async () => {
    const renderer = await usersTab();
    await tapTrash(renderer, 'Arena 71');
    expect(dialogRows(renderer)).toEqual([
      ['venue', 'The venue listing will be removed'],
    ]);
    await act(async () => openDialog(renderer).props.onCancel());

    replies['/admin/users/10/deletion-preview'] = NOTHING;
    await tapTrash(renderer, 'Karim');
    expect(dialogRows(renderer)).toEqual([]);
    expect(shownText(renderer)).not.toContain('teams and memberships');
  });

  test('a preview that cannot be loaded: an alert, no dialog, and the button works again', async () => {
    replies['/admin/users/10/deletion-preview'] = noConnection();
    const renderer = await usersTab();
    await tapTrash(renderer, 'Karim');
    expect(Alert.alert).toHaveBeenCalledWith('Not loaded', PREVIEW_FAILED);
    expect(openDialog(renderer)).toBeUndefined();

    replies['/admin/users/10/deletion-preview'] = CAPTAIN;
    await tapTrash(renderer, 'Karim');
    expect(openDialog(renderer)).toBeDefined();
  });

  test("a refused preview shows the backend's message; one for an account that is gone reloads the list", async () => {
    replies['/admin/users/10/deletion-preview'] = httpError(
      403,
      'Not allowed.',
    );
    const renderer = await usersTab();
    await tapTrash(renderer, 'Karim');
    expect(Alert.alert).toHaveBeenLastCalledWith('Not loaded', 'Not allowed.');

    replies['/admin/users/10/deletion-preview'] = httpError(
      404,
      'User not found',
    );
    replies['/admin/users'] = [ARENA, ADMIN];
    await tapTrash(renderer, 'Karim');
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Something changed',
      'User not found',
    );
    expect(openDialog(renderer)).toBeUndefined();
    expect(shownText(renderer)).not.toContain('Karim');
  });

  test('confirming sends the code once, then reloads the list', async () => {
    let finish;
    api.delete.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const renderer = await usersTab();
    await tapTrash(renderer, 'Karim');
    const { onConfirm } = openDialog(renderer).props;
    await act(async () => {
      onConfirm();
      onConfirm();
    });
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledWith('/admin/users/10', {
      params: { previewCode: CODE },
    });
    expect(openDialog(renderer).props.loading).toBe(true);

    replies['/admin/users'] = [ARENA, ADMIN];
    await act(async () => finish({ data: {} }));
    await settle();
    expect(openDialog(renderer)).toBeUndefined();
    expect(shownText(renderer)).not.toContain('Karim');
    expect(Alert.alert.mock.calls).toEqual([
      ['Deleted', 'User deleted successfully.'],
    ]);
  });

  test('Cancel deletes nothing', async () => {
    const renderer = await usersTab();
    await tapTrash(renderer, 'Karim');
    await act(async () => openDialog(renderer).props.onCancel());
    expect(openDialog(renderer)).toBeUndefined();
    expect(api.delete).not.toHaveBeenCalled();
  });

  test('"Something changed" (409) shows the new outcome in the dialog, and the next confirm sends the new code', async () => {
    const message =
      "Something changed in this user's teams. Check what will happen and try again.";
    const renderer = await usersTab();
    await tapTrash(renderer, 'Karim');
    api.delete.mockRejectedValueOnce(httpError(409, message));
    replies['/admin/users/10/deletion-preview'] = {
      ...CAPTAIN,
      previewCode: NEW_CODE,
      captainedTeams: [{ ...KEPT, newCaptain: { id: 40, name: 'Tanvir' } }],
    };
    await confirm(renderer);

    expect(Alert.alert.mock.calls).toEqual([['Something changed', message]]);
    expect(dialogRows(renderer)).toEqual([
      ['transfer', 'Dhanmondi Strikers will be handed to Tanvir'],
    ]);
    expect(openDialog(renderer).props.loading).toBe(false);

    await confirm(renderer);
    expect(api.delete).toHaveBeenLastCalledWith('/admin/users/10', {
      params: { previewCode: NEW_CODE },
    });
    expect(openDialog(renderer)).toBeUndefined();
  });

  test('a 409 whose new outcome cannot be loaded closes the dialog', async () => {
    const renderer = await usersTab();
    await tapTrash(renderer, 'Karim');
    api.delete.mockRejectedValueOnce(httpError(409, 'Something changed.'));
    replies['/admin/users/10/deletion-preview'] = noConnection();
    await confirm(renderer);
    expect(openDialog(renderer)).toBeUndefined();
    expect(Alert.alert.mock.calls).toEqual([['Not loaded', PREVIEW_FAILED]]);
  });

  test('a delete that fails closes the dialog and keeps the user in the list', async () => {
    const renderer = await usersTab();
    for (const [error, alert] of [
      [noConnection(), ['Error', 'Something went wrong. Please try again.']],
      [httpError(403, 'Not allowed.'), ['Error', 'Not allowed.']],
      [
        httpError(404, 'User not found'),
        ['Something changed', 'User not found'],
      ],
    ]) {
      Alert.alert.mockClear();
      api.delete.mockRejectedValueOnce(error);
      await tapTrash(renderer, 'Karim');
      await confirm(renderer);
      expect(Alert.alert.mock.calls).toEqual([alert]);
      expect(openDialog(renderer)).toBeUndefined();
      expect(shownText(renderer)).toContain('Karim');
    }
  });
});

describe('Venue review: Delete venue', () => {
  test('loads the preview, shows the venue line, and deletes with the code', async () => {
    const { renderer, navigation } = await venueScreen();
    await tapDeleteVenue(renderer);

    expect(previewCalls()).toEqual([['/admin/indoors/20/deletion-preview']]);
    expect(openDialog(renderer).props).toMatchObject({
      title: 'Delete Arena 71?',
      message: DELETE_MESSAGE,
      confirmTitle: 'Delete venue',
      destructive: true,
    });
    expect(dialogRows(renderer)).toEqual([
      ['venue', 'The venue listing will be removed'],
    ]);
    await confirm(renderer);
    expect(api.delete).toHaveBeenCalledWith('/admin/indoors/20', {
      params: { previewCode: CODE },
    });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  test('a preview that cannot be loaded: an alert and no dialog', async () => {
    replies['/admin/indoors/20/deletion-preview'] = noConnection();
    const { renderer } = await venueScreen();
    await tapDeleteVenue(renderer);
    expect(Alert.alert).toHaveBeenCalledWith('Not loaded', PREVIEW_FAILED);
    expect(openDialog(renderer)).toBeUndefined();
  });

  test('a 409 shows the new outcome and stays on the screen', async () => {
    const { renderer, navigation } = await venueScreen();
    await tapDeleteVenue(renderer);
    api.delete.mockRejectedValueOnce(httpError(409, 'Something changed.'));
    await confirm(renderer);
    expect(Alert.alert.mock.calls).toEqual([
      ['Something changed', 'Something changed.'],
    ]);
    expect(openDialog(renderer)).toBeDefined();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  test('the owner deleted the account meanwhile (404): the screen says the venue is gone', async () => {
    const { renderer, navigation } = await venueScreen();
    await tapDeleteVenue(renderer);
    api.delete.mockRejectedValueOnce(httpError(404, 'Venue not found'));
    replies['/admin/indoors'] = [];
    await confirm(renderer);
    expect(Alert.alert.mock.calls).toEqual([
      ['Something changed', 'Venue not found'],
    ]);
    expect(shownText(renderer)).toContain(
      "This venue isn't available any more.",
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
