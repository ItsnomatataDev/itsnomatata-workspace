# Trello-Style Kanban Board System

## Overview

This documentation describes the Trello-style kanban board system refactoring, where the existing task management system has been transformed into a modern, Trello-like interface.

## Architecture

### Concept Mapping

```
Trello Terms        →  Database Tables    →  Terminology in UI
────────────────────────────────────────────────────────────
Board              →  clients            →  "Workspace" / "Project Board"
List/Column        →  task_board_columns →  "Status" or "Custom Column"
Card/Task          →  tasks              →  "Task" / "Work Item"
```

### Data Model

#### Board

Represents a top-level container (project/workspace). Mapped from the `clients` table.

```typescript
interface Board extends ClientItem {
  id: string;
  name: string; // Project/board name
  email?: string; // Contact email
  website?: string; // Related website
  industry?: string; // Industry classification
  logo_url?: string; // Board thumbnail
  notes?: string; // Board description
  taskCount?: number; // Computed: total cards
  timeTrackedSeconds?: number; // Computed: total time
  memberCount?: number; // Computed: team size
}
```

#### List

Represents a column/status container within a board.

```typescript
interface List extends TaskBoardColumn {
  id: string;
  name: string; // "To Do", "In Progress", "Done", etc.
  color?: string; // Visual indicator color
  position: number; // Sort order
  boardId?: string; // Parent board ID
  taskCount?: number; // Card count in this list
}
```

#### Card

Represents an individual task/work item with enhanced visibility.

```typescript
interface Card extends TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus; // "todo", "in_progress", "done", etc.
  priority: TaskPriority; // "low", "medium", "high", "urgent"
  created_by: string; // User ID of creator
  created_by_full_name?: string; // Creator's name (VISIBLE ON CARD)
  created_by_email?: string; // Creator's email
  assignees?: TaskAssigneeItem[]; // Assigned team members
  due_date?: string; // Task deadline
  tracked_seconds_cache?: number; // Time tracked (VISIBLE ON CARD)
  comments_count?: number; // Comment count
  checklistProgress?: {
    // Checklist completion
    completed: number;
    total: number;
  };
  labels?: CardLabel[]; // Task labels/tags
}
```

## Routes

### New Routes Added

```
GET /boards                    → BoardsGridPage (workspace grid view)
GET /boards/:boardId          → BoardViewPage (individual board kanban)
```

### Existing Routes (Maintained for Compatibility)

```
GET /clients                   → ClientsPage (legacy, still available)
GET /clients/:clientId         → ClientDetailsPage
GET /clients/:clientId/workspace → ClientWorkspacePage
```

## Components

### 1. BoardsGridPage (`src/features/boards/pages/BoardsGridPage.tsx`)

**Purpose**: Displays all boards in a Trello-like workspace view.

**Features**:

- Grid layout of colorful board tiles (responsive: 1-4 columns)
- Statistics dashboard (total boards, tasks, in-progress, time tracked)
- Search and filter capabilities
- Board creation button
- Hover effects showing quick actions

**Props**: None (uses auth context and hooks)

**Key Interactions**:

- Click board tile → Navigate to `/boards/:boardId`
- Search filters boards by name, industry, notes
- Stats auto-calculate from board data

---

### 2. BoardViewPage (`src/features/boards/pages/BoardViewPage.tsx`)

**Purpose**: Main board view with kanban layout, cards, and sidebar.

**Layout**:

```
┌─ Header (board title, quick actions) ─┐
├──────────────────────────────────────┤
│                                      │ Sidebar
│  Kanban Board                        │ (desktop)
│  (Lists & Cards)                     │
│                                      │ Mobile:
│                                      │ Hamburger
│                                      │ Toggle
└──────────────────────────────────────┘
```

**Features**:

- Horizontal scrollable kanban board
- Drag-and-drop cards between columns
- Timer controls on each card
- Click card to open detail modal
- Board sidebar (info, members, activity tabs)
- Responsive mobile toggle

**Props**: Uses URL param `boardId`

---

### 3. EnhancedTaskCard (`src/features/tasks/components/EnhancedTaskCard.tsx`)

**Purpose**: Trello-style card display with improved visibility.

**Card Layout**:

```
┌─────────────────────────────┐
│ Title                 [Priority]
│ Description preview
│ [Status] [Billable] [Live]   ← Badges
│ [Label 1] [Label 2] [+3]     ← Labels with color coding
│ ╔═ Checklist ═╗ 2/5          ← Progress bar
│ ⏱ 4h 30m   📅 Due today       ← Time & Due date
│ 👥 👥 👥 +1  💬 5  👁 2       ← Assignees, comments, viewers
│ [Avatar] [Track Button]      ← Creator + action
└─────────────────────────────┘
```

**Visible Information**:

- ✅ Title with line clamp
- ✅ Description preview
- ✅ Status badge
- ✅ Priority (color-coded)
- ✅ Labels with colors
- ✅ Checklist progress bar
- ✅ Time tracked (hours/minutes)
- ✅ Due date (with urgency indicators)
- ✅ Assignee avatars (overflow indicator)
- ✅ Comment count
- ✅ Viewer/invited count
- ✅ Creator avatar + name (always visible)
- ✅ Billable flag

**Interactions**:

- Click anywhere → Open CardDetailModal
- Click "Track" button → Start/stop timer
- Draggable → Reorder/move to different list

---

### 4. CardDetailModal (`src/features/tasks/components/CardDetailModal.tsx`)

**Purpose**: Full-featured card editing and collaboration interface.

**Modal Layout**:

```
┌─ Header: [Title Edit] [Close] ─┐
├──────────────────────────────────┤
│ Status [Dropdown]  Priority [DD] │
│ ╭─ Description ─────────────────╮ │
│ │ Rich text editor (editable)    │ │
│ ╰────────────────────────────────╯ │
│                                  │
│ Created by: [Avatar] Name        │
│ Date: Jan 15, 2024              │
│                                  │
│ Assigned To: [Member 1] [Member] │
│ Due Date: [Date Picker]          │
│                                  │
│ ⏱ Time Tracked: 4h 30m           │
│   [Start Timer] [Stop Timer]     │
│                                  │
│ ✅ Checklist (2/5)              │
│    ✓ Item 1                     │
│    ✓ Item 2                     │
│      Item 3 [×]                 │
│    [+ Add Item]                 │
│                                  │
│ 🏷 Labels: [Label1] [Label2] [+Add]
│                                  │
│ 📎 Attachments: [Upload Area]   │
│                                  │
│ 💬 Comments (3)                 │
│    [Comment 1 from User]        │
│    [Comment 2 from User]        │
│    [Text input for new comment] │
│    [Comment button]             │
└──────────────────────────────────┘
```

**Editable Fields**:

- ✏️ Title (inline editing)
- ✏️ Description (rich text)
- ✏️ Status (dropdown)
- ✏️ Priority (dropdown)
- ✏️ Due date (date picker)
- ✏️ Assignees (add/remove)
- ✏️ Labels (add/remove)
- ✏️ Checklist items (add/remove/toggle)
- ✏️ Comments (add new)

**Read-Only Display**:

- Creator info with timestamp
- Comment history
- Time tracked
- View count

---

### 5. BoardSidebar (`src/features/boards/components/BoardSidebar.tsx`)

**Purpose**: Right sidebar for board settings and activity.

**Three Tabs**:

#### Tab 1: Info

```
Board Name
Notes/Description

📊 Stats:
  - Total Cards: 24
  - Completed: 12 (50%)
  - Team Members: 3
  - Avg Time/Card: 4.5h

[Progress Bar]

📋 Details:
  - Industry: [value]
  - Email: [value]
  - Website: [link]
  - Created: [date]

🔗 Actions:
  [Share Board] [Archive] [Delete]
```

#### Tab 2: Members

```
Team Members (3)
[Avatar] Name         role:admin  [⋮]
[Avatar] Name         role:member [⋮]
[Avatar] Name         role:member [⋮]

[+ Invite Members]
```

#### Tab 3: Activity

```
Recent Activity:
  [Icon] User Action  "2 hours ago"
  [Icon] User Action  "4 hours ago"
  [Icon] User Action  "1 day ago"
  ...
```

**Responsive**:

- Desktop: Always visible (right panel)
- Mobile: Hamburger toggle in header

---

## Services

### Board Service (`src/features/boards/services/boardService.ts`)

High-level API for board operations:

```typescript
// Read operations
getBoards(organizationId); // Get all boards
getBoard(boardId); // Get single board
getLists(boardId); // Get columns
getCards(organizationId, boardId); // Get tasks
getBoardView(organizationId, boardId); // Get complete board + lists + cards
getBoardStats(organizationId, boardId); // Get board statistics
getBoardActivity(boardId, limit); // Get activity log

// Write operations
createCard(organizationId, boardId, input); // Create new task
updateCard(cardId, updates); // Update card
deleteCard(cardId); // Delete card
moveCard(cardId, targetStatus, position); // Move to different status

// Batch operations
bulkMoveCards(moves); // Move multiple cards

// Board management
createList(organizationId, projectId, input); // Create new column
deleteList(listId); // Delete column
assignBoardMembers(boardId, memberIds); // Add members
```

## Styling

### Color System

**Brand Colors**:

- **Primary**: Orange-500 (`#f97316`) - Actions, accents
- **Dark**: `#050505`, `#0f0f0f`, `#1a1a1a` - Backgrounds
- **Light**: White with opacity - Text, borders
- **Secondary**: Blue-400, Purple-400, Green-400 - Status indicators

**Priority Colors**:

```
Urgent → Red-500     (#ef4444)
High   → Amber-500   (#f59e0b)
Medium → Orange-500  (#f97316)
Low    → White/60    (subtle)
```

### Components

**Cards**:

```css
rounded-2xl                          /* Rounded corners */
border border-white/8                /* Subtle border */
bg-[#141414]/95 backdrop-blur-md     /* Dark glass effect */
shadow-md shadow-black/40             /* Subtle shadow */
hover:-translate-y-1 hover:shadow-xl  /* Hover effect */
```

**Buttons**:

```css
rounded-lg bg-orange-500 text-black   /* Primary action */
hover:bg-orange-400                    /* Hover state */
active:scale-95                        /* Press feedback */
```

**Inputs**:

```css
rounded-lg border border-white/10      /* Dark input */
bg-white/5 focus:border-orange-500/50  /* Focus state */
focus:bg-white/10                      /* Visual feedback */
```

## Interactions

### Drag and Drop

**Source**: Card
**Target**: Any list (column)
**Behavior**:

- Card moves to new status/position
- Visual feedback during drag
- Optimistic UI update
- Persists to database

### Time Tracking

**On Card**:

- Click "Track" button → Start timer (shows "Live" badge)
- Timer runs and accumulates time
- Time persists to `tracked_seconds_cache`

**In Modal**:

- Show current time tracked
- "Start Timer" / "Stop Timer" button
- Total accumulates across sessions

### Comments

**On Card**:

- Show comment count
- Click to open modal

**In Modal**:

- View all comments with author + timestamp
- Add new comment (text input)
- Activity chronologically ordered

### Notifications

**Trigger Events**:

- Card assigned to you
- Card due soon
- Comment on card you're watching
- Card moved/completed

## Performance

### Optimization Strategies

1. **Query Optimization**:
   - Parallel load (board + lists + cards)
   - Select only needed columns
   - Use proper indexes

2. **UI Rendering**:
   - Virtual scrolling for long card lists
   - Lazy load card modals
   - Memoize card components

3. **Data Management**:
   - Cache board stats with TTL
   - Batch update operations
   - Debounce drag-drop events

4. **Network**:
   - Optimistic updates (UI updates before DB)
   - Realtime subscriptions for live updates
   - Request deduplication

## Mobile Considerations

### Responsive Breakpoints

```
Mobile (< 768px):
  - 1-column board grid
  - Single-column card view
  - Hamburger sidebar toggle
  - Touch-friendly spacing

Tablet (768px - 1024px):
  - 2-column board grid
  - Sidebar partially visible
  - Adjusted spacing

Desktop (> 1024px):
  - 3-4 column board grid
  - Full sidebar visible
  - Optimized for mouse/keyboard
```

### Touch Interactions

- Tap card → Open detail modal
- Long press → Drag to reorder
- Swipe → Scroll horizontally
- Double-tap → Edit field

## Accessibility

### Keyboard Navigation

- `Tab` - Move focus through elements
- `Enter` / `Space` - Activate buttons
- `Escape` - Close modals
- `Ctrl+Enter` - Submit forms
- Arrow keys - Navigate cards (future enhancement)

### Screen Readers

- Card titles properly labeled
- Buttons have descriptive text
- Form inputs have labels
- Status changes announced
- Landmarks used for page structure

### Color Contrast

- Text on backgrounds: WCAG AA compliant (4.5:1+)
- Status badges: Distinct colors beyond hue
- Interactive elements: Clear focus indicators

## Testing

### Manual Testing Checklist

```
[ ] Navigation
    [ ] Access /boards
    [ ] See all boards in grid
    [ ] Click board → Opens kanban view
    [ ] Sidebar toggle on mobile

[ ] Board Operations
    [ ] Create new board
    [ ] Edit board name/details
    [ ] Archive board
    [ ] Delete board

[ ] Card Operations
    [ ] View card in modal
    [ ] Edit title
    [ ] Edit description
    [ ] Change status
    [ ] Change priority
    [ ] Set due date
    [ ] Add/remove assignees
    [ ] Add checklist items
    [ ] Toggle checklist items
    [ ] Start/stop timer
    [ ] Add comments

[ ] Drag and Drop
    [ ] Drag card to different list
    [ ] Drag within same list
    [ ] Visual feedback during drag
    [ ] Update persists

[ ] Responsive
    [ ] Desktop view (3-4 columns)
    [ ] Tablet view (2 columns)
    [ ] Mobile view (1 column)
    [ ] Sidebar toggle on mobile
    [ ] Touch interactions work

[ ] Accessibility
    [ ] Tab navigation works
    [ ] Screen reader announces content
    [ ] Keyboard-only navigation possible
    [ ] Color contrast adequate
    [ ] Focus indicators visible
```

### Automated Testing

```typescript
// Example test structure
describe("BoardViewPage", () => {
  it("displays board with lists and cards", () => {});
  it("allows dragging cards between lists", () => {});
  it("opens card detail modal on click", () => {});
  it("starts timer when track button clicked", () => {});
  it("saves card edits to database", () => {});
});
```

## Migration Guide

### For Users

**Before**: "Go to Clients → select client → manage tasks"
**After**: "Go to Boards → select board → manage kanban"

**Terminology Changes**:

- Client → Board
- Task column → List
- Task → Card

### For Developers

**API Endpoints** (unchanged, abstracted by boardService):

```
GET    /clients                     → Boards
GET    /clients/:id                 → Board
GET    /tasks?client_id=:id         → Cards
PATCH  /tasks/:id                   → Update card
```

**Component Updates**:

- Use `EnhancedTaskCard` instead of `TaskCard`
- Use `CardDetailModal` for card details
- Use `BoardSidebar` for board info
- Use `boardService` for API calls

## Future Enhancements

1. **Custom Lists**: Allow creating custom status columns
2. **Board Templates**: Save/reuse board configurations
3. **Automation**: Rules engine for auto-moving cards
4. **Integrations**: Sync with external tools
5. **Views**: Calendar, table, timeline views
6. **Workflows**: Multi-step approval processes
7. **Bulk Operations**: Batch edit/move/delete
8. **Custom Fields**: Add project-specific metadata
9. **Time Estimation**: Estimate vs. actual tracking
10. **Reports**: Generate board performance reports

## Troubleshooting

### Cards not appearing

- Check organization_id filter
- Verify client_id matches boardId
- Check task status (should be "todo", "in_progress", etc.)

### Sidebar not showing

- On desktop: Check z-index and overflow settings
- On mobile: Check hamburger toggle state

### Time tracking not working

- Check timer permissions
- Verify time_entries table access
- Check browser timer (may need refresh)

### Drag and drop not working

- Check @dnd-kit integration
- Verify event handlers attached
- Check browser console for errors

## Support

For issues or questions about the board system:

1. Check this documentation
2. Review component source code comments
3. Check git commit history for implementation details
4. Contact the development team
