/**
 * Signal path diagram component using Cytoscape.js
 * Renders block diagrams from metadata with Dagre auto-layout
 */

import { useRef, useEffect } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
// @ts-ignore - no type definitions available for cytoscape-dagre
import dagre from 'cytoscape-dagre'
import { analogStyle } from '../styles/cytoscapeStyles'

// Register Dagre layout plugin
cytoscape.use(dagre)

interface DagreLayoutOptions {
  name: 'dagre'
  rankDir?: 'LR' | 'TB' | 'RL' | 'BT'
  nodeSep?: number
  rankSep?: number
  acyclicer?: 'greedy' | undefined
}

interface SignalPathDiagramProps {
  elements: ElementDefinition[]
}

export default function SignalPathDiagram({ elements }: SignalPathDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  // Initialize Cytoscape instance on mount
  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: analogStyle,
      layout: {
        name: 'dagre',
        rankDir: 'LR', // Left-to-right layout
        nodeSep: 50,
        rankSep: 100,
        acyclicer: 'greedy',
      } as DagreLayoutOptions,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      autoungrabify: false,
      autounselectify: true,
    })

    // Auto-adjust container height after layout completes
    cy.on('layoutstop', () => {
      const boundingBox = cy.elements().boundingBox()
      const height = boundingBox.h + 40 // Add padding
      if (containerRef.current) {
        containerRef.current.style.height = `${Math.max(height, 200)}px`
      }
    })

    cyRef.current = cy

    // Cleanup on unmount
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy()
        cyRef.current = null
      }
    }
  }, []) // Empty dependency - only run on mount

  // Update graph when elements change
  useEffect(() => {
    if (!cyRef.current || !elements) return

    cyRef.current.json({ elements })
    
    // Re-run layout with same settings
    const layout = cyRef.current.layout({
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 50,
      rankSep: 100,
      acyclicer: 'greedy',
    } as DagreLayoutOptions)
    
    layout.run()
  }, [elements])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '400px',
        backgroundColor: '#f8f5f2',
        border: '2px solid #8b7355',
        borderRadius: '8px',
      }}
    />
  )
}
