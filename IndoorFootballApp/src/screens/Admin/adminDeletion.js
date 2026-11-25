// The admin's delete confirmation (docs/features/account-deletion.md, section e), shared
// by the Users tab and the venue review screen. Both delete an account, so the dialog
// says what happens to each team the account captains and to a venue listing, from the
// backend's deletion preview.
//
// - It opens only once the preview has loaded (P19): the admin shouldn't confirm
//   something they can't see. If the preview can't be loaded, an alert says so instead.
// - The delete sends the preview's code back. When an outcome has changed meanwhile the
//   backend refuses (409) and nothing is deleted: the dialog then shows the new outcome,
//   and the admin confirms again.
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import api from '../../api/api';
import { ConfirmDialog, ListRow } from '../../components/ui';
import { showActionError } from '../Team/teamCommon';
import { outcomesForAdmin } from '../Shared/deletionOutcomes';

export const PREVIEW_FAILED =
  "Couldn't load what will be deleted. Please check your connection and try again.";
export const DELETE_MESSAGE =
  "This deletes their account and profile for good. It can't be undone.";
// What the confirmation itself runs under in the screen's useBusyAction.
export const CONFIRM_KEY = 'confirm-delete';

// `run` is the screen's useBusyAction run, so its other buttons wait too.
// `path` is the account's route, for example /admin/users/12.
// onDeleted: after a delete. onStale: the account is gone already (404), reload.
// Returns `asking` (what the dialog is about: { path, name, preview }, or null), `ask`
// (load the preview, then open the dialog), `confirm` and `close`.
export function useAdminDeletion({ run, onDeleted, onStale }) {
  const [asking, setAsking] = useState(null);
  const close = () => setAsking(null);

  const loadPreview = async path =>
    (await api.get(`${path}/deletion-preview`)).data;

  // Why the preview didn't load. Gone (404): say so and reload. Refused (another 4xx):
  // the backend's message. No connection or a server error: try again.
  const previewFailed = err => {
    const status = err?.response?.status;
    if (status === 404) {
      showActionError(err, { onStale });
      return;
    }
    const readable = status >= 400 && status < 500 && err.response.data?.error;
    Alert.alert('Not loaded', readable || PREVIEW_FAILED);
  };

  // `key` is the tapped button's busy key, so that button shows its spinner.
  const ask = ({ path, name }, key) =>
    run(async () => {
      try {
        setAsking({ path, name, preview: await loadPreview(path) });
      } catch (err) {
        previewFailed(err);
      }
    }, key);

  // After a 409: the new outcome replaces the old one in the open dialog. If it can't be
  // loaded, the dialog closes, because what it shows is known to be wrong.
  const showNewOutcome = async message => {
    try {
      const preview = await loadPreview(asking.path);
      setAsking({ ...asking, preview });
      Alert.alert('Something changed', message);
    } catch (err) {
      close();
      previewFailed(err);
    }
  };

  const confirm = () =>
    run(async () => {
      try {
        await api.delete(asking.path, {
          params: { previewCode: asking.preview.previewCode },
        });
      } catch (err) {
        if (err?.response?.status === 409) {
          await showNewOutcome(err.response.data?.error);
        } else {
          close();
          showActionError(err, { onStale });
        }
        return;
      }
      close();
      await onDeleted();
    }, CONFIRM_KEY);

  return { asking, ask, confirm, close };
}

// The dialog itself: the question, then one row per outcome (none for an account with no
// captained team and no venue).
export function AdminDeletionDialog({
  deletion,
  confirmTitle = 'Delete account',
  loading,
}) {
  const { asking, confirm, close } = deletion;
  const outcomes = asking ? outcomesForAdmin(asking.preview) : [];
  return (
    <ConfirmDialog
      visible={asking !== null}
      title={asking ? `Delete ${asking.name}?` : ''}
      message={DELETE_MESSAGE}
      confirmTitle={confirmTitle}
      destructive
      loading={loading}
      onConfirm={confirm}
      onCancel={close}
    >
      {outcomes.length > 0 ? (
        <View>
          {outcomes.map((outcome, index) => (
            <ListRow
              key={outcome.key}
              icon={outcome.icon}
              name={outcome.text}
              last={index === outcomes.length - 1}
            />
          ))}
        </View>
      ) : null}
    </ConfirmDialog>
  );
}
