// Player detail (docs/features/explore.md, section e, "Player detail"): one player's
// public profile, from GET /players/:id. Opened from a person row on Team detail (and,
// from F3b.4, from Explore → Players). Route params: { userId, playerName } (the name
// shows while the profile loads).
// - A card with the avatar, the name, the position and the area.
// - Details: only the rows that have a value (P23): Height, Weight, and the Phone when
//   the backend sends it (accepted teammates; tapping it calls, with a line saying why
//   it's visible). No card when none of the three is there.
// - Teams: the teams they're an accepted member of, each opening Team detail.
// - "Invite to my team" (P24): for a captain, one row per team they captain, from the
//   reply's inviteOptions, with an Invite button or the reason it can't be sent.
// - Your own profile: a line saying this is how others see you, no Invite card, and
//   your phone shown but not tappable.
// - A 404 (the account is gone): "This player isn't available any more." with Back.
// Loads whenever it comes into view, and on pull to refresh. Team detail and Player
// detail open each other with navigation.push, so a chain goes back one step at a time
// (P30).
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Avatar,
  BackLink,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Pill,
  Screen,
  SectionHeader,
  Text,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import {
  CaptainLabel,
  TeamLoadState,
  showActionError,
} from '../Team/teamCommon';
import { openDialler } from '../Venue/venueCommon';
import { PHONE_HINT } from './PlayerProfileScreen';

export const GONE_MESSAGE = "This player isn't available any more.";
export const TEAMMATE_PHONE_HINT = "You can see this because you're teammates.";
export const OWN_PROFILE_LINE =
  'This is how other players see you. Only your teammates see your phone.';
export const NO_TEAMS = 'Not in a team yet.';

// The back link names the screen underneath where it has a short name.
const BACK_LABELS = {
  MyTeams: 'My Teams',
  Explore: 'Explore',
  Invites: 'Invites',
};
function backLabel(navigation) {
  const state = navigation.getState?.();
  const below = state?.routes?.[state.index - 1]?.name;
  return BACK_LABELS[below] ?? 'Back';
}

const membersText = team => `${team.memberCount} / ${team.maxMembers} members`;

// Why a team in "Invite to my team" can't get an invite, by the backend's state
// (Q5: a player who asked to join is approved on Team detail, not here).
export function inviteReason(option) {
  switch (option.state) {
    case 'member':
      return 'Already a member';
    case 'invited':
      return 'Already invited';
    case 'requested':
      return 'Asked to join';
    case 'full':
      return `Team is full (${option.memberCount}/${option.maxMembers})`;
    default:
      return null;
  }
}

export default function PlayerDetailScreen({ navigation, route }) {
  const { userId, playerName } = route.params;
  const { user } = useContext(AuthContext);
  const { colors, spacing } = useTheme();
  const [player, setPlayer] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | gone
  const [refreshing, setRefreshing] = useState(false);
  // Teams invited from this screen: teamId → "Invited", or "Joined" when the invite
  // approved a join request that had just come in. Cleared by every fresh load, which
  // then shows the backend's own state.
  const [done, setDone] = useState({});
  const { run, isBusy, busy } = useBusyAction();
  const isMe = user?.id === userId;

  // A 404 (even after it was shown) means the player is gone. Any other failure keeps
  // what's shown; only a failed first load shows the error.
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/players/${userId}`);
      setPlayer(res.data);
      setDone({});
      setStatus('ready');
    } catch (err) {
      if (err?.response?.status === 404) {
        setStatus('gone');
        return;
      }
      setStatus(current => (current === 'ready' ? 'ready' : 'error'));
    }
  }, [userId]);

  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = () => {
    setStatus('loading');
    load();
  };

  const invite = option =>
    run(async () => {
      try {
        const res = await api.post(`/teams/${option.teamId}/invite`, {
          userId,
        });
        setDone(current => ({
          ...current,
          [option.teamId]: res.data?.joined ? 'Joined' : 'Invited',
        }));
      } catch (err) {
        const code = err?.response?.status;
        if (code === 400 || code === 404 || code === 409) {
          // Already invited or in the team, gone, or the team filled up: the card is
          // out of date. Say so, then show it as it is now.
          Alert.alert(
            'Something changed',
            err.response.data?.error || 'This is no longer possible.',
          );
          await load();
        } else {
          showActionError(err);
        }
      }
    }, option.teamId);

  const openTeam = teamId => navigation.push('TeamDetail', { teamId });

  const name = player?.playerProfile?.name ?? player?.name ?? playerName;

  let body;
  if (status === 'gone') {
    body = (
      <EmptyState
        message={GONE_MESSAGE}
        actionTitle="Back"
        onAction={navigation.goBack}
      />
    );
  } else if (status !== 'ready') {
    body = (
      <TeamLoadState
        status={status}
        onRetry={retry}
        errorMessage="Couldn't load this player."
      />
    );
  } else {
    body = (
      <>
        <ProfileCard name={name} profile={player.playerProfile} />
        {isMe ? (
          <Text variant="bodySmall" color="textMuted">
            {OWN_PROFILE_LINE}
          </Text>
        ) : null}
        <DetailsCard name={name} profile={player.playerProfile} isMe={isMe} />
        <TeamsCard teams={player.teams ?? []} onOpen={openTeam} />
        {!isMe && player.inviteOptions?.length > 0 ? (
          <InviteCard
            options={player.inviteOptions}
            done={done}
            isBusy={isBusy}
            busy={busy}
            onInvite={invite}
          />
        ) : null}
        {/* Report and Block go here (moderation feature; docs/features/explore.md,
            P25): two danger text buttons under the cards, never on your own profile
            (!isMe). */}
      </>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.detailGap,
          paddingBottom: spacing.xxxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <BackLink label={backLabel(navigation)} onPress={navigation.goBack} />
        {status !== 'ready' && status !== 'gone' && name ? (
          <Text variant="title">{name}</Text>
        ) : null}
        {body}
      </ScrollView>
    </Screen>
  );
}

// The large avatar, the name, the position as a soft pill and the area (when set), like
// the player's own Profile.
function ProfileCard({ name, profile }) {
  const { colors, spacing, icon } = useTheme();
  return (
    <Card>
      <View style={[styles.row, { gap: spacing.md }]}>
        <Avatar name={name} size="large" />
        <View style={[styles.fill, { gap: spacing.xxs }]}>
          <Text variant="cardTitle" accessibilityRole="header">
            {name}
          </Text>
          <View style={[styles.row, styles.wrap, { gap: spacing.xs }]}>
            {profile?.position ? <Pill label={profile.position} /> : null}
            {profile?.area ? (
              <View style={[styles.row, { gap: spacing.xxs }]}>
                <Icon
                  name="area"
                  size={icon.sizeSmall}
                  color={colors.textMuted}
                />
                <Text variant="meta" color="textMuted" style={styles.shrink}>
                  {profile.area}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

// Height, weight and phone, only the ones with a value (P23); nothing when none is set.
function DetailsCard({ name, profile, isMe }) {
  const rows = [];
  if (profile?.height != null) {
    rows.push({
      key: 'height',
      icon: 'height',
      name: 'Height',
      meta: `${profile.height} cm`,
    });
  }
  if (profile?.weight != null) {
    rows.push({
      key: 'weight',
      icon: 'weight',
      name: 'Weight',
      meta: `${profile.weight} kg`,
    });
  }
  if (profile?.phone) {
    rows.push(
      isMe
        ? // Your own number: shown as teammates see it, not something to call.
          {
            key: 'phone',
            icon: 'phone',
            name: 'Phone',
            meta: profile.phone,
            hint: PHONE_HINT,
          }
        : {
            key: 'phone',
            icon: 'phone',
            name: 'Phone',
            meta: profile.phone,
            hint: TEAMMATE_PHONE_HINT,
            onPress: () => openDialler(profile.phone),
            accessibilityLabel: `Call ${name}`,
          },
    );
  }
  if (rows.length === 0) return null;
  return (
    <Card>
      <SectionHeader title="Details" />
      {rows.map((row, index) => (
        <ListRow
          key={row.key}
          icon={row.icon}
          name={row.name}
          meta={row.meta}
          hint={row.hint}
          onPress={row.onPress}
          accessibilityLabel={row.accessibilityLabel}
          last={index === rows.length - 1}
        />
      ))}
    </Card>
  );
}

// The player's teams (accepted memberships), each opening Team detail.
function TeamsCard({ teams, onOpen }) {
  const { colors, spacing } = useTheme();
  return (
    <Card>
      <SectionHeader title="Teams" />
      {teams.length === 0 ? (
        <Text color="textMuted" style={{ paddingVertical: spacing.md }}>
          {NO_TEAMS}
        </Text>
      ) : (
        teams.map((team, index) => (
          <ListRow
            key={team.id}
            icon="teams"
            name={team.name}
            meta={membersText(team)}
            onPress={() => onOpen(team.id)}
            accessibilityLabel={`Open ${team.name}`}
            trailing={
              <View style={[styles.row, { gap: spacing.xs }]}>
                {team.isCaptain ? <CaptainLabel /> : null}
                <Icon name="forward" color={colors.textMuted} />
              </View>
            }
            last={index === teams.length - 1}
          />
        ))
      )}
    </Card>
  );
}

// "Invite to my team" (P24): one row per team the viewer captains. A team that can take
// the invite has an Invite button; the others say why not, with no button. After an
// invite the row's button turns into a disabled "Invited" (or "Joined").
function InviteCard({ options, done, isBusy, busy, onInvite }) {
  return (
    <Card>
      <SectionHeader title="Invite to my team" />
      {options.map((option, index) => {
        const label = done[option.teamId];
        const reason = label ? null : inviteReason(option);
        const canInvite = option.state === 'canInvite' || Boolean(label);
        return (
          <ListRow
            key={option.teamId}
            icon="teams"
            name={option.name}
            meta={membersText(option)}
            hint={reason}
            actions={
              canInvite ? (
                <Button
                  title={label ?? 'Invite'}
                  variant="secondary"
                  accessibilityLabel={
                    label
                      ? `${label} to ${option.name}`
                      : `Invite to ${option.name}`
                  }
                  loading={isBusy(option.teamId)}
                  disabled={Boolean(label) || (busy && !isBusy(option.teamId))}
                  onPress={() => onInvite(option)}
                />
              ) : null
            }
            last={index === options.length - 1}
          />
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
});
