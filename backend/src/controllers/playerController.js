import { prisma } from '../db.js';
import { viewerFrom, toVisibleUser, isAcceptedTeammate } from '../utils/visibility.js';
import { parseId } from '../utils/ids.js';
import {
  MEMBERSHIP_FIELDS_NOT_IN_REPLIES,
  MAX_TEAM_MEMBERS,
  isMember,
  isPendingInvite,
} from '../utils/membership.js';
import { findPlayerPage } from '../utils/discovery.js';
import { pagedReply } from '../utils/paging.js';

// Counts a team's accepted members in the same query (pending rows aren't members).
const ACCEPTED_MEMBER_COUNT = { _count: { select: { members: { where: { status: 'accepted' } } } } };

// A team's member count and limit, for lists of invites and requests.
const withCounts = ({ _count, ...team }) => ({ ...team, memberCount: _count.members, maxMembers: MAX_TEAM_MEMBERS });

// GET /players: the player list of Explore (docs/features/explore.md, d endpoint 5).
// One page of the players the viewer may find (src/utils/discovery.js: verified player
// accounts with a profile, without the viewer), with optional search by name and
// filters by area and position, by name A to Z. Each row is { id, createdAt, name,
// playerProfile: { name, position, area } } and never has an email.
export const listPlayers = async (req, res, next) => {
  try {
    const { items, total } = await findPlayerPage(prisma, viewerFrom(req), req.valid.query);
    return res.json(pagedReply(items, total, req.valid.query));
  } catch (err) {
    return next(err);
  }
};

// The logged-in player's own profile: everything except secrets. Shared by
// GET /players/me and the reply of PATCH /players/me.
const loadOwnPlayerProfile = (userId) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      playerProfile: {
        select: { name: true, phone: true, position: true, height: true, weight: true, area: true },
      },
    },
  });

export const getMyPlayerProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'PLAYER') {
      return res.status(403).json({ error: 'Players only' });
    }

    const user = await loadOwnPlayerProfile(req.user.id);
    if (!user || !user.playerProfile) {
      return res.status(404).json({ error: 'Player profile not found' });
    }

    return res.json(toVisibleUser(user, viewerFrom(req)));
  } catch (err) {
    return next(err);
  }
};

// PATCH /players/me: Edit profile (docs/features/profiles-and-registration.md,
// d endpoint 3). Players only (checked by the route, before the body). The body was
// checked by updatePlayerProfileSchema: every field is present and cleaned, and empty
// optional fields are null, so one update replaces the whole editable profile.
export const updateMyPlayerProfile = async (req, res, next) => {
  try {
    const { name, phone, position, height, weight, area } = req.valid.body;
    const { count } = await prisma.playerProfile.updateMany({
      where: { userId: req.user.id },
      data: { name, phone, position, height, weight, area },
    });
    if (count === 0) return res.status(404).json({ error: 'Player profile not found' });

    const user = await loadOwnPlayerProfile(req.user.id);
    return res.json(toVisibleUser(user, viewerFrom(req)));
  } catch (err) {
    return next(err);
  }
};

// The viewer's pending invites (not their own join requests), newest first.
export const getPendingInvites = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const invites = await prisma.teamMember.findMany({
      where: { userId, status: 'pending', origin: 'invite' },
      omit: MEMBERSHIP_FIELDS_NOT_IN_REPLIES,
      include: {
        team: {
          include: {
            ...ACCEPTED_MEMBER_COUNT,
            // The team's captain is always a player, so the name comes from their
            // player profile.
            captain: {
              select: {
                id: true,
                playerProfile: { select: { name: true } },
              },
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    // The captain is another user: show them through the visibility rules ({ id, name }).
    const viewer = viewerFrom(req);
    res.json(
      invites.map((invite) => {
        const { captain } = invite.team;
        return {
          ...invite,
          team: {
            ...withCounts(invite.team),
            captain: toVisibleUser({ id: captain.id, name: captain.playerProfile?.name || 'Unknown' }, viewer),
          },
        };
      })
    );
  } catch (err) {
    return next(err);
  }
};


// The viewer's own pending join requests, newest first, each with their message (the
// requester may see their own) and how full the team is (GET /players/requests).
export const getMyRequests = async (req, res, next) => {
  try {
    const requests = await prisma.teamMember.findMany({
      where: { userId: req.user.id, status: 'pending', origin: 'request' },
      select: {
        id: true,
        teamId: true,
        createdAt: true,
        message: true,
        team: { select: { id: true, name: true, ...ACCEPTED_MEMBER_COUNT } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    res.json(requests.map((request) => ({ ...request, team: withCounts(request.team) })));
  } catch (err) {
    return next(err);
  }
};

// By name A to Z ignoring case, then by id.
const byName = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id;

// For "Invite to my team" on Player detail (docs/features/explore.md, P14): the teams
// the viewer captains, each with what inviting this player to it would meet:
// - member / invited / requested: the player already has that row in the team;
// - full: the team has no free spot (the player's own state wins over this);
// - canInvite: the captain can send the invite.
// An empty list when the viewer captains no team.
async function inviteOptionsFor(captainId, playerId) {
  const teams = await prisma.team.findMany({
    where: { captainId },
    select: {
      id: true,
      name: true,
      ...ACCEPTED_MEMBER_COUNT,
      members: { where: { userId: playerId }, select: { status: true, origin: true } },
    },
  });
  const stateOf = (own, memberCount) => {
    if (own) return isMember(own) ? 'member' : isPendingInvite(own) ? 'invited' : 'requested';
    return memberCount >= MAX_TEAM_MEMBERS ? 'full' : 'canInvite';
  };
  return teams.sort(byName).map((team) => ({
    teamId: team.id,
    name: team.name,
    memberCount: team._count.members,
    maxMembers: MAX_TEAM_MEMBERS,
    state: stateOf(team.members[0], team._count.members),
  }));
}

// GET /players/:id: one player's public profile, for Player detail
// (docs/features/explore.md, d endpoint 6, P13). Any logged-in user may ask.
// - The profile goes through the visibility rules: name and position always; height,
//   weight and area only if set; the phone only for an accepted teammate, the player
//   themselves and the admin. The email is never selected here, so nobody gets it from
//   this endpoint (your own is on GET /players/me).
// - teams: the teams they are an accepted member of (pending invites and requests
//   aren't public), the ones they captain first, then by name.
// - inviteOptions: only for a player looking at someone else (see inviteOptionsFor).
// An id that isn't a player account with a profile (a venue owner's or the admin's id
// too) is 404 "Player not found". Unverified players still have a page: discovery
// leaves them out of lists and searches, not this endpoint (spec Q3).
//
// Moderation hook (docs/features/explore.md, section g): what a blocked or suspended
// player's page shows (most likely this same 404) is decided there, and blocked
// players get no inviteOptions for each other.
export const getPlayer = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid player id' });
    const viewer = viewerFrom(req);

    const player = await prisma.user.findFirst({
      where: { id, role: 'PLAYER', playerProfile: { isNot: null } },
      select: {
        id: true,
        role: true,
        createdAt: true,
        playerProfile: {
          select: { name: true, phone: true, position: true, height: true, weight: true, area: true },
        },
        teamMembers: {
          where: { status: 'accepted' },
          select: {
            team: { select: { id: true, name: true, area: true, captainId: true, ...ACCEPTED_MEMBER_COUNT } },
          },
        },
      },
    });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const { teamMembers, ...account } = player;
    const canSeePhone = await isAcceptedTeammate(prisma, viewer.id, id);
    const profile = toVisibleUser({ ...account, name: account.playerProfile.name }, viewer, { canSeePhone });

    const teams = teamMembers
      .map(({ team }) => ({
        id: team.id,
        name: team.name,
        area: team.area,
        memberCount: team._count.members,
        maxMembers: MAX_TEAM_MEMBERS,
        isCaptain: team.captainId === id,
      }))
      .sort((a, b) => b.isCaptain - a.isCaptain || byName(a, b));

    const reply = { ...profile, teams };
    if (viewer.role === 'PLAYER' && viewer.id !== id) {
      reply.inviteOptions = await inviteOptionsFor(viewer.id, id);
    }
    return res.json(reply);
  } catch (err) {
    return next(err);
  }
};
