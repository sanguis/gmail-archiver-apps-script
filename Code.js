/**
 * Archives stale notification email so it stops cluttering the inbox.
 *
 * For each configured sender pattern, any thread still sitting in the inbox
 * that is older than `daysOld` is moved to the archive and marked read.
 * Nothing is ever deleted; archived threads stay in All Mail.
 */

/**
 * Reads the values supplied by the optional private_values.js file.
 *
 * Apps Script has no `require`, so there is nothing to include here: every
 * file in a project is evaluated into one shared global scope, and
 * private_values.js contributes to it by assigning `globalThis.PRIVATE_VALUES`
 * (see private_values.example.js). Reading through `globalThis` rather than
 * probing a bare identifier is what makes the file genuinely optional -- a
 * missing property is `undefined`, whereas a bare identifier would be a
 * ReferenceError and would need a `typeof` guard to be safe.
 *
 * .clasp.json lists private_values.js first in `filePushOrder`, so it is the
 * first file in the project and its values are in place before anything else
 * runs.
 *
 * @return {!Object} The private values, or an empty object when the file is
 *     not part of this deployment.
 */
function getPrivateValues() {
  return globalThis.PRIVATE_VALUES || {};
}

/**
 * Builds the list of sender patterns whose stale mail should be archived.
 *
 * @param {!Object} values Private values, as returned by getPrivateValues().
 * @return {!Array<{type: string, address: string}>} The patterns to search.
 */
function buildSearchPatterns(values) {
  // [ACTION_REQUIRED]: Update this list with the search patterns you want
  // to archive. These vendor addresses are the same for every organization,
  // so they are safe to keep in version control.
  const searchPatterns = [
    {type: 'from', address: 'azure-noreply@microsoft.com'},
    {type: 'from', address: 'gemini-notes@google.com'},
    {type: 'from', address: 'no-reply@digicert.com'},
    {type: 'from', address: 'no-reply@dtdg.com'},
    {type: 'from', address: 'no-reply@pagerduty.com'},
    {type: 'from', address: 'no-reply@vanta.com'},
    {type: 'from', address: 'notifications@github.com'},
    {type: 'from', address: `confluence@${values.companySlug}.atlassian.net`},
    {type: 'from', address: `jira@${values.companySlug}.atlassian.net`},
    {type: 'header:Sender', address: 'calendar-notification@google.com'},
    {type: 'replyto', address: 'f-no-reply@akamai.com'},
    {type: 'replyto', address: 'health@aws.com'},
  ];
  return searchPatterns;
}

/**
 * Entry point. Archives inbox threads matching the configured patterns that
 * are older than the cutoff.
 */
function archiveOldEmails() {
  const searchPatterns = buildSearchPatterns(getPrivateValues());

  const daysOld = 14;

  console.log(
      `Starting archive process for emails older than ${daysOld} days...`);

  for (const pattern of searchPatterns) {
    const label = `${pattern.type}: ${pattern.address}`;
    try {
      // Match only threads that are still in the inbox and past the cutoff.
      const query =
          `${pattern.type}:${pattern.address} older_than:${daysOld}d is:inbox`;
      const threads = GmailApp.search(query);

      if (threads.length === 0) {
        console.log(`No threads found for ${label}`);
        continue;
      }

      console.log(`Found ${threads.length} threads for ${label}. Archiving...`);

      for (let i = 0; i < threads.length; i++) {
        try {
          threads[i].moveToArchive();
          threads[i].markRead();
        } catch (threadError) {
          console.error(
              `Failed to archive a thread for ${label}: ` +
              `${threadError.message}`);
        }
      }
    } catch (error) {
      console.error(`Error processing pattern ${label}: ${error.message}`);
    }
  }

  console.log('Archive process complete.');
}
