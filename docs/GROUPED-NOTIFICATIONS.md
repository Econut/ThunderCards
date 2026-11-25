# Grouped notifications — 1.7.24

Optional, disabled by default. In ThunderCards Settings → Notifications, enable **Group new-email notifications** and choose 3, 5, 10 or 15 seconds (default 5). A newly observed email resets the quiet timer across all mail accounts. Repeated events for the same message do not reset it. At expiry, emit one summary and invoke Thunderbird's configured mail sound once, subject to the existing preferences and native Do Not Disturb check. The OS alert is requested silently to avoid a second OS sound. No message content appears in the summary.

Saved Thunderbird notification preferences are never changed. Turning grouping off, disabling the add-on or uninstalling cancels pending batches; native notifications resume. Changing the delay cancels any pending batch rather than producing an unexpected late alert. RSS retains native behaviour. Other extensions that replace the notification manager are untested.

The Experiment wraps Thunderbird 160's new-mail notification entry point, using its eligible-folder/new-message-key helpers and existing sound player. Keys are deduplicated by real folder URI and message key. Native notification timestamps are saved at batch closure so arrivals within one second remain countable. No polling, network service or core-file modification is introduced. Settings are independent of theme, badges and card layout.

## Verification — Windows, Thunderbird 160.0, 25 November 2026

All Thunderbird tests used a disposable synthetic profile and a separate extracted official Thunderbird 160 binary. The installed copy had updated to 161.0, so it was not used to assess compatibility. Neither the installed program nor the live profile was modified.

Completed:

- Deterministic automated tests: disabled default, all four delays, reset timing, cross-account totals, duplicates, separate sound/alert preferences, Do Not Disturb suppression, RSS delegation, cancellation and handler restoration. Run `node tests/group-notifications.mjs`.
- Packaged 1.7.24 installed through Add-on Manager API. Native folder notification events tested with an intercepted sound player, including disable/re-enable and a full process restart with the enabled setting retained.
- Actual automatic startup POP synchronisation against a loopback-only server: two accounts downloaded two messages each. Exactly one summary requested, reading “You have 4 new emails.”, and one call to the configured native sound player.
- Subsequent ordinary POP retrieval delivered four more messages, again requesting exactly one four-message summary and one sound.
- The summary's `silent` attribute verified using Thunderbird's real alert object. During POP tests a disposable alert-service recorder captured summary text and call counts; the sound player was intercepted rather than playing audio.
- Real settings page in its normal remote extension process: enable/disable controls and changing the delay to 10 seconds persisted correctly.
- JavaScript syntax, JSON parsing, package version/ID and change scope checked. No stylesheet or existing appearance/functionality changes.

Not performed:

- Human listening assessment of the configured WAV/system sound, visual Windows toast rendering or physically toggling Windows Do Not Disturb. Preference/DND logic used test doubles; playback delegates to Thunderbird's existing player.
- Live mail-provider delivery, IMAP-specific startup synchronisation, other notification extensions, non-Windows systems or Thunderbird versions other than 160.0. The manifest remains restricted to 160.x.

## Installation and rollback

Download `ThunderCards-1.7.24.xpi`, then use Thunderbird → Add-ons and Themes → Extensions → gear menu → Install Add-on From File. This upgrades the existing add-on ID and retains theme/badge settings. Enable grouping explicitly in ThunderCards Settings; choose five seconds unless another quiet period is desired.

For notification-only rollback, turn grouping off. To remove the feature entirely, disable ThunderCards or install the previous compatible XPI. Native notification preferences need no restoration. Existing automatic-update preferences still apply when rolling back to an older release.
