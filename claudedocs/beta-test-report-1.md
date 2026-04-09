A total of 20 bugs were documented during testing. Based on the highest stated severity for
each issue, the current breakdown is approximately 6 Critical, 6 Major, 4 Minor, and 4
Cosmetic. A few items still need product clarification, so these counts may shift slightly
depending on final severity decisions.
Checklist:
https://docs.google.com/spreadsheets/d/1vCV27jZ5fLiDm893heBpwLUkbRQ7HZgVpfsyK2s
CEtc/edit?usp=sharing
The areas with the most issues were the Quotes/Jobs workflow and related customer
selection / data refresh behavior. Several issues were also found in Home dashboard
counters, Ask Dyia insights, and UI responsiveness on mobile.
Environments:
MacBook Air M2 2022, macOS Tahoe 26.3.1 Safari 26.3.1
Windows 11 version 25h2 Chrome 146
iPhone 15 Pro Max iOS 26.3.1 Safari
Galaxy S24 Ultra Android 16 Chrome
The Job creation and management flow was pretty intuitive, however scheduling a job was
not really obvious, and there are some issues when creating a Job from a Quote. See UX
observations and Bugs for more details.
UX Observations that might be improved
Registration/Login/Subscription
After completing registration on dyia.io, there is no success or confirmation message. The
user is immediately redirected to the payment step for the Pro plan, which may be confusing
because it is not clear that the account was created successfully.
In addition, the logged-in state is not clearly visible. The site only shows “Dashboard” and
“Start Free,
” but there is no strong indicator such as a profile menu, account label, or logout
button to confirm that the user is signed in.
Also, users who are registered but do not have an active subscription are always redirected
to the pricing page after login or when attempting to access the Dashboard. It is unclear
whether access to the Dashboard without a subscription is intentionally restricted. Also,
there is no Sign out option for such users.
Finally, in Pricing > Basic plan, there is no indication that a payment card is required, unlike
the Pro plan. However, when the user selects the Basic plan, they are still redirected to the
payment step. This behavior may be expected, but the missing message about card
requirements can mislead users.
Additionally, Manage plan from header banner redirects to the User’s settings, but I believe it
can redirect directly to the plan details for better User experience.
Job/Schedule a Job
The Log Job call-to-action does not lead directly to a job creation form or job details page.
Instead, from multiple entry points - including Sidebar > Create > Log Job, Homepage >
Log Job, and Homepage calendar > Log a Job - the user is redirected to the Jobs grid.
This may be confusing, as the call-to-action suggests that the user will be able to log or
create a job immediately.
In addition, it is not obvious where a user can schedule a job. Currently, the scheduling
feature appears to be available only on the Calendar page and not on the Jobs page. From a
usability perspective, users may expect job scheduling options to also be available within the
Jobs area. As a possible improvement, a separate action such as Schedule Job could be
added to the Jobs grid to make this functionality more visible and intuitive.
Name input field
During testing, it was observed that the Name dropdown on the Quotes page does not look
or behave the same as the corresponding field on the Jobs page. For better consistency and
usability, this field should have a similar appearance and interaction pattern across all pages.
❓❓❓Question:
On https://www.dyia.io the header does not look the same on all pages, on the main page it
shows
Intel, Pricing Calculator, Free quiz, Features, Dyia AI, Pricing FAQ, Sign In and Start Free,
but if I proceed to the
Support page, it shows only Home and Dashboard in the Header.
Privacy Policy page shows Home and Support,
Terms of Service shows Home and Support,
Pricing Calculator shows Pricing Calculator, Profit Quiz, Features, Sign In and Start Free,
Free Quiz shows Pricing Calculator, Quiz, Sign in and Start Free,
On Mobile, Intel, Pricing Calculator and Free quiz are not available.
Let me know if this is expected or the header should look the same across all pages.
Video: https://www.loom.com/share/52c8fddf537e4e609805873cf6964fa1
Issues
BUG-001: Sign In link is not shown in the website header on mobile
Date: 04/03/2026
Page / Screen: Public-facing website
Severity: Critical (for UX) - Major (as user can restart app and get Sign in screen again)
Browser & Device: All mobile devices and browsers
Steps to reproduce:
1. Open https://www.dyia.io on mobile and observe the links shown in the header.
2. Open Dyia app. The sign-in form is shown.
3. Click Back to homepage on the sign-in form, or log out and get redirected to the
4. homepage.
Observe that there is no obvious way to return to the sign-in page from the
homepage.
Actual result: The Sign In link is not shown in the website header on mobile, so there is no
obvious way for a user to log in from the homepage. There are workarounds, such as using
the Sign In link in the footer or the link on the Create your account form. The user has to
restart the app in order to get Sign in form again.
Video: https://www.loom.com/share/0b8f86be6121466c96196a2167b96539
Expected result: Sign In link should be shown on the website in the header, so there is an
obvious way for a user to log in.
BUG-002: User has Dyia Pro subscription plan if they selected Basic plan before
proceeding to Checkout
Date: 04/03/2026
Page / Screen: Quotes and Jobs
Severity: Critical ? (depends on the business requirements)
Browser & Device: All browsers and devices
Steps to reproduce:
5. Open https://www.dyia.io and click “Start Free”
.
6. In “Create your account” fill in all fields with valid data and click “Continue”
.
7. Enter valid code(received via email) to verify your email and observe the result: user
is redirected to the Checkout page, dyia Pro subscription plan is selected.
8. Go back to Dyia.
9. Choose a “Basic” plan.
10. Enter valid payment information (ℹ this step is not shown in the video).
11. Click “Start trial” and observe the result - user is redirected to “Welcome to Dyia”
page.
12. Skip setup.
13. Check the user's subscription plan in the header and Account - Pro plan is shown
everywhere.
Actual result: User has Dyia Pro subscription plan if they selected Basic plan before
proceeding to Checkout
Video: https://www.loom.com/share/eb7ad66ffe444c1cb9d089c1c8d602c4
(ℹ entering payment information step was skipped in the video)
Expected result: User has Dyia Basic subscription plan if they selected Basic plan before
proceeding to Checkout
❓❓❓Clarification needed
Please review this behavior and confirm the expected result for this scenario.
BUG-003: Accepted quote converted to a job is not reflected immediately in Quotes
and Jobs grids until page refresh or re-login
Date: 04/03/2026
Page / Screen: Quotes and Jobs
Severity: Critical
Browser & Device: All browsers and devices
Steps to reproduce:
14. Open https://www.dyia.io and sign in as a registered user with an active subscription.
15. In https://www.dyia.io/app , then navigate to Work > Quotes.
16. Click the “+ New Quote” button.
17. Choose any customer in the “Name” dropdown. In this test, the customer is Hanna
New Use.
18. Click “Save Draft” and verify that the user is redirected to the Quotes grid and that
the newly created quote is displayed with “Draft” status.
19. Click “Mark Sent” for the newly created quote and verify that the status changes to
“Sent”
.
20. Click “Accepted” for the same quote.
21. In the “Convert to Job” pop-up, click “Log Job”
.
22. ⚠ Observe the result:
-
the quote tile is updated, but the “+ Schedule Job” button is still displayed;
-
the Customer label is not shown, unlike other accepted quotes that already
have related jobs and linked customers.
23. Go to Work > Jobs.
24. Try to find the job created from the quote converted in step 8. ❌ The job is not
displayed in the list.
25. Navigate to other pages and then return to the Jobs list. The job is still not displayed.
26. Refresh the Jobs grid and observe the result: the job now appears in the list.
⚠ Note: The timing does not affect the result. I waited approximately 10 minutes after
converting the quote to a job, but it still did not appear in the Jobs grid. The job became
visible only after refreshing the Jobs grid or logging out and back in.
Actual result: When an accepted quote is converted to a job via the “Convert to Job”
pop-up:
-
Quotes grid: the quote tile still shows the “+ Schedule Job” button, and the
Customer label is missing.
Jobs grid: the job created from the quote is not displayed in the list until the page is
refreshed or the user logs out and logs back in.
Video: https://www.loom.com/share/bb92219733214bf19c6c188bf23e76c9
Expected result: When the accepted quote is converted to a job via “Convert to Job”
pop-up:
-
Quotes grid: the quote tile should no longer show the “+ Schedule Job” button,
and the Customer label with the related customer should be displayed.
Jobs grid: the job created from the quote should appear in the list immediately,
without requiring a page refresh or re-login.
-
-
BUG-004: Clicking “+ Schedule Job” on an accepted quote redirects to the New
Estimate page instead of allowing job creation
Date: 04/03/2026
Page / Screen: Quotes
Severity: Critical
Browser & Device: All browsers and devices
Steps to reproduce:
1. Open https://www.dyia.io and sign in as a registered user with an active subscription.
2. In https://www.dyia.io/app , then navigate to Work > Quotes.
3. Click the “+ New Quote” button.
4. Choose any customer in the “Name” dropdown. In this test, the customer is Hanna
New Use.
5. Click “Save Draft” and verify that the user is redirected to the Quotes grid and that
the newly created quote is displayed with “Draft” status.
6. Click “Mark Sent” for the newly created quote and verify that the status changes to
“Sent”
.
7. 8. 9. Click “Accepted” for the same quote.
In the “Convert to Job” pop-up, click “Skip”
.
Observe the result: the quote tile is updated, the “+ Schedule Job” button is
displayed.
10. Click “+ Schedule Job” for the quote.
11. Observe the result: the user is redirected to the “New Estimate” page, but there is
no actual option to schedule or create a job.
Actual result: When an accepted quote is not converted to a job via the “Convert to Job”
pop-up, clicking “+ Schedule Job” redirects the user to the “New Estimate” page instead
of providing a way to create or schedule a job.
Video: https://www.loom.com/share/21b5278aa5be4981b741562a93c9acac
Expected result: When an accepted quote is not converted to a job via the “Convert to
Job” pop-up, clicking “+ Schedule Job” should provide the user with an option to create or
schedule a job for that quote.
❓❓❓Clarification needed
Please review this behavior and confirm the expected result for this scenario.
BUG-005: Customer not shown in Customers grid is still available for selection in
Quotes and Jobs
Date: 04/03/2026
Page / Screen: Quotes and Jobs
Severity: Critical - Major
Browser & Device: All browsers and devices
Preconditions:
-
-
There are 11 customers in the user account under Customers > Customers.
Tom Anderson is not displayed in the Customers list.
Steps to reproduce:
1. Open https://www.dyia.io and sign in as a registered user with an active subscription.
2. In https://www.dyia.io/app , then navigate to Customers > Customers.
3. Search for Tom Anderson mentioned in the preconditions and verify that this
customer is not shown in the search results.
4. Navigate to Work > Quotes.
5. Click “+ New Quote”
.
6. Search for Tom Anderson in the Name field and observe the result: this customer is
shown in the search results and can be selected for a new quote.
7. Navigate to Work > Jobs.
8. Click “+ Log Job”
.
9. Search for Tom Anderson in the Customer Name field and observe the result: this
customer is shown in the search results and can be selected for a new job.
Actual result: Although Tom Anderson is not displayed in the Customers grid and cannot
be found there, the customer still appears in the customer search results in both:
●
●
Work > Quotes > + New Quote
Work > Jobs > + Log Job
As a result, the customer can still be selected for creating a new quote or logging a new job.
Video: https://www.loom.com/share/c0948933905b4810aee518620ac06979
Expected result: If a customer is not available in the Customers grid, this customer should
also not appear in the customer selection/search results when creating a new quote or
logging a new job.
BUG-006: Customer contact information is not cleared when switching to a customer
who has no contact details.
Date: 04/03/2026
Page / Screen: Quotes and Jobs
Severity: Critical (if there are users with and without contact info)
Browser & Device: All browsers and devices
Preconditions: For this test, there should be customers in the list both with and without
contact/address information.
Steps to reproduce:
1. 2. 4. Open https://www.dyia.io and sign in as a registered user with an active subscription.
In https://www.dyia.io/app , then navigate to Work > Quotes.
3. Click “+ New Quote”
.
Search for any customer with existing contact information and select that customer
from the list. Verify that the correct customer information is displayed after selection.
5. Click “Edit”
.
6. Search for another customer with existing contact information and select that
customer from the list. Verify that the customer information is updated accordingly
after selection.
7. Click “Edit” again.
8. Search for a different customer who does not have any contact information and
select that customer from the list.
9. ⚠ Observe the result: the previously selected customer’s contact information is still
displayed for the newly selected customer, even though this customer has no contact
information.
10. Navigate to Work > Jobs.
11. Click “+ Log Job”
.
12. Search for any customer with existing contact information and select that customer
from the list.
13. Click the Add contact info link and verify that the correct customer information is
displayed after selection.
14. Search for another customer with existing contact information and select that
customer from the list. Verify that the customer information is updated accordingly
after selection.
15. Search for a different customer who does not have any contact information and
select that customer from the list.
16. ⚠ Observe the result: the previously selected customer’s contact information is still
displayed for the newly selected customer, even though this customer has no contact
information.
Actual result: When switching from a customer with contact information to a customer who
does not have any contact information, the previously selected customer’s contact details
remain displayed instead of being cleared. This issue occurs in both flows:
●
●
Quotes > + New Quote
Jobs > + Log Job
Video: https://www.loom.com/share/b180ea2761b74319b4a24e28648fb403
Expected result: When a customer without contact information is selected, no previous
customer data should remain visible. The contact information section should either be empty
or display no contact information for the selected customer. The displayed data should
always match the currently selected customer.
BUG-007: Items are not tappable in the header Account menu.
Date: 04/03/2026
Page / Screen: Quotes and Jobs
Severity: Major
Browser & Device: iPhone 15 Pro Max iOS 26.3.1 Safari
Steps to reproduce:
10. Open https://www.dyia.io and sign in as a registered user with an active subscription.
11. In https://www.dyia.io/app in the header tap the Account menu.
12. Tap links in the expanded header Account menu and pay attention to the result.
Actual result: Items are not tappable in the header Account menu, nothing happens after
tapping the links.
Video: https://www.loom.com/share/5d9318ddb2d44d36ab71dc1a90520a19
Expected result: Items should be tappable in the header Account menu, appropriate
actions/pages should be performed/opened after tapping the links.
BUG-008: Recently saved changes to customer details are not reflected immediately.
A page refresh is required to see the updated values.
Date: 04/03/2026
Page / Screen: Customers
Severity: Major
Browser & Device: All browsers and devices
Preconditions: there should be customers on the Customers grid
Steps to reproduce:
1. Open https://www.dyia.io and sign in as a registered user with an active subscription.
2. In https://www.dyia.io/app, navigate to Customers > Customers.
3. Open any Customer Details page.
4. Click “Edit”
.
5. Update the values in all fields.
6. Click “Save Changes”
.
7. Open the same customer’s details again and review the field values.
8. Observe that the old values are still displayed.
9. Refresh the page.
10. Observe that the newly saved values are now shown.
Actual result: After saving changes, the customer details page continues to display the old
values. The updated values appear only after the page is refreshed.
Video: https://www.loom.com/share/2b59d35873104b9295e3fec5d746572e
Expected result: After clicking Save Changes, the customer details page should
immediately display the newly saved values without requiring a manual page refresh.
BUG-009: Updated first and last name values are not reflected in the profile or header
account menu after saving.
Date: 04/03/2026
Page / Screen: Settings
Severity: Major
Browser & Device: All browsers and devices
Steps to reproduce:
11. Open https://www.dyia.io and sign in as a registered user with an active subscription.
12. In https://www.dyia.io/app, navigate to Settings > Account.
13. Click “Edit Profile”
.
14. Update the First Name and Last Name fields.
15. Click “Save”
.
16. Observe the name shown in the profile section.
17. Open the header Account drop-down menu and observe the displayed name.
18. Click Edit Profile again and observe the name shown in the profile details pop-up.
19. Refresh the page and observe the result again.
Actual result: After saving, the updated first and last name are shown only in the Edit
Profile pop-up. The profile section and the header Account drop-down continue to display
the previous name. Refreshing the page does not update the displayed name.
Video: https://www.loom.com/share/d683d989581c4c44bee99a9d87b7562d
Expected result: After clicking Save, the updated first and last name should be reflected
consistently across the profile section, the header Account drop-down, and the Edit Profile
pop-up, without requiring any additional action.
BUG-0010: Incorrect information is shown in the Jobs report
Date: 04/05/2026
Page / Screen: Ask Dyia
Severity: Major
Browser & Device: All browsers and devices
Preconditions: User should have multiple jobs in their account
Steps to reproduce:
1. Open https://www.dyia.io and sign in as a registered user with an active subscription.
2. In https://www.dyia.io/app go to Insights > Ask Dyia.
3. Choose “This week’s stats”
4. Observe the results - only 1 job is listed in the report.
5. Go to Work > Jobs.
6. Observe the result - 19 completed jobs shown in the Jobs list.
Actual result: AI report returns only one job in the week report.
Video: https://www.loom.com/share/0b0e5d614730494f8c9e319e3854e54f
Expected result: AI report returns valid number of jobs existing for the current week in the
week report.
BUG-011: AI does not update logged jobs
Date: 04/05/2026
Page / Screen: Ask Dyia
Severity: Major
Browser & Device: All browsers and devices
Steps to reproduce:
7. Open https://www.dyia.io and sign in as a registered user with an active subscription.
8. In https://www.dyia.io/app go to Insights > Ask Dyia.
9. Type “Log a job”
10. When it replies - type “Sarah, $450, Google, dump $55, gas $20, 2 workers, hauled
away couch + junk.”.
11. Ask to update the job it logged and observe the result - changes are not reflected in
the job.
Actual result: AI cannot update the job it logged.
Video: https://www.loom.com/share/d4b3c0d54eae4563ab36e8bc56d9acc0
Expected result: AI can successfully update the job it logged.
BUG-012: The number of pending quotes is incorrect in the Needs your attention
section.
Date: 04/03/2026
Page / Screen: Home
Severity: Major (UX)
Browser & Device: All browsers and devices
Preconditions: User should have multiple approved quotes in their account
Steps to reproduce:
12. Open https://www.dyia.io and sign in as a registered user with an active subscription.
13. In https://www.dyia.io/app, on the Homepage scroll down to the “NEEDS YOUR
ATTENTION” section.
14. Observe the results - the system says that 17 pending quotes need the user's
attention.
15. Click this row and make sure the user is redirected to the Quotes grid.
16. Observe the result - there are no pending quotes for this user on the grid.
Actual result: 17 pending quotes are shown on the Needs your attention section on the
Homepage if there are no pending quotes for the user.
Video: https://www.loom.com/share/d829c65ebb914679b50d881d11dfb168
Expected result: Pending quotes number shown on the Needs your attention section on the
Homepage should be equal to the actual pending quotes number on the Quotes grid for the
user.
BUG-013: After logging daily expenses for a job, the Other expense appears twice in
the job record, and the note is truncated instead of being fully displayed.
Date: 04/03/2026
Page / Screen: Jobs
Severity: Minor
Browser & Device: All browsers and devices
Steps to reproduce:
17. Open https://www.dyia.io and sign in as a registered user with an active subscription.
18. In https://www.dyia.io/app, navigate to Work > Jobs.
19. Click “+ Log Job”
.
20. Select a customer from the list, enter a revenue value, and add notes.
21. Click “Save”
.
22. Verify that the newly created job is displayed in the grid and that the note is fully
visible.
23. Click “Log daily expenses” for the created job.
24. Enter a value in the “Gas” field.
25. Enter a value in the “Other” field.
26. Enter a note in the “What was other” field.
27. Click “Apply & Calculate”
.
28. Observe the result for the job record: the Other expense is displayed twice, and the
note is not fully visible.
Actual result: After applying daily expenses to the job, the Other expense is displayed
twice in the job record, and the note text is not fully visible.
Video: https://www.loom.com/share/0ddb464fc8b144bfa8635841173c9c06
Expected result: After applying daily expenses to the job, each expense category should be
displayed only once in the job record, and the note text should be fully visible.
BUG-014: Changing the sorting option from “Newest First” to “Oldest First” and vise
versa does not update the Jobs list. The list remains unchanged instead of being
reordered based on the selected sort option.
Date: 04/03/2026
Page / Screen: Jobs
Severity: Minor
Browser & Device: All browsers and devices
Preconditions: there should be multiple jobs on the grid
Steps to reproduce:
1. Open https://www.dyia.io and sign in as a registered user with an active subscription.
2. In https://www.dyia.io/app , then navigate to Work > Jobs.
3. In the sorting dropdown, select “Newest First” and observe the result.
4. In the sorting dropdown, select “Oldest First” and observe the result.
5. Verify whether the jobs list is updated accordingly.
Actual result: When switching between “Oldest First” and “Newest First” in the sorting
dropdown, the jobs list remains unchanged and is not reordered.
Video: https://www.loom.com/share/54893b2697914f2ba96ac5e299f4404f
Expected result: When switching between “Oldest First” and “Newest First” in the
sorting dropdown, the jobs list should be reordered correctly based on oldest/newest jobs.
BUG-015: Revenue sorting option text is truncated in the dropdown.
Date: 04/03/2026
Page / Screen: Jobs
Severity: Cosmetic
Browser & Device: All browsers and devices
Steps to reproduce:
20. Open https://www.dyia.io and sign in as a registered user with an active subscription.
21. In https://www.dyia.io/app , then navigate to Work > Jobs.
22. In the sorting dropdown, select “Revenue: High → Low” and observe how this text
is shown in the sorting drop-down.
23. In the sorting dropdown, select “Revenue: Low → High ” and observe how this text
is shown in the sorting drop-down.
Actual result: The sorting option labels “Revenue: High → Low” and “Revenue: Low →
High” are truncated in the UI and are not fully visible.
Screenshot:
Expected result: The sorting option labels should be fully visible and readable without being
cut off or clipped.
BUG-016: Log daily expenses pop-up is not fully visible on the screen.
Date: 04/03/2026
Page / Screen: Jobs
Severity: Minor/Cosmetic
Browser & Device: All browsers and devices
Steps to reproduce:
24. Open https://www.dyia.io and sign in as a registered user with an active subscription.
25. In https://www.dyia.io/app, navigate to Work > Jobs.
26. Click “Log daily expenses” or “Edit daily expenses”
.
27. Take a look at the display of the Log daily expenses pop-up
Actual result: Log daily expenses pop-up is not fully visible on the screen.
Video desktop: https://www.loom.com/share/d188b06ffb4c45acb2107a29b344a0d4
Video mobile: https://www.loom.com/share/79022943ae35426bb8087ffc43354a05
Expected result: Log daily expenses pop-up should be fully visible on the screen, page can
be scrolled automatically so that the pop-up is fully visible.
BUG-017: Notification banner overlaps or interferes with the header account
drop-down menu.
Date: 04/03/2026
Page / Screen: Home
Severity: Minor/Cosmetic
Browser & Device: MacBook Air M2 2022, macOS Tahoe 26.3.1 Safari 26.3.1
iPhone 15 Pro Max iOS 26.3.1 Safari
Preconditions: Clear browser history and cookies, so that the notification banner is shown
in the beader
Steps to reproduce:
28. Open https://www.dyia.io and sign in as a registered user with an active subscription.
29. In https://www.dyia.io/app, open the header Account menu by tapping the profile
avatar.
30. Observe the layout of the account drop-down.
Actual result: When the top notification banner is displayed, the header/account drop-down
layout is visually broken and overlaps other UI elements/content.
Expected result: The top notification banner should not interfere with the header or account
drop-down. All header elements and the account menu should be displayed correctly without
overlapping other UI components.
BUG-018: Notification banner is displayed cut on mobile.
Date: 04/03/2026
Page / Screen: Home
Severity: Cosmetic
Browser & Device: All mobile browsers and devices
Preconditions: Clear browser history and cookies, so that the notification banner is shown
in the beader
Steps to reproduce:
31. Open https://www.dyia.io and sign in as a registered user with an active subscription.
32. In https://www.dyia.io/app - home observe the display of the notification banner.
Actual result: Notification banner is displayed cut on mobile, buttons are not fully visible.
Expected result: Notification banner is fully visible on mobile, buttons are fully visible as
well.
BUG-019: Page automatically zooms in when tapping some input fields on iPhone
Date: 04/03/2026
Page / Screen: Jobs, Quotes
Severity: Cosmetic
Browser & Device: iPhone 15 Pro Max iOS 26.3.1 Safari
Steps to reproduce:
33. Open https://www.dyia.io and sign in as a registered user with an active subscription.
34. In https://www.dyia.io/app, go to Work > Jobs.
35. Tap Search jobs field and observe the result - page automatically zooms in.
36. Zoom out the page and click “Log daily expenses” and tap any field, observe the
result - page automatically zooms in.
37. Go to Work > Quotes.
38. Tap Search by customers field and observe the result - page automatically zooms in.
39. Tap “+ New Quote”
.
40. In the Line Items tap any field, observe the result - page automatically zooms in.
Actual result: Page automatically zooms in when tapping some input fields on iPhone.
Video: https://www.loom.com/share/e976438548244b0bb38a009b0366dd25
Expected result: Page does not zoom in when tapping any input fields on iPhone.
BUG-020: Dyia logo text is dark on mobile if dark theme is selected.
Date: 04/03/2026
Page / Screen: Header
Severity: Cosmetic
Browser & Device: All mobile devices
Steps to reproduce:
41. Open https://www.dyia.io and sign in as a registered user with an active subscription.
42. In the header choose the dark theme.
43. Take a look at the logo.
Actual result: Dyia logo text is dark on mobile if dark theme is selected.
Expected result: Dyia logo text should be visible on mobile if dark theme is selected.
⚠ There are some customers that have last job -1day, however, I cannot reproduce this
result anymore, so maybe it has been fixed and no longer reproduced for new users