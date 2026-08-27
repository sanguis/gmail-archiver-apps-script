/**
 * Example of the private_values.js file, kept in version control as a
 * template. Copy it to private_values.js and fill in your own values:
 *
 *   cp private_values.example.js private_values.js
 *
 * private_values.js is gitignored and this example is excluded from
 * `clasp push` by .claspignore, so the two never both reach the Apps Script
 * project -- if they did, whichever loaded last would win and could silently
 * replace your real values with the placeholders below.
 *
 * Apps Script has no module system: every file in a project is evaluated into
 * one shared global scope. Assigning to `globalThis` (rather than declaring a
 * top-level `const`) is what lets Code.js read these values with a plain
 * property access and treat a missing file as simply "no values supplied".
 */
globalThis.PRIVATE_VALUES = {
  // Your Atlassian site name -- the `foo` in foo.atlassian.net. Used to build
  // the Jira and Confluence notification addresses to archive.
  companySlug: 'foo',
};
