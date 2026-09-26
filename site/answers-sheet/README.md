# The answers sheet

The site's two tester pages send their answers to a Google Sheet that belongs to
the project's owner:

- `/check/`, the colour-vision check ([#108](https://github.com/fortemate/dicechess-tv/issues/108));
- `/feedback/`, the feedback form for people who played the game ([#109](https://github.com/fortemate/dicechess-tv/issues/109)).

[`Code.js`](Code.js) is the Google Apps Script bound to that sheet. It appends
one row per submission, to a tab named `check` or `feedback`, and creates each
tab with its header row on the first submission. No name, email or IP address
reaches it. It refuses any value outside the lists the pages offer, and any text
longer than 1,000 characters. It stops at 5,000 rows a tab, and it stores text
so that the sheet never runs it as a formula.

Neither page sends anything until the visitor presses Send.

## Setting it up

1. Create a Google Sheet, for example "Dice Chess TV answers".
2. In the sheet, open **Extensions → Apps Script**. Replace the contents of
   `Code.gs` with [`Code.js`](Code.js), and save.
3. Choose **Deploy → New deployment**, with the type **Web app**:
   - **Execute as:** Me;
   - **Who has access:** Anyone.
4. Press **Deploy** and allow the script to use the sheet. Google warns that the
   app is not verified, because it is your own script: choose **Advanced**, then
   **Go to** the project.
5. Copy the **Web app** URL, which ends in `/exec`. Opening it in a browser
   should show one line: "Dice Chess TV answers: this address accepts the answers
   of the site."
6. On GitHub, in the repository's **Settings → Secrets and variables → Actions
   → Variables**, create the repository variable `FEEDBACK_URL` with that URL.
7. Deploy the site again: **Actions → CD: Deploy Site → Run workflow**.

Without the variable, nothing is sent. The check page shows the answers as a
code to copy and send by hand, and the feedback page says that it is not
collecting answers yet.

## Changing or stopping it

- **A new version of the script.** Paste it, then **Deploy → Manage
  deployments**, edit the deployment and choose **Version: New version**. The URL
  stays the same.
- **Stopping.** **Deploy → Manage deployments → Archive**. Delete the variable
  and deploy the site again to stop the pages from sending.

## Reading the results

The `check` tab holds, for each visit, the colour-vision answer, the screen, and
four counts for each variant:

- the marked pieces found;
- the marked pieces missed;
- the taps on a last-move square;
- the other taps.

The `Details` column keeps the order the pictures were shown in and the squares
tapped on each. [`../scripts/check-results.mjs`](../scripts/check-results.mjs)
summarises either those details or the codes of the fallback, per variant and
per answer to the colour-vision question.
