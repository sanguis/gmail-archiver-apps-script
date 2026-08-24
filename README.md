# Gmail Archiving

A small [Google Apps Script](https://developers.google.com/apps-script) that automatically archives
noisy, low-value email — alert and notification mail from services like PagerDuty, Jira, AWS Health,
DigiCert, and Azure — once it has sat in your inbox for a while.

The script searches your inbox for messages matching a list of sender patterns, and for any thread
older than the configured cutoff it moves the thread to the archive and marks it read. Nothing is
deleted.

## Contents

| File | Purpose |
| --- | --- |
| `Code.js` | The `archiveOldEmails()` function — search patterns, age cutoff, and archive logic |
| `appsscript.json` | Apps Script project manifest (timezone, V8 runtime, logging) |
| `eslint.config.mjs` | ESLint flat config applying the Google JavaScript style guide |
| `package.json` | Lint tooling and the `lint-staged` pre-commit task list |
| `.husky/pre-commit` | Git hook that runs the style checks against staged files |

`.clasp.json` is intentionally **not** committed — it holds the script ID of a specific Apps Script
project, so you generate your own in the setup below.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer (for `npx`)
- A Google account with Gmail
- The Google Apps Script API enabled for your account — turn it on at
  <https://script.google.com/home/usersettings> (one-time, per account)

New to `clasp`? Start with the official guide:
**[Using clasp — Apps Script command line interface](https://developers.google.com/apps-script/guides/clasp)**

## Importing the script into your Gmail account

### 1. Clone this repository

```zsh
git clone https://github.com/sanguis/gmail-archiver-apps-script.git
cd  gmail-archiver-apps-script.git
```

### 2. Log in to clasp

```bash
npx @google/clasp login
```

This opens a browser window and asks you to grant `clasp` access to manage your Apps Script
projects. Credentials are stored in `~/.clasprc.json`.

### 3. Create your own Apps Script project

This creates a new, standalone script in *your* Google account and writes a local `.clasp.json`
pointing at it:

```bash
npx @google/clasp create-script --title "Gmail Archiving" --type standalone --rootDir .
```

> On clasp v2 the command is `clasp create` instead of `clasp create-script`.

If `create-script` offers to overwrite `appsscript.json`, decline — or if it does overwrite it,
restore the committed version with `git checkout appsscript.json`.

Already have a script you want to push to? Skip this step and create `.clasp.json` yourself:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": ""
}
```

You can find the script ID in the Apps Script editor under **Project Settings**.

### 4. Push the code up

```bash
npx @google/clasp push
```

### 5. Configure your search patterns

Open the project in the Apps Script editor:

```bash
npx @google/clasp open-script
```

In `Code.js`, edit the `searchPatterns` array to match the mail *you* want archived, and set
`daysOld` to how long a thread should linger before it gets archived:

```js
const searchPatterns = [
  { type: "from",    address: "no-reply@example.com" },
  { type: "replyto", address: "alerts@example.com" },
  { type: "to",      address: "my-alias@example.com" }
];

var daysOld = 14;
```

`type` is any Gmail search operator that takes an address — `from`, `to`, `cc`, `replyto`. The
resulting query looks like `from:no-reply@example.com older_than:14d is:inbox`.

You can also edit `Code.js` locally and re-run `npx @google/clasp push` — that is the intended
workflow if you want your changes tracked in git. Use `npx @google/clasp pull` to bring editor-side
changes back down.

### 6. Authorize and test-run

In the Apps Script editor, select the `archiveOldEmails` function and click **Run**. The first run
prompts for authorization — Gmail access is inferred from the script's use of `GmailApp`, so you'll
be asked to allow the script to read, compose, send, and permanently delete your mail (the broad
`GmailApp` scope; this script only searches and archives).

Because the project is unverified you'll see a "Google hasn't verified this app" warning: choose
**Advanced → Go to Gmail Archiving (unsafe)** to continue with your own script.

Check the execution log to confirm the counts look right before automating it.

### 7. Schedule it

In the Apps Script editor, open **Triggers** (the alarm-clock icon) → **Add Trigger**:

- Function: `archiveOldEmails`
- Event source: **Time-driven**
- Type: **Day timer** (a daily run is plenty, since the cutoff is measured in days)

That's it — the inbox stays clean on its own from here.

## Linting (Google JavaScript style)

Code is linted against the
[Google JavaScript style guide](https://google.github.io/styleguide/jsguide.html)
via ESLint, and a pre-commit hook enforces it so unstyled code cannot land.

### One-time setup after cloning

```bash
npm install
```

`npm install` runs the `prepare` script, which installs the git hook via
[husky](https://typicode.github.io/husky/). Nothing else is required — the hook
lives in `.husky/pre-commit` and is version-controlled.

### Commands

| Command | What it does |
| --- | --- |
| `npm run lint` | Check every `.js` / `.gs` file; non-zero exit on any problem |
| `npm run lint:fix` | Same, but auto-fix quotes, indentation, commas, `var` |
| `npm run lint:manifest` | Confirm `appsscript.json` is still valid JSON |

### What the hook does

On `git commit`, [lint-staged](https://github.com/lint-staged/lint-staged) runs
`eslint --fix` against **staged** files only. Auto-fixable problems are fixed
and re-staged silently; anything left unfixable (an undefined global, a line
over 80 characters) fails the commit with the error list.

To bypass it in an emergency:

```bash
git commit --no-verify
```

### How the config is put together

`eslint.config.mjs` composes three layers, and the comments there explain why
each is needed:

1. **`@eslint/js` recommended** — correctness rules (`no-undef`,
   unreachable code). Necessary because `eslint-config-google` is purely
   stylistic; on its own it will happily pass a misspelled `GmailApp`.
2. **`eslint-config-google`** — the actual Google style guide: 2-space indent,
   80-column limit, single quotes, trailing commas, `const`/`let` over `var`.
   It still ships in the legacy eslintrc format, so it is bridged into flat
   config with `FlatCompat`.
3. **Apps Script globals** — `eslint-plugin-googleappsscript` supplies the
   names of the Apps Script services (`GmailApp`, `Utilities`, `Session`, ...)
   so `no-undef` does not flag them. `console` is added on top, since the V8
   runtime exposes it for Cloud Logging.

Two caveats worth knowing:

- `eslint-config-google` references `valid-jsdoc` and `require-jsdoc`, which
  ESLint removed from core in v9. The config drops any rule ESLint no longer
  defines, computed against the builtin registry rather than hard-coded, so
  this keeps working as more rules are retired. The practical effect is that
  **JSDoc comments are not enforced** — add `eslint-plugin-jsdoc` if you want
  that back.
- `no-unused-vars` is relaxed to `vars: 'local'` because Apps Script entry
  points like `archiveOldEmails` are called by triggers, never by other code,
  and would otherwise be reported as unused.

## Safety notes

- The script only calls `moveToArchive()` and `markRead()`. It never deletes mail, and archived
  threads remain searchable and in **All Mail**.
- `GmailApp.search()` returns a capped number of threads per call, so the very first run against a
  large backlog may not catch everything. Run it a few times, or let the daily trigger catch up.
- Archiving is easy to undo: search for the sender in Gmail and move threads back to the inbox.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `User has not enabled the Apps Script API` | Enable it at <https://script.google.com/home/usersettings> |
| `Could not read API credentials` | Re-run `npx @google/clasp login` |
| `.clasp.json` not found | You skipped step 3 — create the project or write the file by hand |
| Push overwrote your manifest | `git checkout appsscript.json` and push again |
