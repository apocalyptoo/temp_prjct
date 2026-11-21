// PATCH /owners/me: a venue owner edits their listing (docs/features/profiles-and-
// registration.md, d endpoint 5), and the website check (isWebLink, spec P18). Every
// field is sent each time; empty optional fields clear. Safety rules are in helpers.js.
// All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, prisma, createLoggedInUser } from './helpers.js';
import { isWebLink } from '../src/utils/links.js';

const PHONE_RULE = 'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678';
const WEBSITE_RULE = 'Website must start with http:// or https://';

async function patchMe(jwt, body) {
  const res = await fetch(`${BASE_URL}/owners/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function getJson(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  assert.equal(res.status, 200, `GET ${path}`);
  return res.json();
}

// A new owner, as after the short sign-up: only the venue name.
const owner = (t) =>
  createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Fresh Arena' } } });

const edit = (overrides = {}) => ({
  indoorName: 'Floodlight Arena',
  phone: '01912345678',
  address: 'House 5, Road 27, Dhanmondi',
  website: 'https://floodlight.example.com',
  description: 'Two indoor pitches, open late.',
  ...overrides,
});

const storedListing = async (userId) => {
  const { indoorName, phone, address, website, description } = await prisma.ownerProfile.findUnique({ where: { userId } });
  return { indoorName, phone, address, website, description };
};

describe('PATCH /owners/me saves the listing', () => {
  test('every field is saved, and the reply has the GET /owners/me shape', async (t) => {
    const me = await owner(t);
    const reply = await patchMe(me.jwt, edit());
    assert.equal(reply.status, 200, JSON.stringify(reply.body));

    const expected = {
      indoorName: 'Floodlight Arena',
      phone: '01912345678',
      address: 'House 5, Road 27, Dhanmondi',
      website: 'https://floodlight.example.com',
      description: 'Two indoor pitches, open late.',
    };
    assert.deepEqual(await storedListing(me.user.id), expected);
    assert.deepEqual(reply.body, await getJson('/owners/me', me.jwt));
    assert.deepEqual(reply.body.ownerProfile, expected);
  });

  test('only the venue name is needed; missing, null, "" or spaces clear the others', async (t) => {
    const me = await owner(t);
    await patchMe(me.jwt, edit());
    const reply = await patchMe(me.jwt, { indoorName: 'Name Only', phone: '  ', address: null, website: '' });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.deepEqual(await storedListing(me.user.id), {
      indoorName: 'Name Only',
      phone: null,
      address: null,
      website: null,
      description: null,
    });
  });

  test('text is trimmed before storing (spec P13)', async (t) => {
    const me = await owner(t);
    await patchMe(me.jwt, edit({ indoorName: '  Spaced Arena ', phone: ' 01912345678 ', address: '  Road 1  ', website: ' https://a.example.com ', description: '  Hi  ' }));
    assert.deepEqual(await storedListing(me.user.id), {
      indoorName: 'Spaced Arena',
      phone: '01912345678',
      address: 'Road 1',
      website: 'https://a.example.com',
      description: 'Hi',
    });
  });

  test('the new venue name shows in GET /auth/me and the venue list', async (t) => {
    const me = await owner(t);
    await patchMe(me.jwt, edit({ indoorName: 'Renamed Arena' }));
    assert.equal((await getJson('/auth/me', me.jwt)).name, 'Renamed Arena');
    const venues = await getJson('/owners', me.jwt);
    assert.equal(venues.find((v) => v.userId === me.user.id).indoorName, 'Renamed Arena');
  });
});

describe('Every field has its message', () => {
  const cases = [
    ['missing venue name', edit({ indoorName: undefined }), 'Venue name is required'],
    ['blank venue name', edit({ indoorName: '  ' }), 'Venue name is required'],
    ['venue name not text', edit({ indoorName: 5 }), 'Venue name must be text'],
    ['venue name of 1 character', edit({ indoorName: 'A' }), 'Venue name must be between 2 and 60 characters'],
    ['venue name of 61 characters', edit({ indoorName: 'v'.repeat(61) }), 'Venue name must be between 2 and 60 characters'],
    ['phone not a mobile number (a Dhaka landline)', edit({ phone: '0298765432' }), PHONE_RULE],
    ['phone with a space inside', edit({ phone: '01912 345678' }), PHONE_RULE],
    ['phone as a number', edit({ phone: 1912345678 }), PHONE_RULE],
    ['address not text', edit({ address: ['Road'] }), 'Address must be text'],
    ['address of 201 characters', edit({ address: 'a'.repeat(201) }), 'Address must be at most 200 characters'],
    ['website not text', edit({ website: { not: '' } }), 'Website must be text'],
    ['website of 201 characters', edit({ website: 'https://' + 'w'.repeat(193) }), 'Website must be at most 200 characters'],
    ['website without http(s)', edit({ website: 'www.arena.com' }), WEBSITE_RULE],
    ['description not text', edit({ description: 3 }), 'Description must be text'],
    ['description of 501 characters', edit({ description: 'd'.repeat(501) }), 'Description must be at most 500 characters'],
  ];

  for (const [label, body, message] of cases) {
    test(label, async (t) => {
      const me = await owner(t);
      const reply = await patchMe(me.jwt, body);
      assert.equal(reply.status, 400);
      assert.equal(reply.body.error, message);
      assert.equal((await storedListing(me.user.id)).indoorName, 'Fresh Arena', 'nothing changed');
    });
  }

  test('the limits allow exactly 200, 500 and 200 characters (Bangla counted as one each)', async (t) => {
    const me = await owner(t);
    const reply = await patchMe(me.jwt, edit({ address: 'ঢ'.repeat(200), description: 'd'.repeat(500), website: 'https://' + 'w'.repeat(192) }));
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
  });
});

describe('The website check (isWebLink)', () => {
  test('real http and https links pass, in any case', () => {
    for (const link of ['https://arena.com.bd', 'http://arena.com', 'HTTP://Arena.com', 'https://arena.com/page?x=1#top']) {
      assert.equal(isWebLink(link), true, link);
    }
  });

  test('anything else fails', () => {
    for (const link of ['arena.com', 'www.arena.com', 'javascript:alert(1)', 'ftp://arena.com', 'https://', 'https:// arena.com', 'https://arena .com', 'mailto:a@b.com', '', null, 5]) {
      assert.equal(isWebLink(link), false, String(link));
    }
  });

  test('the endpoint refuses the same links', async (t) => {
    const me = await owner(t);
    for (const website of ['javascript:alert(1)', 'ftp://arena.com', 'https://']) {
      const reply = await patchMe(me.jwt, edit({ website }));
      assert.equal(reply.body.error, WEBSITE_RULE, website);
    }
  });
});

describe('Only venue owners', () => {
  test('a player and the admin get 403 "Owners only", even with a bad body', async (t) => {
    const player = await createLoggedInUser(t, {
      role: 'PLAYER',
      playerProfile: { create: { name: 'Not An Owner', phone: '01712345678', position: 'Any' } },
    });
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    for (const someone of [player, admin]) {
      for (const body of [edit(), {}]) {
        const reply = await patchMe(someone.jwt, body);
        assert.equal(reply.status, 403);
        assert.equal(reply.body.error, 'Owners only');
      }
    }
  });

  test('an owner without a profile gets 404', async (t) => {
    const bare = await createLoggedInUser(t, { role: 'OWNER' });
    const reply = await patchMe(bare.jwt, edit());
    assert.equal(reply.status, 404);
    assert.equal(reply.body.error, 'Owner profile not found');
  });
});
