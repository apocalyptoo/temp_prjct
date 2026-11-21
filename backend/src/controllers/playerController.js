import { prisma } from '../db.js';
import { viewerFrom, toVisibleUser, toPlayerStats } from '../utils/visibility.js';
import { parseId } from '../utils/ids.js';
import { MEMBERSHIP_FIELDS_NOT_IN_REPLIES, MAX_TEAM_MEMBERS } from '../utils/membership.js';

// Counts a team's accepted members in the same query (pending rows aren't members).
const ACCEPTED_MEMBER_COUNT = { _count: { select: { members: { where: { status: 'accepted' } } } } };

// A team's member count and limit, for lists of invites and requests.
const withCounts = ({ _count, ...team }) => ({ ...team, memberCount: _count.members, maxMembers: MAX_TEAM_MEMBERS });

export const listPlayers = async (req, res, next) => {
  try {
    const players = await prisma.user.findMany({
      where: {
        role: 'PLAYER',
        playerProfile: { isNot: null }, // avoids null profiles breaking mapping
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        playerProfile: {
          select: { name: true, position: true, area: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // { id, name, email, playerProfile } (the app reads id and name); the visibility
    // rules then drop the email for everyone except yourself (and the admin). The
    // position and area are public and sit in playerProfile, the same shape as team members.
    const viewer = viewerFrom(req);
    const result = players.map((p) =>
      toVisibleUser(
        {
          id: p.id,
          email: p.email,
          createdAt: p.createdAt,
          name: p.playerProfile?.name || 'Unknown',
          playerProfile: p.playerProfile,
        },
        viewer
      )
    );

    return res.json(result);
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

//  get player stats
export const getPlayerStats = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid player id' });
    // Only accepted memberships count; a pending invite isn't a team yet.
    const totalTeams = await prisma.teamMember.count({ where: { userId: id, status: 'accepted' } });
    const user = await prisma.user.findUnique({ where: { id }, select: { createdAt: true } });
    res.json(toPlayerStats({ totalTeams, user }));
  } catch (err) {
    return next(err);
  }
};



