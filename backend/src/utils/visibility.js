// Who may see what about a user: the ONE place for these rules
// (docs/PRODUCT.md, "Profile visibility"). Every endpoint that returns user or profile
// data must pass it through these helpers. Hiding fields only in the app isn't enough,
// because anything the backend sends can be read.
//
// The rules:
// - Yourself and the admin: everything (except secrets).
// - Any other logged-in user, about a player: name, position, height, weight and area
//   (each of the last three only if set), and the teams they belong to.
// - Phone: only accepted teammates (both accepted members of at least one same team).
// - Email: only yourself and the admin.
// - Area: the player's general area ("Dhanmondi 27"), public to logged-in users. It
//   replaced the old free-text address (feature 2), and the app tells players not to
//   enter a full address.
// - Venue listings: all business details are public; the owner's login email is not.
// - Secrets (password hash, tokens, token expiry times): never sent to anyone.
//
// These helpers only copy fields that the query actually fetched, so each response keeps
// its existing shape, just without the hidden fields.

const SECRET_FIELDS = new Set(['password', 'verifyToken', 'verifyTokenExpires', 'resetToken', 'resetTokenExpires']);

const pick = (source, fields) => {
  const out = {};
  for (const field of fields) if (field in source) out[field] = source[field];
  return out;
};

// The person asking, from their login token.
export const viewerFrom = (req) => ({ id: req.user.id, role: req.user.role });

// Yourself and the admin see everything about an account (except secrets).
export const seesEverything = (viewer, userId) => viewer.role === 'ADMIN' || viewer.id === userId;

// A copy of the value with secret fields removed at any depth.
export function withoutSecrets(value) {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (!SECRET_FIELDS.has(key)) out[key] = withoutSecrets(inner);
    }
    return out;
  }
  return value;
}

// The part of a player profile another logged-in user may see.
// Never email; phone only for accepted teammates; height, weight and area only if set.
export function toPublicPlayer(profile, { canSeePhone = false } = {}) {
  if (!profile) return profile;
  const out = pick(profile, ['name', 'position']);
  if (profile.height != null) out.height = profile.height;
  if (profile.weight != null) out.weight = profile.weight;
  if (profile.area != null) out.area = profile.area;
  if (canSeePhone && 'phone' in profile) out.phone = profile.phone;
  return out;
}

// A venue listing. Everything is a public business detail, except the owner's login email.
// The public venue listing (docs/features/venues.md, P7). Never the review state
// (approvedAt), the admin's note (reviewNote) or the owner's email: players only ever see
// live venues, and the note is between the admin and the owner.
const VENUE_FIELDS = [
  'userId',
  'createdAt',
  'indoorName',
  'phone',
  'address',
  'area',
  'description',
  'website',
  'openingHours',
  'pricingInfo',
];

export function toPublicVenue(venue, { canSeeEmail = false } = {}) {
  if (!venue) return venue;
  const out = pick(venue, VENUE_FIELDS);
  if (canSeeEmail && 'email' in venue) out.email = venue.email;
  return out;
}

// A user (with optional playerProfile / ownerProfile) as seen by `viewer`.
// Yourself or the admin: everything except secrets. Anyone else: id, role, createdAt,
// display name and the public part of the profile.
export function toVisibleUser(user, viewer, { canSeePhone = false } = {}) {
  if (!user) return user;
  if (seesEverything(viewer, user.id)) return withoutSecrets(user);
  const out = pick(user, ['id', 'role', 'createdAt', 'name']);
  if ('playerProfile' in user) out.playerProfile = toPublicPlayer(user.playerProfile, { canSeePhone });
  if ('ownerProfile' in user) out.ownerProfile = toPublicVenue(user.ownerProfile);
  return out;
}

// GET /players/:id: only the stats, nothing about the account itself.
export const toPlayerStats = ({ totalTeams, user }) => ({ totalTeams, joinedAt: user?.createdAt });

// The ids of the viewer's accepted teammates: accepted members of any team in which the
// viewer is also accepted. One query per request, not one per player. Pass the result's
// .has(userId) as canSeePhone. (No endpoint shows other players' phones yet; this is
// ready for the Player detail screen in Phase 4.)
export async function findAcceptedTeammateIds(prisma, viewerId) {
  const rows = await prisma.teamMember.findMany({
    where: {
      status: 'accepted',
      userId: { not: viewerId },
      team: { members: { some: { userId: viewerId, status: 'accepted' } } },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  return new Set(rows.map((row) => row.userId));
}
