<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Gmail Archiving](#gmail-archiving)
  - [Contents](#contents)
  - [Prerequisites](#prerequisites)
  - [Importing the script into your Gmail account](#importing-the-script-into-your-gmail-account)
    - [1. Clone this repository](#1-clone-this-repository)
    - [2. Log in to clasp](#2-log-in-to-clasp)
    - [3. Create your own Apps Script project](#3-create-your-own-apps-script-project)
    - [4. Create your private values file](#4-create-your-private-values-file)
    - [5. Push the code up](#5-push-the-code-up)
    - [6. Configure your search patterns](#6-configure-your-search-patterns)
    - [7. Authorize and test-run](#7-authorize-and-test-run)
    - [8. Schedule it](#8-schedule-it)
  - [Linting and git hooks](#linting-and-git-hooks)
    - [One-time setup after cloning](#one-time-setup-after-cloning)
    - [Commands](#commands)
    - [What runs on commit](#what-runs-on-commit)
    - [What runs on push](#what-runs-on-push)
    - [How the ESLint config is put together](#how-the-eslint-config-is-put-together)
  - [Safety notes](#safety-notes)
  - [Troubleshooting](#troubleshooting)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

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
| `private_values.example.js` | Template for `private_values.js`, the optional file holding your own values |
| `appsscript.json` | Apps Script project manifest (timezone, V8 runtime, logging) |
| `eslint.config.cjs` | ESLint flat config applying the Google JavaScript style guide |
| `.claspignore` | Which local files `clasp push` uploads to the Apps Script project |
| `.pre-commit-config.yaml` | Hook definitions: style and manifest checks, plus deploy on push |

Two files are intentionally **not** committed, and you create both during setup below:

- `.clasp.json` — holds the script ID of one specific Apps Script project.
- `private_values.js` — holds values specific to *your* organization, so they do not end up in a
  public repository. It is optional: with no such file the script still runs, just without the
  patterns that depend on those values.

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

### 4. Create your private values file

Some search patterns are built from values that are specific to your organization — the Atlassian
site name, for instance, which turns into `jira@<slug>.atlassian.net`. Those live in an optional,
gitignored `private_values.js` so they stay out of a public repository.

Copy the committed template and edit it:

```bash
cp private_values.example.js private_values.js
```

```js
globalThis.PRIVATE_VALUES = {
  // Your Atlassian site name — the `foo` in foo.atlassian.net.
  companySlug: 'foo',
};
```

| Value | Used for |
| --- | --- |
| `companySlug` | Building the `jira@<slug>.atlassian.net` and `confluence@<slug>.atlassian.net` patterns |

**This step is optional.** `Code.js` reads the values with
`globalThis.PRIVATE_VALUES || {}`, so if you skip it the script simply runs with the vendor
patterns only and no Atlassian ones. Apps Script has no `require`: every file in a project is
evaluated into one shared global scope, which is why the file assigns to `globalThis` instead of
declaring a `const`, and why a missing file is just a missing property rather than an error.
`.clasp.json` lists `private_values.js` first in `filePushOrder`, so it is the first file in the
project and its values are in place before anything else runs.

Note that `private_values.example.js` is listed in `.claspignore` and is therefore **not** pushed
to Apps Script — only the real `private_values.js` is. If both were pushed, whichever loaded last
would win and the placeholder `foo` could silently replace your real values.

### 5. Push the code up

```bash
npx @google/clasp push
```

This uploads `Code.js`, `appsscript.json`, and — if you created it in step 4 — `private_values.js`.
Confirm what will be sent before pushing:

```bash
npx @google/clasp status
```

`private_values.js` should appear under **Tracked files** and `private_values.example.js` under
**Untracked files**. Re-run `push` after any local edit, including edits to `private_values.js`;
because that file is gitignored, a commit is not what carries it to Apps Script, the push is. If
you have the git hooks installed (see [Linting and git hooks](#linting-and-git-hooks)) then
`git push` runs `clasp push` for you.

### 6. Configure your search patterns

Open the project in the Apps Script editor:

```bash
npx @google/clasp open-script
```

In `Code.js`, edit the `patterns` array inside `buildSearchPatterns()` to match the mail *you* want
archived, and set `daysOld` in `archiveOldEmails()` to how long a thread should linger before it
gets archived:

```js
function buildSearchPatterns(values) {
  const patterns = [
    {type: 'from', address: 'no-reply@example.com'},
    {type: 'replyto', address: 'alerts@example.com'},
    {type: 'to', address: 'my-alias@example.com'},
  ];

  // Patterns that need a value from private_values.js go behind a check, so
  // the script still works for anyone who skipped that file.
  if (values.companySlug) {
    patterns.push(
        {type: 'from', address: `jira@${values.companySlug}.atlassian.net`},
    );
  }

  return patterns;
}
```

`type` is any Gmail search operator that takes an address — `from`, `to`, `cc`, `replyto`. The
resulting query looks like `from:no-reply@example.com older_than:14d is:inbox`.

You can also edit `Code.js` locally and re-run `npx @google/clasp push` — that is the intended
workflow if you want your changes tracked in git. Use `npx @google/clasp pull` to bring editor-side
changes back down.

### 7. Authorize and test-run

In the Apps Script editor, select the `archiveOldEmails` function and click **Run**. The first run
prompts for authorization — Gmail access is inferred from the script's use of `GmailApp`, so you'll
be asked to allow the script to read, compose, send, and permanently delete your mail (the broad
`GmailApp` scope; this script only searches and archives).

Because the project is unverified you'll see a "Google hasn't verified this app" warning: choose
**Advanced → Go to Gmail Archiving (unsafe)** to continue with your own script.

Check the execution log to confirm the counts look right before automating it.

### 8. Schedule it

In the Apps Script editor, open **Triggers** (the alarm-clock icon) → **Add Trigger**:

- Function: `archiveOldEmails`
- Event source: **Time-driven**
- Type: **Day timer** (a daily run is plenty, since the cutoff is measured in days)

That's it — the inbox stays clean on its own from here.

## Linting and git hooks

Code is linted against the
[Google JavaScript style guide](https://google.github.io/styleguide/jsguide.html)
via ESLint, orchestrated by [pre-commit](https://pre-commit.com/). The git hook
is generated by pre-commit rather than hand-written, so hook wiring is never
edited directly — everything is declared in `.pre-commit-config.yaml`.

### One-time setup after cloning

```bash
brew install pre-commit   # or: pipx install pre-commit
pre-commit install
pre-commit install --hook-type pre-push
```

Both commands are needed: the first installs `.git/hooks/pre-commit`, the
second `.git/hooks/pre-push`. Without the second, the deploy hook below never
runs. Those files are generated and untracked, so re-run both in each clone.

Every hook builds its own isolated environment on first run, so there is **no
`npm install` step and no `node_modules`** — ESLint and its plugins are pinned
in `.pre-commit-config.yaml` and installed by pre-commit itself.

### Commands

| Command | What it does |
| --- | --- |
| `pre-commit run --all-files` | Run every hook across the whole repo |
| `pre-commit run eslint` | Run just the style checks on staged files |
| `pre-commit autoupdate` | Bump the pinned hook revisions |
| `pre-commit run --hook-stage pre-push --all-files` | Run the deploy hook by hand — **this pushes to Apps Script** |

### What runs on commit

| Hook | Purpose |
| --- | --- |
| `eslint` (`--fix`) | Google style guide plus correctness rules on `.js` / `.gs` / `.cjs` / `.mjs` |
| `check-json` | Catches a malformed `appsscript.json`, which would break deployment |
| `check-yaml` | Validates `.pre-commit-config.yaml` itself |
| `check-merge-conflict` | Blocks stray conflict markers |
| `end-of-file-fixer`, `trailing-whitespace`, `mixed-line-ending` | Whitespace hygiene, normalizing to LF |

Hooks that repair a file (`--fix`, the whitespace hooks) modify it, report
`Failed`, and stop the commit so you can inspect the change. Re-stage and
commit again:

```bash
git add -u && git commit
```

To bypass the hooks in an emergency:

```bash
git commit --no-verify
```

### What runs on push

| Hook | Purpose |
| --- | --- |
| `clasp-push` | Runs `clasp push --force`, deploying the project to Apps Script |

This is the only hook on the pre-push stage, so ordinary commits stay local and
offline; code reaches Google only when you actually push. A failed style check
at commit time therefore cannot deploy broken code.

Three things to know about it:

- **It deploys whatever is in your working directory**, not the commits you are
  pushing. `clasp push` uploads the files on disk, so uncommitted edits go up
  too.
- **It needs `.clasp.json`**, which is untracked. On a fresh clone the hook
  fails until you have run through the setup above.
- **`--force` is deliberate.** A hook has no terminal to answer clasp's
  "overwrite the remote manifest?" prompt, so without it the push would hang.

Skip the deploy for a single push with:

```bash
git push --no-verify
```

### How the ESLint config is put together

`eslint.config.cjs` composes three layers, and the comments there explain why
each is needed:

1. **`@eslint/js` recommended** — correctness rules (`no-undef`, unreachable
   code). Necessary because `eslint-config-google` is purely stylistic; on its
   own it will happily pass a misspelled `GmailApp`.
2. **`eslint-config-google`** — the actual Google style guide: 2-space indent,
   80-column limit, single quotes, trailing commas, `const`/`let` over `var`.
   It still ships in the legacy eslintrc format, so it is bridged into flat
   config with `FlatCompat`.
3. **Apps Script globals** — `eslint-plugin-googleappsscript` supplies the
   names of the Apps Script services (`GmailApp`, `Utilities`, `Session`, ...)
   so `no-undef` does not flag them. `console` is added on top, since the V8
   runtime exposes it for Cloud Logging.

Three caveats worth knowing:

- **The config must stay CommonJS (`.cjs`), not `.mjs`.** pre-commit exposes
  the hook's dependencies through `NODE_PATH`, and ESM `import` ignores
  `NODE_PATH` while `require` honors it. An `eslint.config.mjs` fails to
  resolve `@eslint/js` and friends unless a local `node_modules` happens to
  exist — which is exactly the dependency this setup avoids. ESLint also
  prefers `.mjs` over `.cjs` when both are present, so do not leave a stray
  `.mjs` alongside this file.
- **Dependency versions live only in `.pre-commit-config.yaml`**, under the
  eslint hook's `additional_dependencies`. Bump them there; `pre-commit
  autoupdate` handles the hook `rev`s but not these pins.
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
| Atlassian mail is not being archived | `private_values.js` is missing or has no `companySlug`; see step 4, then push again |
| Placeholder `foo.atlassian.net` in the deployed patterns | `private_values.example.js` reached the project — check it is still listed in `.claspignore` |
| Push overwrote your manifest | `git checkout appsscript.json` and push again |
