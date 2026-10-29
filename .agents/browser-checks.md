# Browser checks

Notes for any walk through a web page with Chrome DevTools. They keep large output out of your context.

- Save a snapshot with `filePath`, then search the file with `rg`. Do not read a whole snapshot.
- Use the snapshot that `wait_for` returns. Do not call `take_snapshot` right after it.
- Filter network listings with `resourceTypes` and `pageSize`.
