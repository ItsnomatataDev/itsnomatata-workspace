# Timesheet PGRST200 Fixed - COMPLETE

Fixed by removing direct 'clients' join (no FK relationship). Now uses:
`*, tasks!task_id(title), projects(name)`

Data available:

- entry.tasks?.title for task_title
- entry.projects?.name for project_name
- UI fallback logic handles missing client_name

No schema changes needed. All views (today/week/month/all) should load without errors. Refresh page.
