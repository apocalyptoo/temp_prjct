/* eslint-env jest */
// Tests for the team form (feature 1, docs/features/team-membership.md, section e,
// "Create team and Edit team"; the Area field: docs/features/explore.md, section e):
// create vs edit, the limits counted in code points, the Area field with its suggestions,
// what gets sent, and where the screen goes afterwards.

import React from 'react';
import { Alert, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import TeamFormScreen, {
  TEAM_AREA_HELPER,
  checkTeamForm,
  teamFormBody,
} from '../src/screens/Team/TeamFormScreen';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);

async function render(params) {
  const navigation = {
    goBack: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  };
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <TeamFormScreen route={{ params }} navigation={navigation} />
      </ThemeProvider>,
    );
  });
  return { renderer, navigation };
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

// The fields in screen order: Team name, Area, Description.
const NAME = 0;
const AREA = 1;
const DESCRIPTION = 2;
const inputs = renderer => renderer.root.findAllByType(TextInput);
const type = (renderer, index, text) =>
  act(async () => inputs(renderer)[index].props.onChangeText(text));
const focus = (renderer, index) =>
  act(async () => inputs(renderer)[index].props.onFocus());
const press = async (renderer, label) => {
  const node = renderer.root.find(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.style === 'function' &&
      typeof n.props.onPress === 'function',
  );
  await act(async () => node.props.onPress());
  await settle();
};

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('The limits (the same as the backend, counted in code points)', () => {
  const emoji = '\u{1F600}';
  const bangla = 'ক';

  test.each([
    ['', 'Team name is required'],
    ['   ', 'Team name is required'],
    ['A', 'Team name must be between 2 and 40 characters'],
    ['A'.repeat(41), 'Team name must be between 2 and 40 characters'],
    [emoji.repeat(41), 'Team name must be between 2 and 40 characters'],
  ])('name %j: %s', (name, message) => {
    expect(checkTeamForm(name, '').nameError).toBe(message);
  });

  test('2 and 40 characters are fine, an emoji counts once, spaces at the ends do not count', () => {
    expect(checkTeamForm('AB', '').nameError).toBeNull();
    expect(checkTeamForm(emoji.repeat(40), '').nameError).toBeNull();
    expect(checkTeamForm(`  ${'A'.repeat(40)}  `, '').nameError).toBeNull();
  });

  test('description: at most 200 characters, counted in code points', () => {
    expect(
      checkTeamForm('Fine', bangla.repeat(200)).descriptionError,
    ).toBeNull();
    expect(
      checkTeamForm('Fine', emoji.repeat(200)).descriptionError,
    ).toBeNull();
    expect(checkTeamForm('Fine', 'x'.repeat(201)).descriptionError).toBe(
      'Description must be at most 200 characters',
    );
  });

  test.each([
    ['', null],
    ['   ', null],
    ['Mirpur', null],
    ['ab', null],
    [`  ${'a'.repeat(40)}  `, null],
    [emoji.repeat(40), null],
    ['A', 'Area must be between 2 and 40 characters'],
    ['  A  ', 'Area must be between 2 and 40 characters'],
    ['a'.repeat(41), 'Area must be between 2 and 40 characters'],
    [emoji.repeat(41), 'Area must be between 2 and 40 characters'],
  ])('area %j: %s (the player Area rules)', (area, message) => {
    expect(checkTeamForm('Fine', '', area).areaError).toBe(message);
  });

  test('the body: all three fields, the area tidied, a blank area as null', () => {
    expect(teamFormBody('FC', 'Crew', '  Dhanmondi \t 27 ')).toEqual({
      name: 'FC',
      description: 'Crew',
      area: 'Dhanmondi 27',
    });
    expect(teamFormBody('FC', '', '   ').area).toBeNull();
    expect(teamFormBody('FC', '', 'mirpur').area).toBe('mirpur');
  });
});

describe('Create mode', () => {
  test('title, empty fields, helpers and the Create team button', async () => {
    const { renderer } = await render(undefined);
    const text = shownText(renderer);

    expect(text).toContain('Create team');
    expect(text).toContain('Team name');
    expect(text).toContain('2–40 characters');
    expect(text).toContain('Up to 200 characters');
    expect(text).toContain('Area (optional)');
    expect(text).toContain(TEAM_AREA_HELPER);
    expect(TEAM_AREA_HELPER).toBe(
      'Where your team usually plays, like Mirpur. Players search by it.',
    );
    expect(inputs(renderer).map(i => i.props.accessibilityLabel)).toEqual([
      'Team name',
      'Area (optional)',
      'Description (optional)',
    ]);
    expect(inputs(renderer).map(i => i.props.value)).toEqual(['', '', '']);
  });

  test('"mir" in Area suggests Mirpur; tapping it fills the field', async () => {
    const { renderer } = await render(undefined);
    await focus(renderer, AREA);
    await type(renderer, AREA, 'mir');

    expect(shownText(renderer)).toContain('Mirpur');
    const suggestion = renderer.root.find(
      n =>
        n.props.accessibilityLabel === 'Suggestion: Mirpur' &&
        typeof n.props.onPress === 'function',
    );
    await act(async () => suggestion.props.onPress());

    expect(inputs(renderer)[AREA].props.value).toBe('Mirpur');
  });

  test('an area that is too short shows under the field and nothing is sent; typing clears it', async () => {
    const { renderer } = await render(undefined);
    await type(renderer, NAME, 'Dhanmondi Strikers');
    await type(renderer, AREA, ' M ');

    await press(renderer, 'Create team');

    expect(shownText(renderer)).toContain(
      'Area must be between 2 and 40 characters',
    );
    expect(api.post).not.toHaveBeenCalled();

    await type(renderer, AREA, 'Mi');
    expect(shownText(renderer)).not.toContain(
      'Area must be between 2 and 40 characters',
    );
  });

  test('a problem shows under the field and nothing is sent', async () => {
    const { renderer } = await render(undefined);
    await type(renderer, NAME, 'A');

    await press(renderer, 'Create team');

    expect(shownText(renderer)).toContain(
      'Team name must be between 2 and 40 characters',
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  test('typing in the field clears its error', async () => {
    const { renderer } = await render(undefined);
    await press(renderer, 'Create team');
    expect(shownText(renderer)).toContain('Team name is required');

    await type(renderer, NAME, 'Dhanmondi Strikers');

    expect(shownText(renderer)).not.toContain('Team name is required');
  });

  test('creates the team, then Team detail replaces the form', async () => {
    api.post.mockResolvedValue({
      data: { id: 42, name: 'Dhanmondi Strikers' },
    });
    const { renderer, navigation } = await render(undefined);
    await type(renderer, NAME, 'Dhanmondi Strikers');
    await type(renderer, DESCRIPTION, 'Weekend crew');

    await press(renderer, 'Create team');

    expect(api.post).toHaveBeenCalledWith('/teams/create', {
      name: 'Dhanmondi Strikers',
      description: 'Weekend crew',
      area: null,
    });
    expect(navigation.replace).toHaveBeenCalledWith('TeamDetail', {
      teamId: 42,
    });
  });

  test('creates the team with its area, tidied', async () => {
    api.post.mockResolvedValue({ data: { id: 42 } });
    const { renderer } = await render(undefined);
    await type(renderer, NAME, 'Mirpur Mavericks');
    await type(renderer, AREA, '  Mirpur   10 ');

    await press(renderer, 'Create team');

    expect(api.post).toHaveBeenCalledWith('/teams/create', {
      name: 'Mirpur Mavericks',
      description: '',
      area: 'Mirpur 10',
    });
  });

  test('the backend refusing shows its message and keeps the form', async () => {
    api.post.mockRejectedValue(httpError(400, 'Team name must be text'));
    const { renderer, navigation } = await render(undefined);
    await type(renderer, NAME, 'Fine Name');

    await press(renderer, 'Create team');

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Team name must be text');
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(inputs(renderer)[NAME].props.value).toBe('Fine Name');
  });
});

describe('Edit mode', () => {
  const PARAMS = {
    teamId: 7,
    teamName: 'Dhanmondi Strikers',
    description: 'Weekend crew',
    area: 'Dhanmondi',
  };

  test('title, back link to the team, the fields filled in and Save changes', async () => {
    const { renderer } = await render(PARAMS);

    expect(shownText(renderer)).toContain('Edit team');
    expect(inputs(renderer).map(i => i.props.value)).toEqual([
      'Dhanmondi Strikers',
      'Dhanmondi',
      'Weekend crew',
    ]);
    expect(
      renderer.root.findAll(
        n => n.props.accessibilityLabel === 'Back to Dhanmondi Strikers',
      ).length,
    ).toBeGreaterThan(0);
  });

  test('a team with no description or area starts with empty fields', async () => {
    const { renderer } = await render({
      ...PARAMS,
      description: null,
      area: null,
    });
    expect(inputs(renderer)[DESCRIPTION].props.value).toBe('');
    expect(inputs(renderer)[AREA].props.value).toBe('');

    const noParam = await render({ teamId: 7, teamName: 'FC' });
    expect(inputs(noParam.renderer)[AREA].props.value).toBe('');
  });

  test('saves all three fields with PATCH, then goes back', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const { renderer, navigation } = await render(PARAMS);
    await type(renderer, NAME, 'Mirpur Mavericks');
    await type(renderer, AREA, 'Mirpur');
    await type(renderer, DESCRIPTION, '');

    await press(renderer, 'Save changes');

    expect(api.patch).toHaveBeenCalledWith('/teams/7', {
      name: 'Mirpur Mavericks',
      description: '',
      area: 'Mirpur',
    });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('clearing the area sends null, which removes it', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const { renderer } = await render(PARAMS);
    await type(renderer, AREA, '  ');

    await press(renderer, 'Save changes');

    expect(api.patch).toHaveBeenCalledWith('/teams/7', {
      name: 'Dhanmondi Strikers',
      description: 'Weekend crew',
      area: null,
    });
  });

  test('the team is gone (404): says so and goes back', async () => {
    api.patch.mockRejectedValue(httpError(404, 'Team not found'));
    const { renderer, navigation } = await render(PARAMS);

    await press(renderer, 'Save changes');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Team not found',
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('no longer the captain (403): an error, and the form stays', async () => {
    api.patch.mockRejectedValue(
      httpError(403, 'Only the team captain can edit this team.'),
    );
    const { renderer, navigation } = await render(PARAMS);

    await press(renderer, 'Save changes');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Only the team captain can edit this team.',
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
