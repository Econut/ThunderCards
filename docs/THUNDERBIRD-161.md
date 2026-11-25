# Thunderbird 161 compatibility — 1.7.25

Thunderbird 161.0 correctly disabled 1.7.24 because its manifest and update feed permitted only 160.x. Version 1.7.25 extends the packaged maximum to 161.x. The minimum remains 160.0 and the add-on ID is unchanged. There are no JavaScript, stylesheet, artwork or settings changes from 1.7.24.

Verified on Windows with Thunderbird 161.0 in the disposable synthetic profile on 25 November 2026:

- Installation, active state and full restart; grouped-notification preference retained.
- Header artwork, sidebar badges, sender lines and quick-delete button.
- Both Unified Inbox and individual folders; scrolling, sorting and 117px rendered rows.
- Thread expand/collapse, grouped lists and folder switching; thread children retain 117px rows and sender addresses.
- Quick delete at beginning, menu deletion in middle, deletion of an unselected card, standard deletion in a sorted individual folder, and Delete command in a filtered individual folder. Correct successor displayed and Undo restored the deleted message while retaining the successor selection.
- Notification debounce, duplicate suppression, normal arrivals, Do Not Disturb test double, cancellation and native-handler restoration on disable/re-enable.
- Settings-page enable/disable and delay persistence in the normal remote extension process.
- Add-on disable/re-enable restores and reapplies the header/sidebar/card customisation.

The 160.0 POP synchronisation evidence and OS audio/toast testing limitations in GROUPED-NOTIFICATIONS.md still apply. Actual POP startup synchronisation was not rerun under 161.0; the restart notification test used native events and real disposable folders. No live profile or installed application files were modified. Thunderbird 162 and later remain untested and excluded.
