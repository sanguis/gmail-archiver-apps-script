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
 * Extra query terms required alongside a given search operator, keyed by that
 * operator. Operators absent from this map are searched on their own.
 *
 * Google Calendar sends its invitations `From:` the human organizer rather
 * than from Google, so a `from` pattern cannot catch them and the subject
 * prefix is the only thing that marks a message as calendar mail. Those
 * prefixes are too common to trust alone -- "Accepted:" also matches an
 * ordinary Outlook RSVP or a vendor's "You accepted ..." notice -- so they are
 * paired with the footer phrase Google Calendar puts in every one of these
 * messages. Excluding replies and forwards leaves human conversation about an
 * event alone even when it quotes the invitation underneath.
 *
 * @const {!Object<string, string>}
 */
const SEARCH_QUALIFIERS = {
  'subject': '"Invitation from Google Calendar" -subject:Re -subject:Fwd',
};

/**
 * Builds the sender patterns whose stale mail should be archived, grouped by
 * the Gmail search operator that matches them.
 *
 * @param {!Object} values Private values, as returned by getPrivateValues().
 * @return {!Object<string, !Array<string>>} Addresses to search, keyed by the
 *     Gmail search operator to match them with.
 */
function buildSearchPatterns(values) {
  // [ACTION_REQUIRED]: Update these lists with the search patterns you want
  // to archive. These vendor addresses are the same for every organization,
  // so they are safe to keep in version control.
  const searchPatterns = {
    'from': [
      'azure-noreply@microsoft.com',
      'calendar-notification@google.com',
      'gemini-notes@google.com',
      'microsoft-noreply@microsoft.com',
      'no-reply@digicert.com',
      'no-reply@dtdg.com',
      'no-reply@pagerduty.com',
      'no-reply@vanta.com',
      'noreply@akamai.com',
      'noreply@registrar.amazon',
      'notifications@github.com',
      'sf-no-reply@akamai.com',
      'ssl_isales@digicert.com',
      `confluence@${values.companySlug}.atlassian.net`,
      `jira@${values.companySlug}.atlassian.net`,
      'supportportal@mongodb.com',
      'support@github.com',
      'no-reply@rippling.com',
      'mongodb-atlas@mongodb.com',
      'no-reply-prod@pagerduty.com',
      'noreply@github.com',
      'specialist@akamai.com',
      'support@datadog.zendesk.com',
    ],
    // Google Calendar invitations, updates, cancellations and RSVP replies.
    // Gmail matches whole words in a subject, so 'invitation' also covers
    // "Updated invitation:", "Invitation with note:" and "Updated invitation
    // with note:", and "Canceled event" covers "Canceled event with note:".
    // Every entry here is narrowed by SEARCH_QUALIFIERS['subject'].
    //
    // A `header:Sender` pattern for calendar-notification@google.com looks
    // like the obvious way to match these and is not: Gmail's `header:`
    // operator only matches recently indexed mail, so it returns nothing at
    // all once `older_than:` is applied.
    'subject': [
      'invitation',
      '"Canceled event"',
      'Accepted',
      'Declined',
      '"Proposed new time"',
    ],
    'replyto': [
      'sf-no-reply@akamai.com',
      'health@aws.com',
      'aws-marketing-email-replies@amazon.com',
      'hello@toriihq.com',
      'no-reply-aws@amazon.com',
      'no-reply@docker.com',
      'noreply@digicert.com',
      'no-reply@amazonaws.com',
    ],
  };
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

  for (const [type, addresses] of Object.entries(searchPatterns)) {
    for (const address of addresses) {
      const label = `${type}: ${address}`;
      try {
        // Match only threads that are still in the inbox and past the cutoff.
        const query = [
          `${type}:${address}`,
          SEARCH_QUALIFIERS[type],
          `older_than:${daysOld}d`,
          'is:inbox',
        ].filter(Boolean).join(' ');
        const threads = GmailApp.search(query);

        if (threads.length === 0) {
          console.log(`No threads found for ${label}`);
          continue;
        }

        console.log(
            `Found ${threads.length} threads for ${label}. Archiving...`);

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
  }

  console.log('Archive process complete.');
}
