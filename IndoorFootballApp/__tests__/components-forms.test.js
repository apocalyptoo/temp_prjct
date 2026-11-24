/* eslint-env jest */
// Tests for the form components added with feature 2 (src/components/ui, DESIGN.md
// section 6): Checkbox, OptionGroup and SuggestionField, and TextField's leading icon
// (added with the venues feature) and its X (added with feature 3b). Their files are also covered by the token guard in
// components-composite.test.js.

import React from 'react';
import { StyleSheet, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { theme } from '../src/theme';
import {
  Checkbox,
  Icon,
  IconButton,
  OptionGroup,
  SuggestionField,
  TextField,
  TextLink,
} from '../src/components/ui';

async function render(element) {
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>{element}</ThemeProvider>,
    );
  });
  return renderer;
}

const act = fn => ReactTestRenderer.act(fn);

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' ');

// Pressables found by role, with their style worked out for "not pressed".
const byRole = (renderer, role) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityRole === role &&
      typeof node.props.style === 'function',
  );
const styleOf = node =>
  StyleSheet.flatten(node.props.style({ pressed: false }));

describe('Checkbox', () => {
  test('is a 44-tall checkbox labelled by its sentence, and says whether it is ticked', async () => {
    const renderer = await render(
      <Checkbox checked={false} onChange={() => {}} label="I agree" />,
    );
    const [box] = byRole(renderer, 'checkbox');
    expect(box.props.accessibilityLabel).toBe('I agree');
    expect(box.props.accessibilityState).toEqual({
      checked: false,
      disabled: false,
    });
    expect(styleOf(box).minHeight).toBeGreaterThanOrEqual(theme.touchTarget);
    expect(renderer.root.findAllByType(Icon)).toHaveLength(0);
  });

  test('tapping calls onChange with the opposite value; ticked shows the check', async () => {
    const onChange = jest.fn();
    const renderer = await render(
      <Checkbox checked onChange={onChange} label="I agree" />,
    );
    const [box] = byRole(renderer, 'checkbox');
    expect(box.props.accessibilityState.checked).toBe(true);
    expect(renderer.root.findAllByType(Icon).map(i => i.props.name)).toEqual([
      'approve',
    ]);
    await act(() => box.props.onPress());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('links under the label stay separately tappable and do not toggle the box', async () => {
    const onChange = jest.fn();
    const openTerms = jest.fn();
    const renderer = await render(
      <Checkbox checked={false} onChange={onChange} label="I agree">
        <TextLink title="Terms of Use" onPress={openTerms} />
      </Checkbox>,
    );
    const [link] = byRole(renderer, 'link');
    await act(() => link.props.onPress());
    expect(openTerms).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('shows its error with the warning icon and reads it with the box', async () => {
    const renderer = await render(
      <Checkbox
        checked={false}
        onChange={() => {}}
        label="I agree"
        error="Please accept the Terms of Use and Privacy Policy"
      />,
    );
    expect(shownText(renderer)).toContain(
      'Please accept the Terms of Use and Privacy Policy',
    );
    expect(renderer.root.findAllByType(Icon).map(i => i.props.name)).toContain(
      'warning',
    );
    expect(byRole(renderer, 'checkbox')[0].props.accessibilityHint).toBe(
      'Please accept the Terms of Use and Privacy Policy',
    );
  });

  test('disabled: says so and ignores taps', async () => {
    const onChange = jest.fn();
    const renderer = await render(
      <Checkbox checked={false} onChange={onChange} label="I agree" disabled />,
    );
    const [box] = byRole(renderer, 'checkbox');
    expect(box.props.accessibilityState.disabled).toBe(true);
    await act(() => box.props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('OptionGroup', () => {
  const POSITIONS = ['Goalkeeper', 'Defender', 'Forward'];

  test('a labelled radiogroup with one 44-tall radio per option', async () => {
    const renderer = await render(
      <OptionGroup label="Position" options={POSITIONS} value={null} />,
    );
    const group = renderer.root.find(
      node => node.props.accessibilityRole === 'radiogroup',
    );
    expect(group.props.accessibilityLabel).toBe('Position');
    const radios = byRole(renderer, 'radio');
    expect(radios.map(r => r.props.accessibilityLabel)).toEqual(POSITIONS);
    for (const radio of radios) {
      expect(styleOf(radio).minHeight).toBeGreaterThanOrEqual(
        theme.touchTarget,
      );
      expect(radio.props.accessibilityState.selected).toBe(false);
    }
  });

  test('the chosen option is selected and drawn in the accent colour', async () => {
    const renderer = await render(
      <OptionGroup label="Position" options={POSITIONS} value="Defender" />,
    );
    const radios = byRole(renderer, 'radio');
    const chosen = radios.find(r => r.props.accessibilityLabel === 'Defender');
    const other = radios.find(r => r.props.accessibilityLabel === 'Forward');
    expect(chosen.props.accessibilityState.selected).toBe(true);
    expect(styleOf(chosen).backgroundColor).toBe(theme.colors.accent);
    expect(styleOf(other).backgroundColor).toBe(theme.colors.surface);
  });

  test('tapping an option calls onChange with its value; { value, label } options work too', async () => {
    const onChange = jest.fn();
    const renderer = await render(
      <OptionGroup
        label="Pick"
        options={[{ value: 'gk', label: 'Goalkeeper' }]}
        value={null}
        onChange={onChange}
      />,
    );
    await act(() => byRole(renderer, 'radio')[0].props.onPress());
    expect(onChange).toHaveBeenCalledWith('gk');
  });

  test('shows its error with the warning icon', async () => {
    const renderer = await render(
      <OptionGroup
        label="Position"
        options={POSITIONS}
        value={null}
        error="Choose a position"
      />,
    );
    expect(shownText(renderer)).toContain('Choose a position');
    expect(renderer.root.findAllByType(Icon).map(i => i.props.name)).toContain(
      'warning',
    );
  });

  test('disabled: says so and ignores taps', async () => {
    const onChange = jest.fn();
    const renderer = await render(
      <OptionGroup
        label="Position"
        options={POSITIONS}
        value={null}
        onChange={onChange}
        disabled
      />,
    );
    const radio = byRole(renderer, 'radio')[0];
    expect(radio.props.accessibilityState.disabled).toBe(true);
    await act(() => radio.props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SuggestionField', () => {
  const NAMES = ['Mirpur', 'Mohammadpur', 'Motijheel'];
  const contains = text =>
    text ? NAMES.filter(n => n.toLowerCase().includes(text.toLowerCase())) : [];

  // A stand-in screen that keeps the value, like a real form.
  function Form({ initial = '' }) {
    const [value, setValue] = React.useState(initial);
    return (
      <SuggestionField
        label="Area"
        value={value}
        onChangeText={setValue}
        getSuggestions={contains}
      />
    );
  }

  const input = renderer => renderer.root.findByType(TextInput);
  const suggestionRows = renderer =>
    byRole(renderer, 'button').filter(node =>
      String(node.props.accessibilityLabel).startsWith('Suggestion: '),
    );

  test('suggestions show only while the field is focused', async () => {
    const renderer = await render(<Form initial="pur" />);
    expect(suggestionRows(renderer)).toHaveLength(0);
    await act(() => input(renderer).props.onFocus());
    expect(
      suggestionRows(renderer).map(r => r.props.accessibilityLabel),
    ).toEqual(['Suggestion: Mirpur', 'Suggestion: Mohammadpur']);
    await act(() => input(renderer).props.onBlur());
    expect(suggestionRows(renderer)).toHaveLength(0);
  });

  test('each row is at least 44 tall; tapping one fills the field', async () => {
    const renderer = await render(<Form initial="mo" />);
    await act(() => input(renderer).props.onFocus());
    const rows = suggestionRows(renderer);
    for (const row of rows) {
      expect(styleOf(row).minHeight).toBeGreaterThanOrEqual(theme.touchTarget);
    }
    await act(() => rows[1].props.onPress());
    expect(input(renderer).props.value).toBe('Motijheel');
  });

  test('a tapped suggestion fills the field, then calls onSuggestionPress with it', async () => {
    const calls = [];
    const renderer = await render(
      <SuggestionField
        label="Area"
        value="mir"
        onChangeText={text => calls.push(['change', text])}
        onSuggestionPress={name => calls.push(['picked', name])}
        getSuggestions={contains}
      />,
    );
    await act(() => input(renderer).props.onFocus());
    await act(() => suggestionRows(renderer)[0].props.onPress());
    expect(calls).toEqual([
      ['change', 'Mirpur'],
      ['picked', 'Mirpur'],
    ]);
    // Typing never calls it.
    await act(() => input(renderer).props.onChangeText('Mirp'));
    expect(calls).toHaveLength(3);
  });

  test('typing updates the suggestions; nothing shows when none match', async () => {
    const renderer = await render(<Form />);
    await act(() => input(renderer).props.onFocus());
    expect(suggestionRows(renderer)).toHaveLength(0);
    await act(() => input(renderer).props.onChangeText('jheel'));
    expect(suggestionRows(renderer)).toHaveLength(1);
    await act(() => input(renderer).props.onChangeText('Uttara'));
    expect(suggestionRows(renderer)).toHaveLength(0);
  });

  test('passes label, helper and error to the text field; disabled shows no suggestions', async () => {
    const renderer = await render(
      <SuggestionField
        label="Area"
        value="pur"
        helper="Not your full address"
        error="Area must be between 2 and 40 characters"
        getSuggestions={contains}
        disabled
      />,
    );
    expect(input(renderer).props.accessibilityLabel).toBe('Area');
    expect(shownText(renderer)).toContain(
      'Area must be between 2 and 40 characters',
    );
    await act(() => input(renderer).props.onFocus());
    expect(suggestionRows(renderer)).toHaveLength(0);
  });
});

describe('TextField icon', () => {
  test('an icon shows muted inside the field, before the text, hidden from screen readers', async () => {
    const renderer = await render(
      <TextField label="Search venues" icon="search" value="" />,
    );
    const icons = renderer.root.findAllByType(Icon);
    expect(icons).toHaveLength(1);
    expect(icons[0].props.name).toBe('search');
    expect(icons[0].props.color).toBe(theme.colors.textMuted);
    expect(icons[0].props.accessibilityLabel).toBeUndefined();
    // The field is still read by its label.
    expect(renderer.root.findByType(TextInput).props.accessibilityLabel).toBe(
      'Search venues',
    );
  });

  test('without an icon there is none', async () => {
    const renderer = await render(<TextField label="Name" value="" />);
    expect(renderer.root.findAllByType(Icon)).toHaveLength(0);
  });
});

describe('TextField onClear', () => {
  const clearButtons = renderer =>
    renderer.root.findAllByType(IconButton).map(b => b.props);
  const field = props => (
    <TextField label="Search teams" value="kings" {...props} />
  );

  test('an X that calls onClear, as big as a finger and named after the field', async () => {
    const onClear = jest.fn();
    const renderer = await render(field({ onClear }));
    const [clear] = clearButtons(renderer);
    expect(clear).toMatchObject({
      icon: 'reject',
      accessibilityLabel: 'Clear Search teams',
    });
    await ReactTestRenderer.act(() => clear.onPress());
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('only while there is text to clear, the field is enabled, and onClear is given', async () => {
    for (const props of [
      { onClear: jest.fn(), value: '' },
      { onClear: jest.fn(), disabled: true },
      {},
    ]) {
      expect(clearButtons(await render(field(props)))).toHaveLength(0);
    }
  });

  test('works through a SuggestionField too', async () => {
    const onClear = jest.fn();
    const renderer = await render(
      <SuggestionField label="Area" value="Mirpur" onClear={onClear} />,
    );
    await ReactTestRenderer.act(() => clearButtons(renderer)[0].onPress());
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
