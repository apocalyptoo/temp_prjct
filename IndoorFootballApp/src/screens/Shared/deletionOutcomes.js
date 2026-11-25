// What deleting an account will do, in words, from the backend's deletion preview
// (docs/features/account-deletion.md, d.4 and section e). The app never works out an
// outcome itself: it only puts the preview's answers into sentences.

const teams = count => (count === 1 ? '1 team' : `${count} teams`);

// One captained team: "Dhanmondi Strikers will be handed to Rahim".
export const teamOutcomeText = team =>
  team.outcome === 'handover'
    ? `${team.name} will be handed to ${team.newCaptain.name}`
    : `${team.name} will be deleted (you're the only member)`;

// The icon beside it. The words carry the meaning; the icon only supports them.
export const teamOutcomeIcon = team =>
  team.outcome === 'handover' ? 'transfer' : 'delete';

// For the final question: "1 team will be deleted and 2 teams will be handed over.",
// only the parts that apply, or null for someone who captains no team.
export function teamsSummary(captainedTeams) {
  const deleted = captainedTeams.filter(t => t.outcome === 'delete').length;
  const handedOver = captainedTeams.length - deleted;
  const parts = [];
  if (deleted > 0) parts.push(`${teams(deleted)} will be deleted`);
  if (handedOver > 0) parts.push(`${teams(handedOver)} will be handed over`);
  return parts.length > 0 ? `${parts.join(' and ')}.` : null;
}

// The rows of "What will be deleted": { icon, name, meta }.
export function whatWillBeDeleted(preview, role) {
  if (role === 'OWNER') {
    const rows = [{ icon: 'profile', name: 'Your account' }];
    if (preview.venue) {
      const { name, live } = preview.venue;
      rows.push({
        icon: 'venue',
        name: 'Your venue listing will be removed',
        meta: live
          ? `${name} disappears from Explore`
          : `${name} is waiting for review`,
      });
    }
    return rows;
  }

  const rows = [
    {
      icon: 'profile',
      name: 'Your profile',
      meta: 'Your name, phone, position and everything else you added',
    },
  ];
  if (preview.otherTeams.length > 0) {
    rows.push({
      icon: 'teams',
      name: `Your place in ${teams(preview.otherTeams.length)}`,
      meta: preview.otherTeams.map(team => team.name).join(', '),
    });
  }
  if (preview.pendingCount > 0) {
    rows.push({
      icon: 'invite',
      name: 'Your invites and join requests',
      meta: `${preview.pendingCount} waiting`,
    });
  }
  return rows;
}
