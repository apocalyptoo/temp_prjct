// Who can be found: the ONE place for the rule about which players a viewer may find
// in a list or a search (docs/features/explore.md, d.1, P4 and P8). Used by the player
// list of Explore (GET /players) and the search behind Invite players
// (GET /teams/:teamId/invite-candidates), so the two can't drift apart.
//
// Like visibility.js, these helpers take the Prisma client as a parameter.
import { containsText } from './search.js';
import { pageArgs } from './paging.js';
import { toVisibleUser } from './visibility.js';

// The Prisma condition (on User) for the players `viewer` may find:
// - player accounts that have a profile;
// - who have verified their email: an unverified account can't log in, so it can't
//   accept an invite, and anyone can sign up with someone else's email (spec Q3);
// - not the viewer themselves.
//
// Moderation hook (docs/features/explore.md, section g): the moderation feature adds
// "not suspended" and "no block in either direction between the viewer and the player"
// HERE, which covers Explore → Players and the invite search at once. The matching
// rules for teams and venues go into their lists (teamController getTeams,
// ownerController listIndoors).
export const discoverablePlayers = (viewer) => ({
  role: 'PLAYER',
  verified: true,
  playerProfile: { isNot: null },
  id: { not: viewer.id },
});

// What a player row in a list carries: the public profile only. The email is never
// selected, so no viewer can get it from a list, not even the admin.
const PLAYER_ROW = {
  id: true,
  createdAt: true,
  playerProfile: { select: { name: true, position: true, area: true } },
};

// One page of the players `viewer` may find, by name A to Z and then id, so the order
// never changes from one page to the next.
// - filters: `search` (part of the name), `area` (part of the area), both ignoring case
//   with % and _ literal (containsText), and `position` (exactly); each optional.
// - extra: one more Prisma condition on User (the invite search leaves out everyone who
//   already has a row in the team).
// Returns { items, total }: the rows as the viewer may see them, and how many match.
export async function findPlayerPage(db, viewer, { search, area, position, page, limit }, extra = {}) {
  const profile = {
    ...(search ? { name: containsText(search) } : {}),
    ...(area ? { area: containsText(area) } : {}),
    ...(position ? { position } : {}),
  };
  const where = { AND: [discoverablePlayers(viewer), { playerProfile: { is: profile } }, extra] };
  const [players, total] = await Promise.all([
    db.user.findMany({
      where,
      select: PLAYER_ROW,
      orderBy: [{ playerProfile: { name: 'asc' } }, { id: 'asc' }],
      ...pageArgs({ page, limit }),
    }),
    db.user.count({ where }),
  ]);
  const items = players.map((player) => toVisibleUser({ ...player, name: player.playerProfile.name }, viewer));
  return { items, total };
}
