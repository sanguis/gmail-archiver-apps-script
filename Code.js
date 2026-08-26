/**
 * Archives stale notification email so it stops cluttering the inbox.
 *
 * For each configured sender pattern, any thread still sitting in the inbox
 * that is older than `daysOld` is moved to the archive and marked read.
 * Nothing is ever deleted; archived threads stay in All Mail.
 */
function archiveOldEmails() {
  // [ACTION_REQUIRED]: Update this list with the search patterns you want
  // to archive.
  const searchPatterns = [
    {type: 'from', address: 'no-reply@pagerduty.com'},
    {type: 'from', address: 'jira@submittable.atlassian.net'},
    {type: 'replyto', address: 'health@aws.com'},
    {type: 'replyto', address: 'f-no-reply@akamai.com'},
    {type: 'from', address: 'no-reply@digicert.com'},
    {type: 'from', address: 'azure-noreply@microsoft.com'},
    {type: 'from', address: 'no-reply@dtdg.com'},
    {type: 'from', address: 'no-reply@dtdg.com'},
  ];

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
