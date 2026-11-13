# ThunderCards

ThunderCards customises Cards View in Mozilla Thunderbird 160.x. It combines dark message cards, account badges, quick deletion and the optional EMBER theme in one add-on.

![Unified Inbox with EMBER banner and account badges](screenshots/01-unified-inbox.png)

## Install or upgrade

1. Download `ThunderCards-1.7.7.xpi` from [Releases](../../releases/tag/v1.7.7).
2. In Thunderbird, open **Add-ons and Themes → Extensions**.
3. From the gear menu, select **Install Add-on From File**, choose the XPI and accept the installation prompt.
4. Select **Cards View** in the message list.

The XPI retains the existing ThunderCards add-on ID so it installs over earlier versions. The card styling is bundled and does not require `userChrome.css`. The add-on uses a Thunderbird Experiment and is restricted to Thunderbird 160.x.

## How it works

| Feature | What you'll see |
| --- | --- |
| Sender layout | Sender name, plain email address and subject on separate lines. Sent folders keep Thunderbird’s recipient display. |
| Card states | Blue borders and green dots for unread messages, grey borders for read messages and purple styling for selection. The virtual list uses a 117 px row pitch. |
| Account badges | Matching two-letter badges on account entries in the folder pane and on messages in combined views, including when a filter leaves results from a single account. Standard folder-type icons are retained. |
| Quick delete | The trash button beside the three-dot menu uses Thunderbird’s delete command. The button is disabled when the add-on cannot safely use the account’s Trash behaviour. |
| After deleting | For a selected single message, the add-on prefers the next visible message in the current list, or the previous message at the end. Thread and multiple-selection cases use Thunderbird’s native handling. |
| EMBER theme | A dark palette, orange accents and a full-width EMBER banner. |

## Settings

Open **Add-ons and Themes → Extensions → ThunderCards → Preferences**. You can also right-click a supported folder-pane account badge and choose **Edit account badge** to open settings for that account.

To add a mail account, use Thunderbird’s **Account Settings → Account Actions → Add Mail Account**. ThunderCards detects supported accounts automatically and assigns each a badge. Reopen ThunderCards preferences to see newly added accounts in the account picker. Badge choices are stored in your Thunderbird profile using the account’s internal ID, and saved choices carry over when upgrading.

- **Enable EMBER Theme** applies or removes the EMBER palette and banner. It is enabled by default.
- Choose an **Account**, enter a **Two-letter label**, pick a **Badge colour** and click **Save badge**.
- Select **Use Thunderbird account colour or automatic fallback** to let ThunderCards choose the colour. **Reset to automatic** clears the account’s custom badge settings.

![ThunderCards theme and account badge settings](screenshots/05-theme-and-badge-settings.png)

## Screenshots

The screenshots use a disposable profile with sample messages.

- [Unified Inbox and EMBER banner](screenshots/01-unified-inbox.png)
- [Card states and quick-delete control](screenshots/02-card-states-and-controls.png)
- [Individual Inbox](screenshots/03-individual-inbox.png)
- [Threaded conversation](screenshots/04-threaded-conversation.png)
- [Theme and badge settings](screenshots/05-theme-and-badge-settings.png)

## Build from source

On Windows with PowerShell, run `./build.ps1` from the repository root. The script packages the contents of `addon/` into a versioned XPI in `dist/`.

## Roll back

To remove just the EMBER palette and banner, clear **Enable EMBER Theme** in ThunderCards settings. To restore Thunderbird’s native cards and controls, disable ThunderCards in **Add-ons and Themes → Extensions**. Any styling supplied by your active theme or profile CSS still applies. To return to a previous ThunderCards version, install the earlier XPI from a local copy using **Install Add-on From File**.
