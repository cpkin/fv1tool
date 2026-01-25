/**
 * Graph builder utilities for Cytoscape signal path diagrams
 * Converts FxMetadata to Cytoscape element definitions
 */

import type { ElementDefinition } from 'cytoscape'
import type { FxMetadata } from './metadataParser'

/**
 * Infer node type from label keywords
 * Used for type-specific coloring in diagram
 */
function inferNodeType(label: string): string {
  const lower = label.toLowerCase()
  
  if (lower.includes('delay')) return 'delay'
  if (lower.includes('filter') || lower.includes('lpf') || lower.includes('hpf') || lower.includes('bpf')) return 'filter'
  if (lower.includes('reverb') || lower.includes('verb')) return 'reverb'
  if (lower.includes('lfo') || lower.includes('modulation') || lower.includes('chorus') || lower.includes('flanger')) return 'modulation'
  if (lower.includes('mix')) return 'mixer'
  if (lower.includes('input') || lower.includes('in')) return 'input'
  if (lower.includes('output') || lower.includes('out')) return 'output'
  
  // Default type
  return 'mixer'
}

/**
 * Detect feedback cycles using simple heuristic
 * Builds a topological rank map and marks edges going "backward" as feedback
 */
function detectFeedbackEdges(
  nodes: string[],
  edges: Array<{ from: string; to: string }>
): Set<string> {
  const feedbackEdges = new Set<string>()
  
  // Build a simple rank map (BFS from input nodes)
  const ranks = new Map<string, number>()
  const inputNodes = nodes.filter(n => inferNodeType(n) === 'input')
  
  if (inputNodes.length === 0) {
    // No explicit input - start from nodes with no incoming edges
    const hasIncoming = new Set(edges.map(e => e.to))
    const startNodes = nodes.filter(n => !hasIncoming.has(n))
    startNodes.forEach(n => ranks.set(n, 0))
  } else {
    inputNodes.forEach(n => ranks.set(n, 0))
  }
  
  // BFS to assign ranks
  let changed = true
  let iterations = 0
  const maxIterations = nodes.length * 2
  
  while (changed && iterations < maxIterations) {
    changed = false
    iterations++
    
    for (const edge of edges) {
      const fromRank = ranks.get(edge.from)
      const toRank = ranks.get(edge.to)
      
      if (fromRank !== undefined) {
        const newRank = fromRank + 1
        if (toRank === undefined || toRank < newRank) {
          ranks.set(edge.to, newRank)
          changed = true
        }
      }
    }
  }
  
  // Mark edges where target has lower or equal rank as feedback
  for (const edge of edges) {
    const fromRank = ranks.get(edge.from) ?? 0
    const toRank = ranks.get(edge.to) ?? 0
    
    if (toRank <= fromRank) {
      const edgeId = `${edge.from}-${edge.to}`
      feedbackEdges.add(edgeId)
    }
  }
  
  return feedbackEdges
}

/**
 * Convert metadata to Cytoscape element definitions
 * Returns empty array if metadata.graph is missing or invalid
 */
export function buildCytoscapeElements(metadata: FxMetadata): ElementDefinition[] {
  // Graceful degradation - return empty if no graph
  if (!metadata.graph || !metadata.graph.nodes || !metadata.graph.edges) {
    return []
  }
  
  const { nodes, edges } = metadata.graph
  const elements: ElementDefinition[] = []
  
  // Detect feedback edges
  const feedbackEdges = detectFeedbackEdges(nodes, edges)
  
  // Convert nodes
  for (const nodeId of nodes) {
    const nodeType = inferNodeType(nodeId)
    
    elements.push({
      data: {
        id: nodeId,
        label: nodeId,
        type: nodeType,
      },
    })
  }
  
  // Convert edges
  for (const edge of edges) {
    const edgeId = `${edge.from}-${edge.to}`
    const isFeedback = feedbackEdges.has(edgeId)
    
    elements.push({
      data: {
        id: edgeId,
        source: edge.from,
        target: edge.to,
      },
      classes: isFeedback ? 'feedback' : undefined,
    })
  }
  
  return elements
}
