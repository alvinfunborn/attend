# Themes

Open **Settings → Theme** to choose **Follow system**, **Light**, **Dark**, or a saved custom theme. The selection and custom themes are saved for the current Attend directory scope. They survive reloads, restarts, and port changes; other scopes keep independent preferences.

**Copy theme** creates an editable copy of the current palette. **Edit JSON** edits a custom theme. Changes preview immediately; **Cancel** or Escape restores the saved selection. **Save & use** saves and selects the theme together. **Delete** removes the selected custom theme and returns to its built-in light or dark base. A failed save restores the previous selection and keeps an editor draft available to retry.

**Import JSON** opens a file as an unsaved preview. **Export JSON** downloads the selected custom definition, or a complete resolved palette for a built-in theme. The **Available colors** list in the editor is searchable; choosing an entry adds its current value to the JSON.

```json
{
  "name": "Midnight",
  "type": "dark",
  "colors": {
    "background": "#101827",
    "foreground": "#e5e7eb",
    "accent": "#a78bfa",
    "accent.background": "#282144",
    "focusBorder": "#a78bfa80",
    "chat.user.background": "#41336b",
    "chat.user.foreground": "#ffffff",
    "session.selectedBackground": "#23465e",
    "diff.added.background": "#143323"
  }
}
```

The format follows the `name` / `type` / `colors` pattern used by editor themes, with Attend-specific color IDs. VS Code theme files use different IDs and cannot be imported unchanged. JSON must be strict JSON, without comments or trailing commas.

`type` selects the light or dark base, including browser controls. Missing entries use that base palette. Common background and foreground overrides also flow to related panels, text and controls; a more specific override wins. Removing an override restores its inherited/default value. Built-in definitions remain unchanged.

Color values accept hexadecimal (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`), numeric `rgb()` / `rgba()` / `hsl()` / `hsla()` forms, and `transparent`. Arbitrary CSS expressions and unknown IDs are rejected. Theme names are 1–100 characters. Up to 64 custom themes can be saved, and imported files must be at most 256 KB.

Color families include:

| Family | Examples |
| --- | --- |
| Surfaces and text | `background`, `foreground`, `panel.background`, `sideBar.background`, `descriptionForeground`, `border` |
| Controls | `accent`, `button.background`, `input.background`, `input.foreground`, `input.placeholderForeground`, `menu.background`, `focusBorder` |
| Sessions | `session.background`, `session.hoverBackground`, `session.selectedBackground`, `session.pinned.*`, `sessionPanel.background` |
| Transcript | `chat.background`, `chat.user.*`, `chat.assistant.*`, `chat.controls.*`, `chat.pinned.*`, `code.*`, `chat.table.*` |
| Tools and diffs | `tool.*`, `diff.added.*`, `diff.removed.*`, `diff.context.foreground`, `diagram.*` |
| Status and priority | `status.*`, `state.continueReady.*`, `state.blocked.*`, `priority.1.*` through `priority.5.*` |
| Providers, projects and tags | `vendor.claude.*`, `vendor.codex.*`, `project.1.*` through `project.12.*`, `tag.*` |
| Other UI | `queue.*`, `todo.*`, `attachment.*`, `tooltip.*`, `notification.*`, `overlay.background`, `shadow.*`, `selection.*` |

Project colors retain their stable assignment to one of 12 slots. Tags retain their generated identity border colors; `tag.heat.low` and `tag.heat.high` customize the activity scale. Explicit per-session state colors continue to take precedence over the theme. The rainbow color-picker indicator represents available choices and retains its fixed spectrum.

For contributors, `src/core/theme-colors.ts` is the color registry. Add an ID there and reference its CSS variable in the UI. Defaults, validation, the editor's color list, exports and browser resolution all use that registry. `src/core/themes.ts` contains the shared theme engine; the browser runs the same factory as the server. The production shell includes only the selected theme's overrides before CSS loads; the complete registry travels in the cached application asset.
