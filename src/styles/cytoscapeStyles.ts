/**
 * Cytoscape stylesheet for analog-aesthetic signal path diagrams
 * Matches the vintage/analog vibe from Phase 3 knob components
 */

import type { StylesheetStyle } from 'cytoscape'

export const analogStyle: StylesheetStyle[] = [
  // Base node styling - analog aesthetic with warm colors
  {
    selector: 'node',
    style: {
      'shape': 'roundrectangle',
      'width': 'label',
      'height': 'label',
      'padding': '16px',
      'background-color': '#d4a574',
      'background-gradient-direction': 'to-bottom',
      'background-gradient-stop-colors': ['#d4a574', '#c9a66b'],
      'border-width': '3px',
      'border-color': '#8b7355',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-family': 'Menlo, Monaco, "Courier New", monospace',
      'font-size': '14px',
      'font-weight': 'bold',
      'color': '#3a2f28',
      'text-wrap': 'wrap',
      'text-max-width': '120px',
    },
  },

  // Type-specific node colors (SpinCAD convention from research)
  {
    selector: 'node[type="input"]',
    style: {
      'background-gradient-stop-colors': ['#fee391', '#fdd870'],
      'border-color': '#d4a66a',
    },
  },
  {
    selector: 'node[type="output"]',
    style: {
      'background-gradient-stop-colors': ['#fc8d59', '#fb7346'],
      'border-color': '#c75d37',
    },
  },
  {
    selector: 'node[type="delay"]',
    style: {
      'background-gradient-stop-colors': ['#6baed6', '#5a9cc7'],
      'border-color': '#4682a8',
    },
  },
  {
    selector: 'node[type="filter"]',
    style: {
      'background-gradient-stop-colors': ['#74c476', '#5fb361'],
      'border-color': '#488f49',
    },
  },
  {
    selector: 'node[type="modulation"]',
    style: {
      'background-gradient-stop-colors': ['#9e9ac8', '#8983b7'],
      'border-color': '#6e6999',
    },
  },
  {
    selector: 'node[type="reverb"]',
    style: {
      'background-gradient-stop-colors': ['#fd8d3c', '#ec7a2b'],
      'border-color': '#c85f1d',
    },
  },
  {
    selector: 'node[type="mixer"]',
    style: {
      'background-gradient-stop-colors': ['#969696', '#858585'],
      'border-color': '#6b6b6b',
    },
  },

  // Base edge styling - analog look with thick brown edges
  {
    selector: 'edge',
    style: {
      'width': '3px',
      'line-color': '#8b7355',
      'target-arrow-color': '#8b7355',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1.2,
    },
  },

  // Feedback edges - dashed red for visual distinction
  {
    selector: 'edge.feedback',
    style: {
      'line-color': '#d9534f',
      'target-arrow-color': '#d9534f',
      'line-style': 'dashed',
      'line-dash-pattern': [8, 4],
      'width': '2.5px',
    },
  },
]
