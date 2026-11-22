// The admin's review screen for one venue (docs/features/venues.md, section e, P23), in
// the Venues tab's stack. Route params: { userId, venueName } (the name shows while it
// loads). There's no "one venue" endpoint for the admin, so it loads GET /admin/indoors
// and picks its venue; after an action it shows the venue from the action's reply.
//
// The full listing, the owner's email, the status and the date it went live, then:
// - Pending: Approve (primary), disabled with the reason under it while the owner hasn't
//   verified their email or something is missing; a "Note for the owner" field with
//   Save note (an empty note clears it; at most 200 characters).
// - Live: Move back to review, which opens a required note and a red Move back to
//   review button, then a confirmation.
// - Both: Delete venue, with a confirmation (it deletes the owner's account).
// A 404 or 409 (the venue changed meanwhile) alerts "Something changed" with the
// backend's message and reloads (showActionError). Every action uses useBusyAction.
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  BackLink,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ListRow,
  Pill,
  Screen,
  SectionHeader,
  Text,
  TextField,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import { TeamLoadState, showActionError } from '../Team/teamCommon';
import { NOT_ADDED } from '../Player/PlayerProfileScreen';
import { WebsiteRow } from '../Venue/venueCommon';
import { GONE_MESSAGE } from '../Venue/VenueDetailScreen';
import { ownerLine } from './AdminVenuesScreen';
import {
  isLive,
  liveSinceText,
  missingText,
  noteBody,
  noteProblem,
  OWNER_UNVERIFIED,
} from './adminVenueCommon';

export const NOTE_LABEL = 'Note for the owner';
export const NOTE_HELPER =
  'The owner sees this on My Venue while the venue is pending.';

export default function AdminVenueScreen({ navigation, route }) {
  const { userId, venueName } = route.params;
  const { colors, spacing } = useTheme();
  const [venue, setVenue] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | gone
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState(''); // the pending venue's note field
  const [noteError, setNoteError] = useState(null);
  const [moving, setMoving] = useState(false); // the "move back to review" step is open
  const [moveNote, setMoveNote] = useState('');
  const [moveError, setMoveError] = useState(null);
  const [confirming, setConfirming] = useState(null); // 'move' | 'delete' | null
  const { run, busy, isBusy } = useBusyAction();

  // Shows a venue (loaded, or from an action's reply), with its note in the field.
  const show = useCallback(next => {
    setVenue(next);
    setNote(next.reviewNote ?? '');
    setNoteError(null);
    setStatus('ready');
  }, []);

  // A venue that's no longer in the list (deleted) shows the "not available" state. Any
  // other failure keeps what's shown; only a failed first load shows the error.
  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/indoors');
      const found = res.data.find(item => item.userId === userId);
      if (!found) {
        setStatus('gone');
        return;
      }
      show(found);
    } catch {
      setStatus(current => (current === 'ready' ? 'ready' : 'error'));
    }
  }, [userId, show]);

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

  // Another action is running: every other button waits.
  const blocked = key => busy && !isBusy(key);

  const approve = () =>
    run(async () => {
      try {
        const res = await api.post(`/admin/indoors/${userId}/approve`);
        show(res.data);
      } catch (err) {
        showActionError(err, { onStale: load });
      }
    }, 'approve');

  const saveNote = () => {
    const problem = noteProblem(note);
    setNoteError(problem);
    if (problem) return;
    run(async () => {
      try {
        const res = await api.put(
          `/admin/indoors/${userId}/note`,
          noteBody(note),
        );
        show(res.data);
      } catch (err) {
        showActionError(err, { onStale: load });
      }
    }, 'note');
  };

  const closeMoveStep = () => {
    setMoving(false);
    setMoveNote('');
    setMoveError(null);
  };

  // The red button in the step: the note is checked first, then the confirmation.
  const askToMove = () => {
    const problem = noteProblem(moveNote, { required: true });
    setMoveError(problem);
    if (!problem) setConfirming('move');
  };

  const moveToReview = () =>
    run(async () => {
      try {
        const res = await api.post(
          `/admin/indoors/${userId}/move-to-review`,
          noteBody(moveNote),
        );
        setConfirming(null);
        closeMoveStep();
        show(res.data);
      } catch (err) {
        setConfirming(null);
        showActionError(err, { onStale: load });
      }
    }, 'move');

  const deleteVenue = () =>
    run(async () => {
      try {
        await api.delete(`/admin/indoors/${userId}`);
        setConfirming(null);
        navigation.goBack(); // The list reloads when it comes back into view.
      } catch (err) {
        setConfirming(null);
        showActionError(err, { onStale: load });
      }
    }, 'delete');

  const name = venue?.indoorName ?? venueName;
  const live = isLive(venue);

  let body;
  if (status === 'gone') {
    body = (
      <EmptyState
        message={GONE_MESSAGE}
        actionTitle="Back to venues"
        onAction={navigation.goBack}
      />
    );
  } else if (status !== 'ready') {
    body = (
      <TeamLoadState
        status={status}
        onRetry={retry}
        errorMessage="Couldn't load this venue."
      />
    );
  } else {
    // Why Approve is off, in the backend's order: the owner's email, then completeness.
    const reasons = [];
    if (!venue.verified) reasons.push(OWNER_UNVERIFIED);
    if (venue.missingFields.length > 0) {
      reasons.push(missingText(venue.missingFields));
    }

    body = (
      <>
        <Card>
          <SectionHeader title="Listing" />
          <ListRow icon="email" name="Owner's email" meta={ownerLine(venue)} />
          <ListRow
            icon="area"
            name="Address"
            meta={venue.address || NOT_ADDED}
          />
          <ListRow icon="area" name="Area" meta={venue.area || NOT_ADDED} />
          <ListRow icon="phone" name="Phone" meta={venue.phone || NOT_ADDED} />
          <WebsiteRow website={venue.website} />
          <ListRow
            icon="time"
            name="Opening hours"
            meta={venue.openingHours || NOT_ADDED}
          />
          <ListRow
            icon="price"
            name="Pricing info"
            meta={venue.pricingInfo || NOT_ADDED}
          />
          <ListRow
            icon="description"
            name="Description"
            meta={venue.description || NOT_ADDED}
            last
          />
        </Card>

        {live ? (
          moving ? (
            <Card style={{ gap: spacing.lg }}>
              <TextField
                label={NOTE_LABEL}
                value={moveNote}
                onChangeText={text => {
                  setMoveNote(text);
                  setMoveError(null);
                }}
                error={moveError}
                helper={NOTE_HELPER}
                multiline
                disabled={busy}
              />
              <View style={[styles.row, { gap: spacing.md }]}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={closeMoveStep}
                  disabled={busy}
                  style={styles.half}
                />
                <Button
                  title="Move back to review"
                  variant="danger"
                  onPress={askToMove}
                  disabled={blocked('move')}
                  loading={isBusy('move')}
                  style={styles.half}
                />
              </View>
            </Card>
          ) : (
            <Button
              title="Move back to review"
              variant="secondary"
              onPress={() => setMoving(true)}
              disabled={busy}
              fullWidth
            />
          )
        ) : (
          <>
            <View style={{ gap: spacing.xs }}>
              <Button
                title="Approve"
                icon="approve"
                onPress={approve}
                disabled={reasons.length > 0 || blocked('approve')}
                loading={isBusy('approve')}
                fullWidth
              />
              {reasons.map(reason => (
                <Text
                  key={reason}
                  variant="meta"
                  color="textMuted"
                  style={styles.centred}
                >
                  {reason}
                </Text>
              ))}
            </View>
            <Card style={{ gap: spacing.lg }}>
              <TextField
                label={NOTE_LABEL}
                value={note}
                onChangeText={text => {
                  setNote(text);
                  setNoteError(null);
                }}
                error={noteError}
                helper={NOTE_HELPER}
                multiline
                disabled={busy}
              />
              <Button
                title="Save note"
                variant="secondary"
                onPress={saveNote}
                disabled={blocked('note')}
                loading={isBusy('note')}
                fullWidth
              />
            </Card>
          </>
        )}

        <Button
          title="Delete venue"
          icon="delete"
          variant="danger"
          onPress={() => setConfirming('delete')}
          disabled={busy}
          fullWidth
        />
      </>
    );
  }

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
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
        <BackLink label="Venues" onPress={navigation.goBack} />
        {name ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="title">{name}</Text>
            {status === 'ready' ? (
              <>
                {live ? (
                  <Pill label="Live" variant="strong" />
                ) : (
                  <Pill label="Pending review" variant="soft" />
                )}
                {live ? (
                  <Text variant="meta" color="textMuted">
                    {liveSinceText(venue.approvedAt)}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
        {body}
      </ScrollView>

      <ConfirmDialog
        visible={confirming === 'move'}
        title={`Move ${name} back to review?`}
        message="Players won't see it until you approve it again."
        confirmTitle="Move back to review"
        destructive
        loading={isBusy('move')}
        onConfirm={moveToReview}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        visible={confirming === 'delete'}
        title={`Delete ${name}?`}
        message="This deletes the owner's account and all its data. It can't be undone."
        confirmTitle="Delete venue"
        destructive
        loading={isBusy('delete')}
        onConfirm={deleteVenue}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  centred: { textAlign: 'center' },
});
