---
created: 2026-01-25T19:31
title: Enable click-to-edit in CodeMirror editor
area: ui
files:
  - src/ui/CodeEditor.tsx
  - src/App.tsx
---

## Problem

The CodeMirror editor currently only accepts pasted content and doesn't allow users to click into the editor and start typing. This is confusing UX — users expect to be able to click anywhere in the editor and start editing like a normal text field.

Current behavior: User clicks in editor → nothing happens, cursor doesn't appear
Expected behavior: User clicks in editor → cursor appears at click position, can immediately type/edit

This makes iterative editing difficult — users must paste entire new programs instead of making small tweaks to existing code.

## Solution

Investigate CodeMirror 6 configuration in CodeEditor.tsx:
1. Check if editor is set to read-only mode (should be editable)
2. Verify EditorView extensions include editable state
3. Ensure click handlers aren't preventing default focus behavior
4. Test that onChange handler fires when user types (not just pastes)

Likely issue: Missing `editable: true` in EditorState configuration, or extensions preventing edit mode.
