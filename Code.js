function archiveOldEmails() {
  // [ACTION_REQUIRED]: Update this list with the search patterns you want to archive
  const searchPatterns = [
    { type: "from", address: "no-reply@pagerduty.com" },
    { type: "from", address: "jira@submittable.atlassian.net" },
    { type: "replyto", address: "health@aws.com" },
    { type: "from", address: "no-reply@digicert.com" },
    { type: "from", address: "azure-noreply@microsoft.com" }
  ];
  
  var daysOld = 14;

  // Calculate the date 14 days ago
  var date = new Date();
  date.setDate(date.getDate() - daysOld);
  var dateString = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy/MM/dd");
  
  console.log(`Starting archive process for emails older than ${daysOld} days...`);

  // Loop through each pattern in the list
  for (const pattern of searchPatterns) {
    try {
      // Search for threads matching the pattern older than the calculated date that are still in the inbox
      var query = pattern.type + ":" + pattern.address + " older_than:" + daysOld + "d is:inbox";
      var threads = GmailApp.search(query);
      
      if (threads.length === 0) {
        console.log(`No threads found for ${pattern.type}: ${pattern.address}`);
        continue;
      }

      console.log(`Found ${threads.length} threads for ${pattern.type}: ${pattern.address}. Archiving...`);
      
      // Archive each thread
      for (var i = 0; i < threads.length; i++) {
        try {
          threads[i].moveToArchive();
          threads[i].markRead();
        } catch (threadError) {
          console.error(`Failed to archive a thread for ${pattern.type} ${pattern.address}: ${threadError.message}`);
        }
      }
    } catch (error) {
      console.error(`Error processing pattern ${pattern.type}:${pattern.address}: ${error.message}`);
    }
  }
  
  console.log("Archive process complete.");
}
