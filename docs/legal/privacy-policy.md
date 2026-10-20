# Studify Privacy Policy — DRAFT

> **Draft for review, not legal advice.** Written from what the code collects (October 2026).
> Before publishing: fill every `[…]`, decide the minimum-age question (see "Children"), and
> have someone qualified check it against the laws where your users live (e.g. GDPR / KVKK /
> COPPA). Then publish it as `public/privacy.html` and link it from the app and the Google
> OAuth consent screen.

_Last updated: […date…]_

Studify ("we", "us") is a study app run by […name / company…], […address…]. This policy explains
what we collect, why, and the choices you have. Contact: […contact email…].

## You can use Studify without an account

Without an account, everything stays **on your device** (your browser's local storage): your decks,
study history, settings, avatar and progress. We don't receive any of it.

## What we collect when you create an account

| Data | Why |
| :--- | :--- |
| Name, email address | To identify your account and let you sign in |
| Password (stored only as a salted PBKDF2 hash) | Password sign-in |
| Google account ID and profile picture URL, if you sign in with Google | Google sign-in |
| Age, country, grade, school/institution and an avatar emoji, if you enter them at sign-up | To tailor starter decks and levels |
| Your decks, study statistics and how your avatar looks, when cloud sync is on | To keep your work on all your devices |
| Daily counts of AI requests per account | Fair-use limits on the shared AI service |
| Your IP address, with a daily count of AI requests from it | Abuse prevention and fair-use limits. **[Decide and implement a retention period, e.g. delete after 30 days.]** |

Signing in gives you a session token that lasts 7 days and is kept in your browser.

## Community decks

If you publish a deck, its title, subject, description, cards and your display name become
**public**. You can delete your published decks at any time. If you report a deck, we store your
report and its reason.

## AI features

When you use AI features (turning notes or PDFs into cards, explanations, checking an explanation),
the text or images you submit are sent to **Google's Gemini API** to produce the answer:

- through our server, if you're signed in and use the shared AI service; or
- directly from your browser, if you add your own Gemini API key in Settings (the key stays in your
  browser).

Google processes these requests under its own terms. Don't submit personal or sensitive information
you don't want processed this way.

## Who processes data for us

- **Render** (hosting of the website and API, EU – Frankfurt)
- **Supabase** (database, […region…])
- **Google** (sign-in, Gemini AI, web fonts)

We don't sell your data and we don't use advertising or tracking cookies.
**[If you add error tracking or analytics later, list it here.]**

## Keeping and deleting your data

Your account data is kept while your account exists. You can **delete your account in the app**
(your account → *Delete account*). That removes your account, synced decks, statistics, likes,
reports and per-account AI usage records. Decks you published to the community stay public under the
display name they were published with (no longer linked to any account) unless you delete them
first.

## Your rights

Depending on where you live, you can ask to access, correct, export or delete your data, or object to
how it is used. Write to […contact email…]. You can also complain to your data protection authority.

## Children

**[Decision needed.]** Studify's sign-up asks for age and grade and is aimed at students. Choose one,
and make the app enforce it:

- a minimum age (e.g. 13, or 16 in some EU countries) for accounts, with younger students using
  Studify without an account; or
- parental consent for younger users, as required by the laws where they live.

## Changes

We'll update this page when the app changes what it collects, and change the date at the top.
