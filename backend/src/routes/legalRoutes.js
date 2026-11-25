// The Terms of Use and Privacy Policy as web pages (docs/features/profiles-and-
// registration.md, D1 and P17). The sign-up forms link to them, the app's Settings opens
// them, and Google Play needs a web address for the privacy policy. No login and no
// rate limit: they're fixed text, built once when the server starts.
//
// PLACEHOLDER TEXT. It says only what docs/PRODUCT.md already decides. The real text is
// written in the deployment phase (ROADMAP Phase 5), including the backup retention
// period.
import express from 'express';
import { legalPage } from '../utils/pages.js';

const DRAFT_NOTE = 'This is a draft. The full text will be published before the app launches.';

const termsPage = legalPage({
  title: 'ConnectArena Terms of Use',
  note: DRAFT_NOTE,
  sections: [
    {
      heading: 'About these terms',
      paragraphs: [
        'ConnectArena is a community app for indoor football (futsal) players and venues in Bangladesh. By creating an account you agree to these terms and to the Privacy Policy.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'You need an account with a verified email address to use the app. Each account is either a player or a venue owner, and a venue owner account lists one venue.',
      ],
    },
    {
      heading: "What's not allowed",
      items: [
        'Offensive names or content, in profiles, team names, team descriptions or venue listings',
        'Fake profiles or fake venues',
        'Harassing other users',
        'Spam',
      ],
    },
    {
      heading: 'Reporting and blocking',
      paragraphs: [
        'You can report players, teams and venues that break these rules, and block players you don\'t want to hear from.',
      ],
    },
    {
      heading: 'If the rules are broken',
      paragraphs: [
        'The admin can suspend accounts, delete accounts and delete teams that break these rules. A suspended account can\'t log in.',
      ],
    },
  ],
});

const privacyPage = legalPage({
  title: 'ConnectArena Privacy Policy',
  note: DRAFT_NOTE,
  sections: [
    {
      heading: 'What we store',
      items: [
        'Your email address, and your password in a scrambled form (a hash) that can\'t be turned back into the password',
        'For players: your name, phone number and position, and, if you add them, your height, weight and area',
        'For venue owners: your venue listing (venue name, phone, address, website and description)',
        'Your teams, and the invites and join requests you send or receive',
        'Your notifications: the newest 50 updates about your teams or your venue, with the names of the teams, players and venues they mention',
      ],
    },
    {
      heading: 'Who can see what',
      items: [
        'Only logged-in users can see profiles. Nothing is shown to people who aren\'t logged in.',
        'Any logged-in user can see a player\'s name, position and teams, and their height, weight and area if they added them.',
        'A player\'s phone number is seen only by their teammates (people in the same team) and the admin.',
        'Your email address is seen only by you and the admin.',
        'A venue listing is a business listing, visible to any logged-in user. The owner\'s email address is not shown.',
        'The admin can see every field, to keep the app safe.',
      ],
    },
    {
      heading: 'Emails we send',
      paragraphs: [
        'We email you only about your account: to verify your email address, to reset your password, to tell you your password was changed, to confirm a request to delete your account, and to tell you your account was deleted.',
      ],
    },
    {
      heading: 'Deleting your account',
      paragraphs: [
        'You can delete your account in the app. This deletes your account, your profile, your team memberships, the invites you received, the join requests you sent and your notifications. Notifications that other people have and that mention you by name are deleted too. A team you captain is handed to its longest-standing member, or deleted if nobody else is in it.',
        'Backups of the database may keep deleted data for a limited time. How long will be stated here before the app launches.',
      ],
    },
  ],
});

const router = express.Router();

router.get('/terms', (req, res) => res.type('html').send(termsPage));
router.get('/privacy', (req, res) => res.type('html').send(privacyPage));

export default router;
