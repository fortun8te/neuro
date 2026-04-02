import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { exportChartToPng } from '../../utils/exportUtils';
import './networks.css';

export interface NetworkNode {
  id: string;
  label: string;
  group?: string;
  value?: number;
  title?: string;
  color?: string;
}

export interface NetworkEdge {
  from: string;
  to: string;
  label?: string;
  value?: number; // Weight/strength
  title?: string;
  color?: string;
}

export interface NetworkDiagramProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  title?: string;
  height?: number;
  physics?: boolean;
  hierarchical?: boolean;
  onNodeClick?: (node: NetworkNode) => void;
  onEdgeClick?: (edge: NetworkEdge) => void;
  detectCommunities?: boolean;
}

interface Community {
  nodes: string[];
  color: string;
}

function detectCommunities(
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): Map<string, string> {
  // Simple greedy community detection algorithm
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adjacency = new Map<string, Set<string>>();
  const communities = new Map<string, string>();
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4'];

  // Build adjacency list
  nodes.forEach(n => adjacency.set(n.id, new Set()));
  edges.forEach(e => {
    adjacency.get(e.from)?.add(e.to);
    adjacency.get(e.to)?.add(e.from);
  });

  let communityIdx = 0;
  const assigned = new Set<string>();

  // Greedy assignment
  nodes.forEach(node => {
    if (assigned.has(node.id)) return;

    const community = new Set<string>();
    const queue = [node.id];
    const color = colors[communityIdx % colors.length];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || assigned.has(current)) continue;

      community.add(current);
      assigned.add(current);
      communities.set(current, color);

      const neighbors = adjacency.get(current) || new Set();
      neighbors.forEach(neighbor => {
        if (!assigned.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }

    communityIdx++;
  });

  return communities;
}

export const NetworkDiagram: React.FC<NetworkDiagramProps> = ({
  nodes,
  edges,
  title,
  height = 500,
  physics = true,
  hierarchical = false,
  onNodeClick,
  onEdgeClick,
  detectCommunities: enableCommunityDetection = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkEdge | null>(null);

  const isDark = () => document.documentElement.classList.contains('dark');

  // Detect communities and apply colors
  const nodesWithCommunities = React.useMemo(() => {
    if (!enableCommunityDetection) return nodes;

    const communityColors = detectCommunities(nodes, edges);
    return nodes.map(node => ({
      ...node,
      color: communityColors.get(node.id) || node.color,
    }));
  }, [nodes, edges, enableCommunityDetection]);

  // Initialize network
  useEffect(() => {
    if (!containerRef.current || !nodes.length) return;

    const data = {
      nodes: new DataSet(
        nodesWithCommunities.map(node => ({
          id: node.id,
          label: node.label,
          title: node.title || node.label,
          value: node.value || 10,
          group: node.group,
          color: {
            background: node.color || '#3b82f6',
            border: isDark() ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)',
            highlight: {
              background: '#fbbf24',
              border: isDark() ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)',
            },
          },
          font: {
            color: '#fff',
            size: 12,
            face: 'system-ui',
          },
        } as any))
      ),
      edges: new DataSet(
        edges.map(edge => ({
          from: edge.from,
          to: edge.to,
          label: edge.label || '',
          title: edge.title || '',
          value: edge.value || 1,
          color: {
            color: edge.color || (isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
            highlight: isDark() ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          },
          smooth: { type: 'continuous' },
        } as any))
      ),
    };

    const options = {
      physics: physics ? {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.005,
          springLength: 200,
          springConstant: 0.08,
        },
        maxVelocity: 50,
        timestep: 0.35,
        stabilization: {
          iterations: 150,
        },
      } : { enabled: false },
      layout: hierarchical
        ? {
            hierarchical: {
              direction: 'UD',
              sortMethod: 'directed',
              nodeSpacing: 150,
              levelSeparation: 200,
            },
          }
        : {},
      interaction: {
        hover: true,
        navigationButtons: true,
        keyboard: true,
        zoomView: true,
        dragView: true,
      },
      manipulation: {
        enabled: false,
      },
      nodes: {
        shape: 'dot',
        scaling: {
          label: {
            enabled: true,
            min: 8,
            max: 12,
          },
        },
        font: {
          multi: true,
          bold: {
            color: '#fff',
            size: 13,
            face: 'system-ui',
            mod: 'bold',
          },
        },
      },
      edges: {
        smooth: {
          type: 'continuous',
        },
        arrows: {
          to: { enabled: true, scaleFactor: 0.5 },
        },
        font: {
          size: 10,
          color: isDark() ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
        },
      },
    };

    networkRef.current = new Network(containerRef.current, data, options as any);

    // Handle events
    networkRef.current.on('click', ({ nodes: clickedNodes, edges: clickedEdges }) => {
      if (clickedNodes.length > 0) {
        const nodeId = clickedNodes[0];
        const node = nodesWithCommunities.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          onNodeClick?.(node);
        }
      }

      if (clickedEdges.length > 0) {
        const edgeId = clickedEdges[0];
        const edge = edges.find(
          e => `${e.from}-${e.to}` === edgeId || `${e.to}-${e.from}` === edgeId
        );
        if (edge) {
          setSelectedEdge(edge);
          onEdgeClick?.(edge);
        }
      }
    });

    networkRef.current.on('hoverNode', ({ node }) => {
      // Could add hover effects here
    });

    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, [nodes, edges, physics, hierarchical, isDark, enableCommunityDetection, onNodeClick, onEdgeClick, nodesWithCommunities]);

  const handleExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      // Capture the canvas from the network's rendering
      const canvas = (networkRef.current as any)?.canvas?.canvases?.reference;
      if (canvas) {
        canvas.toBlob((blob: Blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${title || 'network'}.png`;
          link.click();
          URL.revokeObjectURL(url);
        });
      } else {
        // Fallback: use html2canvas
        const html2canvas = (await import('html2canvas')).default;
        const c = await html2canvas(containerRef.current);
        c.toBlob((blob: Blob | null) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${title || 'network'}.png`;
            link.click();
            URL.revokeObjectURL(url);
          }
        });
      }
    } catch (error) {
      console.error('Error exporting network:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleZoomFit = () => {
    networkRef.current?.fit({
      animation: { duration: 500, easingFunction: 'easeInOutQuad' },
    });
  };

  return (
    <div style={{ width: '100%' }}>
      {title && (
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 12,
          color: isDark() ? '#fff' : '#000',
        }}>
          {title}
        </div>
      )}

      <div style={{
        background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
        borderRadius: 8,
        overflow: 'hidden',
        border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        position: 'relative',
      }}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height,
          }}
        />

        {/* Controls */}
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          gap: 8,
          zIndex: 100,
        }}>
          <button
            onClick={handleZoomFit}
            style={{
              padding: '6px 12px',
              background: isDark() ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: isDark() ? '#fff' : '#000',
            }}
          >
            Fit View
          </button>
        </div>
      </div>

      {/* Info panel */}
      {selectedNode && (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
          borderRadius: 6,
          border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          fontSize: 12,
          color: isDark() ? '#fff' : '#000',
        }}>
          <strong>Node:</strong> {selectedNode.label}
          {selectedNode.title && <div style={{ marginTop: 4 }}>{selectedNode.title}</div>}
        </div>
      )}

      {selectedEdge && (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
          borderRadius: 6,
          border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          fontSize: 12,
          color: isDark() ? '#fff' : '#000',
        }}>
          <strong>Connection:</strong> {selectedEdge.from} → {selectedEdge.to}
          {selectedEdge.label && <div style={{ marginTop: 4 }}>{selectedEdge.label}</div>}
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={isExporting}
        style={{
          marginTop: 12,
          padding: '8px 16px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: isExporting ? 'not-allowed' : 'pointer',
          fontSize: 12,
          fontWeight: 600,
          opacity: isExporting ? 0.6 : 1,
        }}
      >
        {isExporting ? 'Exporting...' : 'Export as PNG'}
      </button>
    </div>
  );
};
