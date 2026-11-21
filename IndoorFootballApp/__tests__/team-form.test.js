/* eslint-env jest */
// Tests for the team form (feature 1, docs/features/team-membership.md, section e,
// "Create team and Edit team"): create vs edit, the limits counted in code points, what
// gets sent, and where the screen goes afterwards.

import React from 'react';
import { Alert, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import TeamFormScreen, {
  checkTeamForm,
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

const inputs = renderer => renderer.root.findAllByType(TextInput);
const type = (renderer, index, text) =>
  act(async () => inputs(renderer)[index].props.onChangeText(text));
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
});

describe('Create mode', () => {
  test('title, empty fields, helpers and the Create team button', async () => {
    const { renderer } = await render(undefined);
    const text = shownText(renderer);

    expect(text).toContain('Create team');
    expect(text).toContain('Team name');
    expect(text).toContain('2–40 characters');
    expect(text).toContain('Up to 200 characters');
    expect(inputs(renderer).map(i => i.props.value)).toEqual(['', '']);
  });

  test('a problem shows under the field and nothing is sent', async () => {
    const { renderer } = await render(undefined);
    await type(renderer, 0, 'A');

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

    await type(renderer, 0, 'Dhanmondi Strikers');

    expect(shownText(renderer)).not.toContain('Team name is required');
  });

  test('creates the team, then Team detail replaces the form', async () => {
    api.post.mockResolvedValue({
      data: { id: 42, name: 'Dhanmondi Strikers' },
    });
    const { renderer, navigation } = await render(undefined);
    await type(renderer, 0, 'Dhanmondi Strikers');
    await type(renderer, 1, 'Weekend crew');

    await press(renderer, 'Create team');

    expect(api.post).toHaveBeenCalledWith('/teams/create', {
      name: 'Dhanmondi Strikers',
      description: 'Weekend crew',
    });
    expect(navigation.replace).toHaveBeenCalledWith('TeamDetail', {
      teamId: 42,
    });
  });

  test('the backend refusing shows its message and keeps the form', async () => {
    api.post.mockRejectedValue(httpError(400, 'Team name must be text'));
    const { renderer, navigation } = await render(undefined);
    await type(renderer, 0, 'Fine Name');

    await press(renderer, 'Create team');

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Team name must be text');
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(inputs(renderer)[0].props.value).toBe('Fine Name');
  });
});

describe('Edit mode', () => {
  const PARAMS = {
    teamId: 7,
    teamName: 'Dhanmondi Strikers',
    description: 'Weekend crew',
  };

  test('title, back link to the team, the fields filled in and Save changes', async () => {
    const { renderer } = await render(PARAMS);

    expect(shownText(renderer)).toContain('Edit team');
    expect(inputs(renderer).map(i => i.props.value)).toEqual([
      'Dhanmondi Strikers',
      'Weekend crew',
    ]);
    expect(
      renderer.root.findAll(
        n => n.props.accessibilityLabel === 'Back to Dhanmondi Strikers',
      ).length,
    ).toBeGreaterThan(0);
  });

  test('a team with no description starts with an empty field', async () => {
    const { renderer } = await render({ ...PARAMS, description: null });

    expect(inputs(renderer)[1].props.value).toBe('');
  });

  test('saves both fields with PATCH, then goes back', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const { renderer, navigation } = await render(PARAMS);
    await type(renderer, 0, 'Mirpur Mavericks');
    await type(renderer, 1, '');

    await press(renderer, 'Save changes');

    expect(api.patch).toHaveBeenCalledWith('/teams/7', {
      name: 'Mirpur Mavericks',
      description: '',
    });
    expect(navigation.goBack).toHaveBeenCalled();
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
