// Create a team, or edit its name, area and description (docs/features/team-membership.md,
// section e, "Create team and Edit team"; the area: docs/features/explore.md, section e).
// One screen, two routes:
// - CreateTeam (no params): POST /teams/create, then Team detail replaces the form.
// - EditTeam ({ teamId, teamName, description, area }): PATCH /teams/:teamId, then back.
// The same limits as the backend (createTeamSchema), counted in characters as people
// see them, are checked before sending; the messages are the backend's own words.
// All three fields are sent every time (explore spec P12): an empty area clears it.
import React, { useState } from 'react';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Screen,
  ScreenHeader,
  SuggestionField,
  TextField,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import { suggestAreas } from '../../constants/areas';
import { areaProblem, tidyArea } from '../Player/profileChecks';
import { charCount, showActionError } from './teamCommon';

export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 40;
export const TEAM_DESCRIPTION_MAX = 200;
export const TEAM_AREA_HELPER =
  'Where your team usually plays, like Mirpur. Players search by it.';

// The first problem with each field, or null. The area follows the player Area's rules
// (tidied, 2–40 characters, blank means none).
export function checkTeamForm(name, description, area = '') {
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
  const areaError = areaProblem(area);
  return { nameError, descriptionError, areaError };
}

// The request body: all three fields, the area tidied, or null when blank.
export function teamFormBody(name, description, area) {
  const tidied = tidyArea(area);
  return { name, description, area: tidied === '' ? null : tidied };
}

export default function TeamFormScreen({ route, navigation }) {
  const editing = route.params?.teamId !== undefined;
  const {
    teamId,
    teamName = '',
    description: oldDescription,
    area: oldArea,
  } = route.params ?? {};
  const { spacing } = useTheme();
  const [name, setName] = useState(editing ? teamName : '');
  const [description, setDescription] = useState(
    editing ? oldDescription ?? '' : '',
  );
  const [area, setArea] = useState(editing ? oldArea ?? '' : '');
  const [errors, setErrors] = useState({});
  const { run, busy: saving } = useBusyAction();

  const save = () =>
    run(async () => {
      const found = checkTeamForm(name, description, area);
      setErrors(found);
      if (found.nameError || found.descriptionError || found.areaError) return;
      const body = teamFormBody(name, description, area);

      try {
        if (editing) {
          await api.patch(`/teams/${teamId}`, body);
          navigation.goBack(); // Team detail reloads with the new details.
        } else {
          const res = await api.post('/teams/create', body);
          // The form is done: the new team's page takes its place, so Back goes to
          // My Teams.
          navigation.replace('TeamDetail', { teamId: res.data.id });
        }
      } catch (err) {
        // Editing a team that's gone (404): say so and go back; Team detail then
        // finds out too. Anything else (for example a name the backend refuses): an
        // alert with its message, and the form stays.
        showActionError(err, {
          onStale: editing ? () => navigation.goBack() : undefined,
        });
      }
    });

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
      <SuggestionField
        label="Area (optional)"
        value={area}
        onChangeText={text => {
          setArea(text);
          if (errors.areaError) setErrors({ ...errors, areaError: null });
        }}
        getSuggestions={suggestAreas}
        helper={TEAM_AREA_HELPER}
        error={errors.areaError}
        disabled={saving}
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
