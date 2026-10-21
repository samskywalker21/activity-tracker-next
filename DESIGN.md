# Design — direction B: seal-green sidebar

Chosen on 2026-10-20 from three mock-ups. A government office system: clean, calm, obviously
DOH. Brand green carries the frame (sidebar) and primary actions; gold marks "where you are"
and counts. Status colours stay off green so they never compete with the brand.

Tokens live in `app/globals.css` (`:root` and `.dark`). Use the Tailwind names below, never raw
hex in components.

## Colour

| Token (Tailwind)                     | Light      | Dark        | Use                                      |
| ------------------------------------ | ---------- | ----------- | ---------------------------------------- |
| `background`                         | `#F3F5F4`  | `#0E1311`   | Page behind cards                        |
| `card` / `popover`                   | `#FFFFFF`  | `#151B18`   | Cards, tables, menus                     |
| `foreground`                         | `#17201B`  | `#E6ECE8`   | Body text                                |
| `muted` / `muted-foreground`         | `#F7F9F8` / `#56625B` | `#1A211D` / `#9AA69F` | Table header row, secondary text |
| `border` / `input`                   | `#DDE3DF` / `#D3DAD5` | `#29322D` / `#323C36` | Hairlines, field borders |
| `primary` / `primary-foreground`     | `#00703C` / white | `#1A854B` / white | Primary buttons, focus ring; links (dark: `accent-foreground`) |
| `accent` / `accent-foreground`       | `#E6F2EB` / `#005E32` | green 14% / `#8FE0B1` | Hover, chips, tinted icon tiles |
| `destructive`                        | `#B42318`  | `#F27C6E`   | Destructive buttons, field errors        |
| `gold`                               | `#FCD116`  | `#E9C21A`   | Active-nav bar, count badges, today      |
| `sidebar`                            | `#00592F`  | `#0B2A1A`   | Sidebar background                       |
| `sidebar-foreground`                 | `#DCEFE3`  | `#CFE5D7`   | Sidebar text                             |
| `sidebar-accent`                     | white 12%  | white 8%    | Hovered / active sidebar item            |

Text on gold is always `#3D2F00` (`gold-foreground`).

## Status

A status is shown as a **neutral outlined pill with a coloured dot and the label**
(`<StatusBadge status=… />`). The label carries the meaning; the dot is a quick scan aid.
Approved is **blue**, never green.

| Status      | Label     | Dot light | Dot dark  |
| ----------- | --------- | --------- | --------- |
| `PENDING`   | Pending   | `#D98A06` | `#F5B83D` |
| `APPROVED`  | Approved  | `#2563EB` | `#6EA2FA` |
| `RETURNED`  | Returned  | `#7C3AED` | `#B490F7` |
| `REJECTED`  | Rejected  | `#DC2626` | `#F27C6E` |
| `CANCELLED` | Cancelled | `#98A2B3` | `#8C96A3` |

On the calendar, events are neutral chips with the dot; **pending events also get a dashed
outline** so approved and pending differ without relying on colour.

## Type, shape, spacing

- Font: **Source Sans 3** (`next/font`), body 14px (`text-sm`), tabular numbers in tables.
- Page title `text-2xl font-bold`; section title `text-lg font-bold`, placed above its card.
- Radius 6px (`--radius: 0.375rem`). Shadows only on popovers and menus.
- Page padding `p-4 md:p-7`; gap between page sections `gap-6`; card padding `p-4`–`p-5`.
- Touch targets ≥ 40px for buttons in the header and sidebar.

## Shell

- **Sidebar** (`components/app-sidebar.tsx`): both seals + "Activity Tracker / CHD Northern
  Mindanao" at the top; groups by role (main · Manage for managers/admins · Admin for admins).
  Active item: `sidebar-accent` background, white bold text, 4px gold bar on its left edge.
  Counts (review queue) are gold badges. Collapses to a sheet on phones.
- **Header** (`components/app-header.tsx`): white bar, sidebar trigger on phones, search
  (submits to `/activities?q=`), theme toggle, user menu (name, role · section, Profile,
  Sign out). The notification bell joins it in Phase 8.

## Patterns

- **Page header**: title, optional one-line description, actions on the right (primary action
  is a green button). `<PageHeader>`.
- **Tables**: in a card, header row on `muted` with semibold `muted-foreground` labels, rows
  separated by hairlines, the row's title is the link. Wide tables scroll inside their card.
  Pagination below the table, right-aligned, with "x–y of z". `<DataTable>`, `<Pagination>`.
- **Filter bar**: search field first, then selects, wrapping on small screens; all values live
  in the URL (nuqs). `<FilterBar>`.
- **Forms**: one card, split into sections with an uppercase section legend on a `muted` strip.
  Labels sit left of the field on wide screens and above it on phones. Optional fields say
  "Optional" under the label. Errors under the field in `destructive`. Primary submit on the
  right of the footer, Cancel as a text link beside it.
- **Warnings** (e.g. scheduling conflicts) are an amber callout placed next to the fields they
  refer to, never a blocking dialog.
- **Empty / loading / error**: `<Empty>` with an icon, one sentence and (when useful) the next
  action; skeletons that match the final layout; `error.tsx` with a retry button.

## Dark mode

Same structure; surfaces step up in lightness (`background` → `card` → `muted`), the sidebar
goes deep green, status dots lighten. Toggle in the header; default follows the system.
