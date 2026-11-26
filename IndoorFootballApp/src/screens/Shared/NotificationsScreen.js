// The Notifications screen (docs/features/notifications.md, section e), for players and
// venue owners, from GET /notifications. Registered as `Notifications` in both
// Notifications stacks.
// - "Needs your action" (players only, P23): the invites, each with Accept and Decline,
//   then one card per team the player captains with its join requests (P24), with the
//   same rows, buttons and decline dialog as Team detail (P25). After an action the list
//   reloads, without a success alert.
// - "Updates": one card, newest first. Each row: an icon, the backend's sentence, when it
//   happened (timeAgo) and the admin's note as a third line. Unread ones end with a "New"
//   pill (P26). Tapping one opens what it's about (P22); `opens: null` isn't tappable.
// - Reading (D4, P28): when a load brings unread updates, POST /notifications/read with
//   the newest id shown. The rows that were unread in this visit keep "New" until the
//   user leaves the screen (another screen or tab), also after a pull to refresh or an
//   action. Putting the app in the background isn't leaving. A failed read shows nothing;
//   the next load tries again.
// - Loads whenever it comes into view, on pull to refresh, and when the app comes back
//   to the foreground on it. A failed first load says so, with Try again; a failed reload
//   keeps what's shown. A 403, 404 or 409 on an action says "Something changed" and
//   reloads (P34).
// - The badge: the `count` of GET /notifications and of POST /notifications/read goes to
//   the NotificationsProvider (`follow`), so opening the screen, pulling to refresh and
//   reading set the badge without another request.
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ListRow,
  Pill,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import { timeAgo } from '../../utils/timeAgo';
import { TeamLoadState, personName, showActionError } from '../Team/teamCommon';
import {
  JoinRequestsCard,
  approveKey,
  approveRequest,
  declineRequestDialog,
} from '../Team/joinRequests';
import { NOTE_TITLE } from '../Owner/MyVenueScreen';

export const NOTHING_AT_ALL = 'No notifications yet.';
export const NO_ACTIONS = 'Nothing needs your action.';
export const NO_UPDATES = 'No updates yet.';
export const LOAD_ERROR = "Couldn't load your notifications.";

// The icon of each update type. A type this version doesn't know yet (a later feature)
// gets the bell, and still shows the backend's sentence (P14).
const UPDATE_ICONS = {
  requestApproved: 'approve',
  inviteAccepted: 'approve',
  venueApproved: 'approve',
  requestDeclined: 'reject',
  inviteDeclined: 'reject',
  memberRemoved: 'remove',
  memberLeft: 'leave',
  becameCaptain: 'captain',
  teamDeleted: 'delete',
  teamDeletedInvite: 'delete',
  teamDeletedRequest: 'delete',
  venueMovedToReview: 'venue',
};
export const updateIcon = type => UPDATE_ICONS[type] ?? 'notifications';

// What tapping an update opens, by its `opens.kind` (P22). A team or player may be gone
// by then: Team detail and Player detail say so. Venue updates open the owner's own
// My Venue (Venue detail shows only live venues).
const OPENERS = {
  team: (navigation, opens) =>
    navigation.navigate('TeamDetail', { teamId: opens.id }),
  player: (navigation, opens) =>
    navigation.navigate('PlayerDetail', {
      userId: opens.id,
      playerName: opens.name,
    }),
  venue: navigation => navigation.navigate('MyVenueTab', { screen: 'MyVenue' }),
};

export default function NotificationsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const isPlayer = user?.role === 'PLAYER';
  const { colors, spacing } = useTheme();
  const [data, setData] = useState(null); // GET /notifications
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  // The updates that were unread when they loaded in this visit: they show "New".
  const [newIds, setNewIds] = useState(() => new Set());
  // The join request whose decline is being confirmed: { teamId, row }, or null.
  const [asking, setAsking] = useState(null);
  const { run: runOnce, busyKey: busy } = useBusyAction();
  const { follow } = useNotifications();

  // Each time the user leaves the screen, a new visit starts: a load sent before that
  // is ignored, so nothing the user didn't see is marked as read or shown as "New".
  const visit = useRef(0);
  const focused = useRef(false);
  // Loads are numbered; a reply older than the one shown is ignored, so the list never
  // jumps back to an older state.
  const sent = useRef(0);
  const shown = useRef(0);

  const load = useCallback(async () => {
    sent.current += 1;
    const number = sent.current;
    const thisVisit = visit.current;
    const showCount = follow();
    try {
      const res = await api.get('/notifications');
      // The badge takes the number even from a reply this visit no longer shows.
      showCount(res.data.count);
      if (visit.current !== thisVisit || number < shown.current) return;
      shown.current = number;
      setData(res.data);
      setStatus('ready');
      const unread = res.data.updates.filter(update => !update.read);
      if (unread.length > 0) {
        setNewIds(current => {
          const next = new Set(current);
          unread.forEach(update => next.add(update.id));
          return next;
        });
        const upToId = Math.max(...res.data.updates.map(update => update.id));
        // A failed read shows nothing: the updates stay unread and the next load
        // tries again. Its reply has the badge's new number.
        const showReadCount = follow();
        api
          .post('/notifications/read', { upToId })
          .then(reply => showReadCount(reply?.data?.count))
          .catch(() => {});
      }
    } catch {
      if (visit.current !== thisVisit) return;
      setStatus(current => (current === 'ready' ? 'ready' : 'error'));
    }
  }, [follow]);

  useEffect(() => {
    const offFocus = navigation.addListener('focus', () => {
      focused.current = true;
      load();
    });
    const offBlur = navigation.addListener('blur', () => {
      focused.current = false;
      visit.current += 1;
      setNewIds(new Set());
    });
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation, load]);

  // Back to the foreground while this screen is showing: load again (PRODUCT.md,
  // "Freshness"). Going to the background changes nothing (P28).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && focused.current) load();
    });
    return () => subscription.remove();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = () => {
    setStatus('loading');
    load();
  };

  // One action at a time (key: which button spins), then the list as it is now.
  const run = (key, request) =>
    runOnce(async () => {
      try {
        await request();
        await load();
      } catch (err) {
        showActionError(err, { onStale: load, forbiddenIsStale: true });
      }
    }, key);

  const dialog = asking
    ? declineRequestDialog(asking.teamId, asking.row)
    : null;
  const confirmDecline = async () => {
    await run('dialog', dialog.request);
    setAsking(null);
  };

  const openUpdate = update =>
    OPENERS[update.opens.kind](navigation, update.opens);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.listGap,
          paddingTop: spacing.lg,
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
        <ScreenHeader title="Notifications" />
        {status !== 'ready' ? (
          <TeamLoadState
            status={status}
            onRetry={retry}
            errorMessage={LOAD_ERROR}
          />
        ) : (
          <Content
            data={data}
            isPlayer={isPlayer}
            newIds={newIds}
            busy={busy}
            onOpenTeam={teamId => navigation.navigate('TeamDetail', { teamId })}
            onOpenPlayer={row =>
              navigation.navigate('PlayerDetail', {
                userId: row.userId,
                playerName: personName(row),
              })
            }
            onAccept={teamId =>
              run(`accept-${teamId}`, () => api.post(`/teams/${teamId}/accept`))
            }
            onDeclineInvite={teamId =>
              run(`decline-${teamId}`, () =>
                api.post(`/teams/${teamId}/reject`),
              )
            }
            onApprove={(teamId, row) =>
              run(approveKey(teamId, row), () => approveRequest(teamId, row))
            }
            onDeclineRequest={(teamId, row) => setAsking({ teamId, row })}
            onOpenUpdate={openUpdate}
          />
        )}
      </ScrollView>
      <ConfirmDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        confirmTitle={dialog?.confirmTitle}
        destructive
        loading={busy === 'dialog'}
        onConfirm={confirmDecline}
        onCancel={() => setAsking(null)}
      />
    </Screen>
  );
}

// The two sections, or one line when there's nothing at all (P30).
function Content({
  data,
  isPlayer,
  newIds,
  busy,
  onOpenTeam,
  onOpenPlayer,
  onAccept,
  onDeclineInvite,
  onApprove,
  onDeclineRequest,
  onOpenUpdate,
}) {
  // Owners never have anything to act on; their lists are empty anyway.
  const invites = isPlayer ? data.needsAction.invites : [];
  const groups = isPlayer ? data.needsAction.joinRequests : [];
  const { updates } = data;
  const noActions = invites.length === 0 && groups.length === 0;

  if (noActions && updates.length === 0) {
    return <EmptyState message={NOTHING_AT_ALL} />;
  }

  return (
    <>
      {isPlayer ? (
        <Section title="Needs your action">
          {noActions ? <EmptyState message={NO_ACTIONS} /> : null}
          {invites.map(invite => (
            <InviteCard
              key={invite.id}
              invite={invite}
              busy={busy}
              onOpen={() => onOpenTeam(invite.teamId)}
              onAccept={() => onAccept(invite.teamId)}
              onDecline={() => onDeclineInvite(invite.teamId)}
            />
          ))}
          {groups.map(group => (
            <JoinRequestsCard
              key={group.teamId}
              title={`Join requests · ${group.teamName}`}
              requests={group.requests}
              busy={busy}
              onApprove={row => onApprove(group.teamId, row)}
              onDecline={row => onDeclineRequest(group.teamId, row)}
              onOpen={onOpenPlayer}
            />
          ))}
        </Section>
      ) : null}
      <Section title="Updates">
        {updates.length === 0 ? (
          <EmptyState message={NO_UPDATES} />
        ) : (
          <Card>
            {updates.map((update, index) => (
              <UpdateRow
                key={update.id}
                update={update}
                isNew={newIds.has(update.id)}
                onOpen={onOpenUpdate}
                last={index === updates.length - 1}
              />
            ))}
          </Card>
        )}
      </Section>
    </>
  );
}

// A heading on the page with its cards under it. The heading sits outside the cards,
// because each invite is a card of its own.
function Section({ title, children }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title={title} />
      <View style={{ gap: spacing.listGap }}>{children}</View>
    </View>
  );
}

// One invite, as on the old Invites screen: the team, who invited you and how full the
// team is, then Accept (disabled when the team is full) and Decline side by side.
// Tapping the card opens Team detail.
function InviteCard({ invite, busy, onOpen, onAccept, onDecline }) {
  const { spacing } = useTheme();
  const { team } = invite;
  const isFull = team.memberCount >= team.maxMembers;
  const acceptKey = `accept-${invite.teamId}`;
  const declineKey = `decline-${invite.teamId}`;
  const captain = team.captain?.name || 'The captain';

  return (
    <Card
      onPress={onOpen}
      accessibilityLabel={`Open ${team.name}`}
      style={{ gap: spacing.cardGap }}
    >
      <View style={{ gap: spacing.xxs }}>
        <Text variant="cardTitle">{team.name}</Text>
        <Text variant="meta" color="textMuted">
          {`${captain} invited you · ${team.memberCount} / ${team.maxMembers} members`}
        </Text>
      </View>
      <View style={[styles.wrapRow, { gap: spacing.md }]}>
        <Button
          title={
            isFull
              ? `Team is full (${team.memberCount}/${team.maxMembers})`
              : 'Accept'
          }
          accessibilityLabel={
            isFull ? undefined : `Accept the invite to ${team.name}`
          }
          disabled={isFull || (busy !== null && busy !== acceptKey)}
          loading={busy === acceptKey}
          onPress={onAccept}
          style={styles.grow}
        />
        <Button
          title="Decline"
          variant="secondary"
          accessibilityLabel={`Decline the invite to ${team.name}`}
          disabled={busy !== null && busy !== declineKey}
          loading={busy === declineKey}
          onPress={onDecline}
          style={styles.grow}
        />
      </View>
    </Card>
  );
}

// One update: icon, sentence, time, the admin's note, and "New" when unread in this
// visit. Screen readers hear "New." first, then the rest as one item.
function UpdateRow({ update, isNew, onOpen, last }) {
  const time = timeAgo(update.createdAt);
  const note = update.note ? `${NOTE_TITLE}: ${update.note}` : null;
  const canOpen = Boolean(update.opens && OPENERS[update.opens.kind]);
  const spoken = `${isNew ? 'New. ' : ''}${[update.text, time, note]
    .filter(Boolean)
    .join(', ')}`;

  const row = (
    <ListRow
      icon={updateIcon(update.type)}
      name={update.text}
      meta={time}
      hint={note}
      trailing={isNew ? <Pill label="New" /> : null}
      onPress={canOpen ? () => onOpen(update) : undefined}
      accessibilityLabel={spoken}
      last={last}
    />
  );
  // A row that isn't tappable is still read out as one item.
  return canOpen ? (
    row
  ) : (
    <View accessible accessibilityLabel={spoken}>
      {row}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 0 },
});
