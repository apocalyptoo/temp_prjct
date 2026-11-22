/* eslint-env jest */
// Tests for the admin's venue screens (docs/features/venues.md, sections e and h): the
// Venues tab list and the review screen (approve, the note, move back to review,
// delete).

import React from 'react';
import { Alert, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import AdminVenuesScreen, {
  NO_VENUES,
  WAITING_TITLE,
} from '../src/screens/Admin/AdminVenuesScreen';
import AdminVenueScreen, {
  NOTE_HELPER,
  NOTE_LABEL,
} from '../src/screens/Admin/AdminVenueScreen';
import {
  liveSinceText,
  missingText,
  noteBody,
  noteProblem,
  shortDate,
} from '../src/screens/Admin/adminVenueCommon';
import { ConfirmDialog, Pill } from '../src/components/ui';
import { NOT_ADDED } from '../src/screens/Player/PlayerProfileScreen';
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

// The admin's venue shape (GET /admin/indoors and the action replies).
const venue = fields => ({
  userId: 1,
  indoorName: 'Venue',
  phone: '01712345678',
  address: 'Road 5',
  area: 'Dhanmondi',
  website: null,
  description: null,
  openingHours: null,
  pricingInfo: null,
  approvedAt: null,
  reviewNote: null,
  email: 'owner@gmail.com',
  createdAt: '2026-11-20T10:00:00.000Z',
  verified: true,
  missingFields: [],
  ...fields,
});

// Pending: one complete with a note, one missing two fields with an unverified owner.
const BARNABEU = venue({
  userId: 19034,
  indoorName: 'Barnabeu Arena',
  email: 'barnabeu@gmail.com',
  reviewNote: 'Please add the road number',
  website: 'https://example.com',
  openingHours: 'Sat–Thu 8am–2am\nFri 2pm–2am',
  pricingInfo: '৳2,000 per hour',
  description: 'Two pitches.',
});
const NEWBIE = venue({
  userId: 30,
  indoorName: 'Newbie Courts',
  email: 'newbie@gmail.com',
  area: null,
  phone: null,
  verified: false,
  missingFields: ['area', 'phone'],
});
// Live.
const CAMP = venue({
  userId: 1684,
  indoorName: 'Camp nou',
  area: 'Sylhet',
  approvedAt: '2026-11-23T12:00:00.000Z',
});
const F12 = venue({
  userId: 12207,
  indoorName: 'F12 Test Arena',
  area: 'Dhanmondi',
  approvedAt: '2026-11-23T12:00:00.000Z',
});
const ALL = [BARNABEU, NEWBIE, CAMP, F12];

function navigationMock() {
  const listeners = [];
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn((event, fn) => {
      if (event === 'focus') listeners.push(fn);
      return () => {};
    }),
    focus: () => listeners.forEach(fn => fn()),
  };
}

async function render(element, auth = {}) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={auth}>{element}</AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  return renderer;
}

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

const input = (renderer, label) =>
  renderer.root.find(
    node => node.type === TextInput && node.props.accessibilityLabel === label,
  );
const type = (renderer, label, text) =>
  act(async () => input(renderer, label).props.onChangeText(text));

const tappables = (renderer, label) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.style === 'function' &&
      typeof node.props.onPress === 'function',
  );
const tappable = (renderer, label) => tappables(renderer, label)[0];
const press = async (renderer, label) => {
  await act(async () => tappable(renderer, label).props.onPress());
  await settle();
};
const isDisabled = (renderer, label) =>
  tappable(renderer, label).props.accessibilityState?.disabled === true;

const httpError = (status, body) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: {
      status,
      data: typeof body === 'string' ? { error: body } : body,
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('adminVenueCommon', () => {
  test('missingText names the missing fields in order, or says Complete', () => {
    expect(missingText(['address', 'area', 'phone'])).toBe(
      'Missing: address, area, phone',
    );
    expect(missingText(['phone'])).toBe('Missing: phone');
    expect(missingText([])).toBe('Complete');
  });

  test('the live date reads "23 Nov 2026", whatever the phone language', () => {
    expect(shortDate('2026-11-23T12:00:00.000Z')).toBe('23 Nov 2026');
    expect(shortDate('2027-01-05T12:00:00.000Z')).toBe('5 Jan 2027');
    expect(shortDate('not a date')).toBe('');
    expect(liveSinceText('2026-11-23T12:00:00.000Z')).toBe(
      'Live since 23 Nov 2026',
    );
  });

  test('the note: at most 200 characters after trimming, Bangla counted once each; required only for moving back', () => {
    expect(noteProblem('')).toBeNull();
    expect(noteProblem('   ')).toBeNull();
    expect(noteProblem('   ', { required: true })).toBe(
      'Add a note for the owner',
    );
    expect(noteProblem('ঢ'.repeat(200))).toBeNull();
    expect(noteProblem(` ${'n'.repeat(200)} `)).toBeNull();
    expect(noteProblem('n'.repeat(201))).toBe(
      'Note must be at most 200 characters',
    );
    expect(noteProblem('n'.repeat(201), { required: true })).toBe(
      'Note must be at most 200 characters',
    );
    expect(noteBody('  Fix it  ')).toEqual({ note: 'Fix it' });
    expect(noteBody('  ')).toEqual({ note: null });
  });
});

describe('The admin Venues tab', () => {
  async function showList(venues = ALL) {
    api.get.mockResolvedValue({ data: venues });
    const navigation = navigationMock();
    const renderer = await render(
      <AdminVenuesScreen navigation={navigation} />,
    );
    await act(async () => navigation.focus());
    await settle();
    return { renderer, navigation };
  }

  test('"Waiting for review" with its count comes first, then "Live (n)", in the backend order', async () => {
    const { renderer } = await showList();
    expect(api.get).toHaveBeenCalledWith('/admin/indoors');
    const text = shownText(renderer);
    expect(text).toContain(WAITING_TITLE);
    expect(
      renderer.root.findAllByType(Pill).map(pill => pill.props.label),
    ).toEqual(['2']);
    expect(text).toContain('Live (2)');
    const order = [
      WAITING_TITLE,
      'Barnabeu Arena',
      'Newbie Courts',
      'Live (2)',
      'Camp nou',
      'F12 Test Arena',
    ].map(shown => text.indexOf(shown));
    expect(order.every(position => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test('each pending card shows the area, the owner, "Unverified" and what is missing', async () => {
    const { renderer } = await showList();
    const text = shownText(renderer);
    expect(text).toContain('barnabeu@gmail.com');
    expect(text).not.toContain('barnabeu@gmail.com · Unverified');
    expect(text).toContain('Complete');
    expect(text).toContain('newbie@gmail.com · Unverified');
    expect(text).toContain('Missing: area, phone');
    expect(tappable(renderer, 'Barnabeu Arena, Complete')).toBeDefined();
    expect(
      tappable(renderer, 'Newbie Courts, Missing: area, phone'),
    ).toBeDefined();
  });

  test('tapping a pending card or a live row opens the review screen', async () => {
    const { renderer, navigation } = await showList();
    await press(renderer, 'Newbie Courts, Missing: area, phone');
    expect(navigation.navigate).toHaveBeenLastCalledWith('AdminVenue', {
      userId: 30,
      venueName: 'Newbie Courts',
    });
    await press(renderer, 'Camp nou, Sylhet');
    expect(navigation.navigate).toHaveBeenLastCalledWith('AdminVenue', {
      userId: 1684,
      venueName: 'Camp nou',
    });
  });

  test('nothing waiting: no "Waiting for review" section, only the live list', async () => {
    const { renderer } = await showList([CAMP, F12]);
    expect(shownText(renderer)).not.toContain(WAITING_TITLE);
    expect(shownText(renderer)).toContain('Live (2)');
  });

  test('no venues at all: "No venues yet."', async () => {
    const { renderer } = await showList([]);
    expect(shownText(renderer)).toContain(NO_VENUES);
  });

  test('coming back into view and pull to refresh reload; a failed first load shows Try again', async () => {
    const { renderer, navigation } = await showList([CAMP]);
    api.get.mockResolvedValue({ data: ALL });
    await act(async () => navigation.focus());
    await settle();
    expect(shownText(renderer)).toContain('Barnabeu Arena');
    const scroll = renderer.root.find(
      node => typeof node.props.onRefresh === 'function',
    );
    await act(async () => scroll.props.onRefresh());
    await settle();
    expect(api.get).toHaveBeenCalledTimes(3);

    api.get.mockRejectedValueOnce(new Error('offline'));
    const again = navigationMock();
    const failed = await render(<AdminVenuesScreen navigation={again} />);
    await act(async () => again.focus());
    await settle();
    expect(shownText(failed)).toContain("Couldn't load venues.");
    await press(failed, 'Try again');
    expect(shownText(failed)).toContain('Barnabeu Arena');
  });
});

describe('The admin review screen', () => {
  async function showVenue(target = BARNABEU, list = ALL) {
    api.get.mockResolvedValue({ data: list });
    const navigation = navigationMock();
    const renderer = await render(
      <AdminVenueScreen
        navigation={navigation}
        route={{
          params: { userId: target.userId, venueName: target.indoorName },
        }}
      />,
    );
    await act(async () => navigation.focus());
    await settle();
    return { renderer, navigation };
  }

  test('a pending venue: the full listing, the owner, "Pending review", Approve and the note', async () => {
    const { renderer } = await showVenue();
    expect(api.get).toHaveBeenCalledWith('/admin/indoors');
    const text = shownText(renderer);
    for (const shown of [
      'Venues', // the back link
      'Barnabeu Arena',
      'Pending review',
      "Owner's email",
      'barnabeu@gmail.com',
      'Road 5',
      'Dhanmondi',
      '01712345678',
      'https://example.com',
      'Sat–Thu 8am–2am\nFri 2pm–2am',
      '৳2,000 per hour',
      'Two pitches.',
      NOTE_HELPER,
    ]) {
      expect(text).toContain(shown);
    }
    expect(text).not.toContain('Live since');
    expect(input(renderer, NOTE_LABEL).props.value).toBe(
      'Please add the road number',
    );
    expect(isDisabled(renderer, 'Approve')).toBe(false);
    expect(tappables(renderer, 'Move back to review')).toHaveLength(0);
  });

  test('Approve is disabled with what is missing, and the unverified owner, under it', async () => {
    const { renderer } = await showVenue(NEWBIE);
    expect(isDisabled(renderer, 'Approve')).toBe(true);
    const text = shownText(renderer);
    expect(text).toContain("The owner hasn't verified their email yet");
    expect(text).toContain('Missing: area, phone');
    expect(text).toContain('newbie@gmail.com · Unverified');
    expect(text.split(NOT_ADDED).length - 1).toBe(6);

    const missingOnly = await showVenue(
      venue({
        userId: 31,
        indoorName: 'Half Done',
        area: null,
        missingFields: ['area'],
      }),
      [
        venue({
          userId: 31,
          indoorName: 'Half Done',
          area: null,
          missingFields: ['area'],
        }),
      ],
    );
    expect(isDisabled(missingOnly.renderer, 'Approve')).toBe(true);
    expect(shownText(missingOnly.renderer)).toContain('Missing: area');
    expect(shownText(missingOnly.renderer)).not.toContain(
      "The owner hasn't verified",
    );
  });

  test('Approve sends the request with its loading state, then shows the venue live', async () => {
    let finish;
    api.post.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const { renderer } = await showVenue();
    const button = tappable(renderer, 'Approve');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/admin/indoors/19034/approve');
    expect(tappable(renderer, 'Approve').props.accessibilityState.busy).toBe(
      true,
    );
    // The other buttons wait meanwhile.
    expect(isDisabled(renderer, 'Save note')).toBe(true);
    expect(isDisabled(renderer, 'Delete venue')).toBe(true);

    await act(async () =>
      finish({
        data: {
          ...BARNABEU,
          approvedAt: '2026-11-23T12:00:00.000Z',
          reviewNote: null,
        },
      }),
    );
    await settle();
    const text = shownText(renderer);
    expect(text).toContain('Live since 23 Nov 2026');
    expect(text).not.toContain('Pending review');
    expect(tappables(renderer, 'Approve')).toHaveLength(0);
    expect(tappables(renderer, 'Move back to review')).toHaveLength(1);
  });

  test('a 409 on approve (the venue changed) alerts "Something changed" with the message, and reloads', async () => {
    api.post.mockRejectedValue(
      httpError(409, {
        error: "This venue can't go live yet. Missing: area",
        missingFields: ['area'],
      }),
    );
    const { renderer } = await showVenue();
    const changed = { ...BARNABEU, area: null, missingFields: ['area'] };
    api.get.mockResolvedValue({ data: [changed] });
    await press(renderer, 'Approve');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      "This venue can't go live yet. Missing: area",
    );
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(isDisabled(renderer, 'Approve')).toBe(true);
    expect(shownText(renderer)).toContain('Missing: area');
  });

  test('Save note sends the trimmed note, replaces it, and an empty note clears it', async () => {
    const { renderer } = await showVenue();
    api.put.mockResolvedValueOnce({
      data: { ...BARNABEU, reviewNote: 'Add the road number, please' },
    });
    await type(renderer, NOTE_LABEL, '  Add the road number, please  ');
    await press(renderer, 'Save note');
    expect(api.put).toHaveBeenLastCalledWith('/admin/indoors/19034/note', {
      note: 'Add the road number, please',
    });
    expect(input(renderer, NOTE_LABEL).props.value).toBe(
      'Add the road number, please',
    );

    api.put.mockResolvedValueOnce({ data: { ...BARNABEU, reviewNote: null } });
    await type(renderer, NOTE_LABEL, '   ');
    await press(renderer, 'Save note');
    expect(api.put).toHaveBeenLastCalledWith('/admin/indoors/19034/note', {
      note: null,
    });
    expect(input(renderer, NOTE_LABEL).props.value).toBe('');
  });

  test('a note over 200 characters is caught under the field, not sent', async () => {
    const { renderer } = await showVenue();
    await type(renderer, NOTE_LABEL, 'n'.repeat(201));
    await press(renderer, 'Save note');
    expect(api.put).not.toHaveBeenCalled();
    expect(shownText(renderer)).toContain(
      'Note must be at most 200 characters',
    );
    await type(renderer, NOTE_LABEL, 'n'.repeat(200));
    expect(shownText(renderer)).not.toContain(
      'Note must be at most 200 characters',
    );
  });

  test('a live venue: "Live since", no Approve and no note field, but Move back to review', async () => {
    const { renderer } = await showVenue(CAMP);
    const text = shownText(renderer);
    expect(text).toContain('Live since 23 Nov 2026');
    expect(renderer.root.findAllByType(Pill).map(pill => pill.props)).toEqual([
      expect.objectContaining({ label: 'Live', variant: 'strong' }),
    ]);
    expect(tappables(renderer, 'Approve')).toHaveLength(0);
    expect(
      renderer.root.findAll(
        node =>
          node.type === TextInput &&
          node.props.accessibilityLabel === NOTE_LABEL,
      ),
    ).toHaveLength(0);
  });

  test('Move back to review needs a note, asks to confirm, then sends it and shows the venue pending', async () => {
    const { renderer } = await showVenue(CAMP);
    await press(renderer, 'Move back to review');
    // The step: a required note, Cancel and the red button.
    expect(input(renderer, NOTE_LABEL).props.value).toBe('');
    await press(renderer, 'Move back to review');
    expect(shownText(renderer)).toContain('Add a note for the owner');
    expect(api.post).not.toHaveBeenCalled();

    await type(renderer, NOTE_LABEL, '  The venue is closed for renovation ');
    await press(renderer, 'Move back to review');
    const dialog = renderer.root
      .findAllByType(ConfirmDialog)
      .find(node => node.props.visible);
    expect(dialog.props.title).toBe('Move Camp nou back to review?');
    expect(dialog.props.message).toBe(
      "Players won't see it until you approve it again.",
    );
    expect(dialog.props.destructive).toBe(true);
    expect(api.post).not.toHaveBeenCalled();

    api.post.mockResolvedValue({
      data: {
        ...CAMP,
        approvedAt: null,
        reviewNote: 'The venue is closed for renovation',
      },
    });
    await act(async () => dialog.props.onConfirm());
    await settle();
    expect(api.post).toHaveBeenCalledWith(
      '/admin/indoors/1684/move-to-review',
      { note: 'The venue is closed for renovation' },
    );
    expect(shownText(renderer)).toContain('Pending review');
    expect(input(renderer, NOTE_LABEL).props.value).toBe(
      'The venue is closed for renovation',
    );
    expect(
      renderer.root
        .findAllByType(ConfirmDialog)
        .every(node => !node.props.visible),
    ).toBe(true);
  });

  test('Cancel closes the move step without sending anything', async () => {
    const { renderer } = await showVenue(CAMP);
    await press(renderer, 'Move back to review');
    await type(renderer, NOTE_LABEL, 'Not now');
    await press(renderer, 'Cancel');
    expect(
      renderer.root.findAll(
        node =>
          node.type === TextInput &&
          node.props.accessibilityLabel === NOTE_LABEL,
      ),
    ).toHaveLength(0);
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a 409 on move back (already pending) alerts and reloads', async () => {
    const { renderer } = await showVenue(CAMP);
    api.post.mockRejectedValue(
      httpError(409, 'This venue is already waiting for review'),
    );
    await press(renderer, 'Move back to review');
    await type(renderer, NOTE_LABEL, 'Closed');
    await press(renderer, 'Move back to review');
    const dialog = renderer.root
      .findAllByType(ConfirmDialog)
      .find(node => node.props.visible);
    api.get.mockResolvedValue({
      data: [{ ...CAMP, approvedAt: null, reviewNote: 'Other note' }],
    });
    await act(async () => dialog.props.onConfirm());
    await settle();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'This venue is already waiting for review',
    );
    expect(shownText(renderer)).toContain('Pending review');
  });

  test('Delete venue asks first, then deletes and goes back', async () => {
    api.delete.mockResolvedValue({
      data: { message: 'Venue deleted successfully' },
    });
    const { renderer, navigation } = await showVenue();
    await press(renderer, 'Delete venue');
    expect(api.delete).not.toHaveBeenCalled();
    const dialog = renderer.root
      .findAllByType(ConfirmDialog)
      .find(node => node.props.visible);
    expect(dialog.props.title).toBe('Delete Barnabeu Arena?');
    expect(dialog.props.message).toBe(
      "This deletes the owner's account and all its data. It can't be undone.",
    );
    await act(async () => dialog.props.onConfirm());
    await settle();
    expect(api.delete).toHaveBeenCalledWith('/admin/indoors/19034');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('a venue no longer in the list shows "not available any more" with a way back', async () => {
    const { renderer, navigation } = await showVenue(BARNABEU, [CAMP]);
    expect(shownText(renderer)).toContain(
      "This venue isn't available any more.",
    );
    await press(renderer, 'Back to venues');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('a failed first load shows Try again', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const navigation = navigationMock();
    const renderer = await render(
      <AdminVenueScreen
        navigation={navigation}
        route={{ params: { userId: 19034, venueName: 'Barnabeu Arena' } }}
      />,
    );
    api.get.mockResolvedValue({ data: ALL });
    await act(async () => navigation.focus());
    await settle();
    expect(shownText(renderer)).toContain("Couldn't load this venue.");
    expect(shownText(renderer)).toContain('Barnabeu Arena'); // from the route
    await press(renderer, 'Try again');
    expect(shownText(renderer)).toContain('Pending review');
  });
});
