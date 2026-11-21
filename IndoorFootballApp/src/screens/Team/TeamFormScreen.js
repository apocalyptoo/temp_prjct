// Create a team, or edit its name and description (docs/features/team-membership.md,
// section e, "Create team and Edit team"). One screen, two routes:
// - CreateTeam (no params): POST /teams/create, then Team detail replaces the form.
// - EditTeam ({ teamId, teamName, description }): PATCH /teams/:teamId, then back.
// The same limits as the backend (createTeamSchema), counted in characters as people
// see them, are checked before sending; the messages are the backend's own words.
import React, { useState } from 'react';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Screen, ScreenHeader, TextField } from '../../components/ui';
import { charCount, showActionError } from './teamCommon';

export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 40;
export const TEAM_DESCRIPTION_MAX = 200;

// The first problem with each field, or null.
export function checkTeamForm(name, description) {
  const trimmedName = name.trim();
  let nameError = null;
  if (trimmedName === '') nameError = 'Team name is required';
  else if (
    charCount(trimmedName) < TEAM_NAME_MIN ||
    charCount(trimmedName) > TEAM_NAME_MAX
  ) {
    nameError = `Team name must be between ${TEAM_NAME_MIN} and ${TEAM_NAME_MAX} characters`;
  }
  const descriptionError =
    charCount(description.trim()) > TEAM_DESCRIPTION_MAX
      ? `Description must be at most ${TEAM_DESCRIPTION_MAX} characters`
      : null;
  return { nameError, descriptionError };
}

export default function TeamFormScreen({ route, navigation }) {
  const editing = route.params?.teamId !== undefined;
  const {
    teamId,
    teamName = '',
    description: oldDescription,
  } = route.params ?? {};
  const { spacing } = useTheme();
  const [name, setName] = useState(editing ? teamName : '');
  const [description, setDescription] = useState(
    editing ? oldDescription ?? '' : '',
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const found = checkTeamForm(name, description);
    setErrors(found);
    if (found.nameError || found.descriptionError) return;

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/teams/${teamId}`, { name, description });
        navigation.goBack(); // Team detail reloads with the new details.
      } else {
        const res = await api.post('/teams/create', { name, description });
        // The form is done: the new team's page takes its place, so Back goes to
        // My Teams.
        navigation.replace('TeamDetail', { teamId: res.data.id });
      }
    } catch (err) {
      setSaving(false);
      // Editing a team that's gone (404): say so and go back; Team detail then
      // finds out too. Anything else (for example a name the backend refuses): an
      // alert with its message, and the form stays.
      showActionError(err, {
        onStale: editing ? () => navigation.goBack() : undefined,
      });
    }
  };

  return (
    <Screen
      scroll
      keyboardAware
      style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{
          label: editing ? teamName : 'My Teams',
          onPress: navigation.goBack,
        }}
        title={editing ? 'Edit team' : 'Create team'}
      />
      <TextField
        label="Team name"
        value={name}
        onChangeText={text => {
          setName(text);
          if (errors.nameError) setErrors({ ...errors, nameError: null });
        }}
        helper={`${TEAM_NAME_MIN}–${TEAM_NAME_MAX} characters`}
        error={errors.nameError}
        editable={!saving}
        autoCapitalize="words"
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChangeText={text => {
          setDescription(text);
          if (errors.descriptionError) {
            setErrors({ ...errors, descriptionError: null });
          }
        }}
        helper={`Up to ${TEAM_DESCRIPTION_MAX} characters`}
        error={errors.descriptionError}
        editable={!saving}
        multiline
      />
      <Button
        title={editing ? 'Save changes' : 'Create team'}
        onPress={save}
        loading={saving}
        fullWidth
      />
    </Screen>
  );
}
