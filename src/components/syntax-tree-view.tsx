'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  Box,
  Database,
  FunctionSquare,
  Zap,
  Tag,
  Timer,
  FileCode2,
  Paintbrush,
  Type,
  GitBranch,
  ListTree,
  Component,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type {
  UISemanticTree,
  SemanticNode,
  SemanticNodeId,
  RootComponentNode,
  ComponentNode,
  TextNode,
  ReactiveStateNode,
  ComputedPropNode,
  WatchEffectNode,
  EventHandlerNode,
  ConditionalRenderNode,
  ListRenderNode,
  StyleNode,
  PropDefinition,
  ComponentProp,
} from '@/lib/semantic-tree/types'
import { cn } from '@/lib/utils'

// ==================== Props ====================

interface SyntaxTreeViewProps {
  /** The semantic tree to visualize, or null to show placeholder */
  tree: UISemanticTree | null
  /** Additional className */
  className?: string
}

// ==================== Color Map ====================

/** Node type → color mapping */
const NODE_COLORS: Record<string, string> = {
  root: '#a78bfa',       // violet - root component
  component: '#22c55e',  // green - ComponentNode
  text: '#06b6d4',       // cyan - TextNode (TemplateNode equivalent)
  'reactive-state': '#61dafb', // blue - StateNode
  'computed-prop': '#8b5cf6',  // purple - ComputedPropNode
  'event-handler': '#f97316',  // orange - EventHandlerNode
  prop: '#ec4899',       // pink - PropNode
  'watch-effect': '#eab308',   // yellow - EffectNode
  style: '#f43f5e',      // rose - StyleNode
  'conditional-render': '#14b8a6', // teal - ConditionalRenderNode
  'list-render': '#8b5cf6',    // purple - ListRenderNode
}

/** Node type → Chinese label */
const NODE_LABELS: Record<string, string> = {
  root: '根组件',
  component: '组件',
  text: '文本',
  'reactive-state': '响应式状态',
  'computed-prop': '计算属性',
  'event-handler': '事件处理',
  prop: '属性',
  'watch-effect': '副作用',
  style: '样式',
  'conditional-render': '条件渲染',
  'list-render': '列表渲染',
}

/** Node type → icon component name (we use a function instead) */
function getNodeIcon(nodeType: string): React.ReactNode {
  const iconClass = 'h-3.5 w-3.5'
  switch (nodeType) {
    case 'root':
      return <Component className={iconClass} />
    case 'component':
      return <Box className={iconClass} />
    case 'text':
      return <Type className={iconClass} />
    case 'reactive-state':
      return <Database className={iconClass} />
    case 'computed-prop':
      return <FunctionSquare className={iconClass} />
    case 'event-handler':
      return <Zap className={iconClass} />
    case 'prop':
      return <Tag className={iconClass} />
    case 'watch-effect':
      return <Timer className={iconClass} />
    case 'style':
      return <Paintbrush className={iconClass} />
    case 'conditional-render':
      return <GitBranch className={iconClass} />
    case 'list-render':
      return <ListTree className={iconClass} />
    default:
      return <FileCode2 className={iconClass} />
  }
}

// ==================== Helper: Get children IDs from a node ====================

function getChildIds(node: SemanticNode): SemanticNodeId[] {
  const ids: SemanticNodeId[] = []

  switch (node.nodeType) {
    case 'root': {
      const root = node as RootComponentNode
      if (root.body) ids.push(root.body)
      break
    }
    case 'component': {
      const comp = node as ComponentNode
      if (comp.children?.length) ids.push(...comp.children)
      break
    }
    case 'conditional-render': {
      const cond = node as ConditionalRenderNode
      if (cond.trueBranch) ids.push(cond.trueBranch)
      if (cond.falseBranch) ids.push(cond.falseBranch)
      break
    }
    case 'list-render': {
      const list = node as ListRenderNode
      if (list.body) ids.push(list.body)
      break
    }
  }

  return ids
}

// ==================== Helper: Check if node has expandable content ====================

function hasExpandableContent(node: SemanticNode): boolean {
  const childIds = getChildIds(node)
  if (childIds.length > 0) return true

  // Some nodes have inline properties that are worth expanding
  switch (node.nodeType) {
    case 'root': {
      const root = node as RootComponentNode
      return (root.propsDefinition?.length ?? 0) > 0
    }
    case 'component': {
      const comp = node as ComponentNode
      return (comp.props?.length ?? 0) > 0 || !!comp.textContent
    }
    case 'watch-effect': {
      const effect = node as WatchEffectNode
      return !!effect.callbackBody || !!effect.cleanupBody
    }
    case 'style': {
      const style = node as StyleNode
      return !!style.content
    }
    default:
      return false
  }
}

// ==================== Node Summary Component ====================

/** Renders inline properties for a node */
function NodeSummary({ node }: { node: SemanticNode }) {
  switch (node.nodeType) {
    case 'root': {
      const root = node as RootComponentNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          {root.componentName}
          {root.sourceFramework && (
            <span className="ml-1.5 text-[var(--app-text-muted)]">
              ({root.sourceFramework === 'react' ? 'React' : 'Vue 3'})
            </span>
          )}
        </span>
      )
    }
    case 'component': {
      const comp = node as ComponentNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          {'<'}
          <span className={comp.isNativeElement ? 'text-[var(--app-text)]' : 'text-[#22c55e]'}>
            {comp.tagName}
          </span>
          {'>'}
          {comp.textContent && (
            <span className="ml-1.5 text-[var(--app-text-muted)] truncate max-w-[120px] inline-block align-bottom">
              &ldquo;{comp.textContent.slice(0, 30)}{comp.textContent.length > 30 ? '...' : ''}&rdquo;
            </span>
          )}
        </span>
      )
    }
    case 'text': {
      const text = node as TextNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono truncate max-w-[200px] inline-block align-bottom">
          &ldquo;{text.content.slice(0, 40)}{text.content.length > 40 ? '...' : ''}&rdquo;
          {text.interpolations && text.interpolations.length > 0 && (
            <span className="ml-1 text-[#06b6d4]">
              ({text.interpolations.length} 插值)
            </span>
          )}
        </span>
      )
    }
    case 'reactive-state': {
      const state = node as ReactiveStateNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          <span className="text-[#61dafb]">{state.name}</span>
          {state.setterName && (
            <span className="text-[var(--app-text-muted)]"> / {state.setterName}</span>
          )}
          <span className="text-[var(--app-text-muted)]"> = </span>
          <span className="text-[#eab308]">{state.initialValue}</span>
          {state.typeAnnotation && (
            <span className="text-[var(--app-text-muted)]">: {state.typeAnnotation}</span>
          )}
        </span>
      )
    }
    case 'computed-prop': {
      const computed = node as ComputedPropNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          <span className="text-[#8b5cf6]">{computed.name}</span>
          <span className="text-[var(--app-text-muted)]"> = </span>
          <span className="text-[#eab308]">{computed.expression.slice(0, 40)}{computed.expression.length > 40 ? '...' : ''}</span>
          {computed.dependencies.length > 0 && (
            <span className="text-[var(--app-text-muted)] ml-1">
              [deps: {computed.dependencies.join(', ')}]
            </span>
          )}
        </span>
      )
    }
    case 'event-handler': {
      const handler = node as EventHandlerNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          <span className="text-[#f97316]">{handler.eventName}</span>
          <span className="text-[var(--app-text-muted)]"> → </span>
          <span className="text-[var(--app-text)]">{handler.handlerName}</span>
          {handler.isInline && (
            <span className="text-[var(--app-text-muted)] ml-1">(inline)</span>
          )}
          {handler.modifiers && handler.modifiers.length > 0 && (
            <span className="text-[var(--app-text-muted)] ml-1">
              .{handler.modifiers.join('.')}
            </span>
          )}
        </span>
      )
    }
    case 'watch-effect': {
      const effect = node as WatchEffectNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          <span className="text-[#eab308]">
            {effect.effectKind === 'lifecycle' && effect.lifecycleKind
              ? effect.lifecycleKind
              : effect.effectKind}
          </span>
          {effect.sources.length > 0 && (
            <span className="text-[var(--app-text-muted)] ml-1">
              [{effect.sources.join(', ')}]
            </span>
          )}
          {effect.immediate && <span className="text-[#eab308] ml-1">immediate</span>}
          {effect.deep && <span className="text-[#eab308] ml-1">deep</span>}
        </span>
      )
    }
    case 'style': {
      const style = node as StyleNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          <span className="text-[#f43f5e]">{style.styleKind}</span>
          {style.selector && (
            <span className="text-[var(--app-text)] ml-1">{style.selector}</span>
          )}
          {style.preprocessor && style.preprocessor !== 'css' && (
            <span className="text-[var(--app-text-muted)] ml-1">({style.preprocessor})</span>
          )}
        </span>
      )
    }
    case 'conditional-render': {
      const cond = node as ConditionalRenderNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          <span className="text-[#14b8a6]">{cond.conditionalKind}</span>
          <span className="text-[var(--app-text-muted)]">: </span>
          <span className="text-[#eab308]">{cond.condition.slice(0, 35)}{cond.condition.length > 35 ? '...' : ''}</span>
        </span>
      )
    }
    case 'list-render': {
      const list = node as ListRenderNode
      return (
        <span className="text-[var(--app-text-secondary)] text-xs font-mono">
          <span className="text-[var(--app-text)]">{list.itemName}</span>
          <span className="text-[var(--app-text-muted)]"> in </span>
          <span className="text-[#eab308]">{list.iterableExpression.slice(0, 30)}{list.iterableExpression.length > 30 ? '...' : ''}</span>
          {list.indexName && (
            <span className="text-[var(--app-text-muted)] ml-1">({list.indexName})</span>
          )}
        </span>
      )
    }
    default:
      return null
  }
}

// ==================== Prop Definition Badge ====================

function PropDefBadge({ prop }: { prop: PropDefinition }) {
  return (
    <div className="flex items-center gap-1.5 py-1 px-2 rounded bg-[#1a1a2e] border border-[var(--app-border)]/50">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS.prop }} />
      <span className="text-xs text-[#ec4899] font-mono">{prop.name}</span>
      <span className="text-[10px] text-[var(--app-text-muted)]">: {prop.type}</span>
      {prop.required && (
        <span className="text-[10px] text-[#f97316]">*</span>
      )}
      {prop.defaultValue && (
        <span className="text-[10px] text-[var(--app-text-muted)]">= {prop.defaultValue}</span>
      )}
    </div>
  )
}

// ==================== Component Prop Badge ====================

function CompPropBadge({ prop }: { prop: ComponentProp }) {
  return (
    <div className="flex items-center gap-1.5 py-1 px-2 rounded bg-[#1a1a2e] border border-[var(--app-border)]/50">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: prop.isDynamic ? '#22c55e' : '#6b7280' }} />
      <span className="text-xs text-[var(--app-text)] font-mono">{prop.name}</span>
      {typeof prop.value === 'string' ? (
        <span className="text-[10px] text-[var(--app-text-muted)]">= &ldquo;{prop.value}&rdquo;</span>
      ) : (
        <span className="text-[10px] text-[#eab308] font-mono">= {prop.value.expression}</span>
      )}
      {prop.isDynamic && (
        <span className="text-[10px] text-[#22c55e]">dynamic</span>
      )}
    </div>
  )
}

// ==================== TreeNode (Recursive) ====================

interface TreeNodeProps {
  node: SemanticNode
  nodesMap: Record<SemanticNodeId, SemanticNode>
  depth: number
}

function TreeNode({ node, nodesMap, depth }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth < 2) // Auto-expand first 2 levels

  const color = NODE_COLORS[node.nodeType] ?? '#6b7280'
  const label = NODE_LABELS[node.nodeType] ?? node.nodeType
  const icon = getNodeIcon(node.nodeType)
  const childIds = getChildIds(node)
  const expandable = hasExpandableContent(node)

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  return (
    <div className="select-none">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Node header row */}
        <div
          className="flex items-center gap-1.5 py-1 group"
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          {/* Expand/collapse chevron */}
          {expandable ? (
            <CollapsibleTrigger asChild>
              <button
                className="shrink-0 p-0.5 rounded hover:bg-[var(--app-hover-bg)] transition-colors"
                onClick={toggleOpen}
              >
                <motion.div
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--app-text-muted)] group-hover:text-[var(--app-text)]" />
                </motion.div>
              </button>
            </CollapsibleTrigger>
          ) : (
            <span className="w-5 shrink-0 flex items-center justify-center">
              <span className="w-1 h-1 rounded-full bg-[var(--app-border)]" />
            </span>
          )}

          {/* Color dot + icon */}
          <span
            className="shrink-0 flex items-center justify-center w-5 h-5 rounded"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </span>

          {/* Node type badge */}
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-current/20"
            style={{ color, backgroundColor: `${color}10`, borderColor: `${color}25` }}
          >
            {label}
          </Badge>

          {/* Inline summary */}
          <div className="min-w-0 flex-1 truncate">
            <NodeSummary node={node} />
          </div>

          {/* Confidence indicator */}
          {node.confidence < 1 && (
            <span
              className={cn(
                'text-[10px] shrink-0 font-medium tabular-nums',
                node.confidenceLevel === 'high' && 'text-[#22c55e]',
                node.confidenceLevel === 'medium' && 'text-[#f97316]',
                node.confidenceLevel === 'low' && 'text-[#ef4444]',
              )}
            >
              {Math.round(node.confidence * 100)}%
            </span>
          )}
        </div>

        {/* Expandable content */}
        {expandable && (
          <CollapsibleContent>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  {/* Inline property sections for specific node types */}
                  {node.nodeType === 'root' && (
                    <RootNodeDetails node={node as RootComponentNode} nodesMap={nodesMap} depth={depth} />
                  )}
                  {node.nodeType === 'component' && (
                    <ComponentNodeDetails node={node as ComponentNode} nodesMap={nodesMap} depth={depth} />
                  )}
                  {node.nodeType === 'watch-effect' && (
                    <EffectNodeDetails node={node as WatchEffectNode} depth={depth} />
                  )}
                  {node.nodeType === 'style' && (
                    <StyleNodeDetails node={node as StyleNode} depth={depth} />
                  )}

                  {/* Recursive children */}
                  {childIds.map((childId) => {
                    const childNode = nodesMap[childId]
                    if (!childNode) return null
                    return (
                      <TreeNode
                        key={childId}
                        node={childNode}
                        nodesMap={nodesMap}
                        depth={depth + 1}
                      />
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  )
}

// ==================== Detail Sub-Components ====================

function RootNodeDetails({ node, nodesMap, depth }: { node: RootComponentNode; nodesMap: Record<SemanticNodeId, SemanticNode>; depth: number }) {
  if (!node.propsDefinition?.length) return null
  return (
    <div style={{ paddingLeft: `${(depth + 1) * 20}px` }} className="py-1">
      <div className="text-[10px] text-[var(--app-text-muted)] mb-1 flex items-center gap-1">
        <Tag className="h-3 w-3" />
        Props 定义
      </div>
      <div className="flex flex-wrap gap-1">
        {node.propsDefinition.map((prop, i) => (
          <PropDefBadge key={`${prop.name}-${i}`} prop={prop} />
        ))}
      </div>
    </div>
  )
}

function ComponentNodeDetails({ node, nodesMap, depth }: { node: ComponentNode; nodesMap: Record<SemanticNodeId, SemanticNode>; depth: number }) {
  if (!node.props?.length) return null
  return (
    <div style={{ paddingLeft: `${(depth + 1) * 20}px` }} className="py-1">
      <div className="text-[10px] text-[var(--app-text-muted)] mb-1 flex items-center gap-1">
        <Tag className="h-3 w-3" />
        属性
      </div>
      <div className="flex flex-wrap gap-1">
        {node.props.map((prop, i) => (
          <CompPropBadge key={`${prop.name}-${i}`} prop={prop} />
        ))}
      </div>
    </div>
  )
}

function EffectNodeDetails({ node, depth }: { node: WatchEffectNode; depth: number }) {
  return (
    <div style={{ paddingLeft: `${(depth + 1) * 20}px` }} className="py-1 space-y-1">
      {node.callbackBody && (
        <div className="p-2 rounded bg-[#1a1a2e] border border-[var(--app-border)]/50">
          <div className="text-[10px] text-[var(--app-text-muted)] mb-1">回调函数体</div>
          <code className="text-[11px] text-[var(--app-text)] font-mono whitespace-pre-wrap break-all">
            {node.callbackBody.slice(0, 200)}{node.callbackBody.length > 200 ? '...' : ''}
          </code>
        </div>
      )}
      {node.cleanupBody && (
        <div className="p-2 rounded bg-[#1a1a2e] border border-[var(--app-border)]/50">
          <div className="text-[10px] text-[var(--app-text-muted)] mb-1">清理函数</div>
          <code className="text-[11px] text-[var(--app-text)] font-mono whitespace-pre-wrap break-all">
            {node.cleanupBody.slice(0, 200)}{node.cleanupBody.length > 200 ? '...' : ''}
          </code>
        </div>
      )}
    </div>
  )
}

function StyleNodeDetails({ node, depth }: { node: StyleNode; depth: number }) {
  if (!node.content) return null
  return (
    <div style={{ paddingLeft: `${(depth + 1) * 20}px` }} className="py-1">
      <div className="p-2 rounded bg-[#1a1a2e] border border-[var(--app-border)]/50">
        <div className="text-[10px] text-[var(--app-text-muted)] mb-1">
          {node.preprocessor?.toUpperCase() ?? 'CSS'} 内容
        </div>
        <code className="text-[11px] text-[var(--app-text)] font-mono whitespace-pre-wrap break-all">
          {node.content.slice(0, 300)}{node.content.length > 300 ? '...' : ''}
        </code>
      </div>
    </div>
  )
}

// ==================== Mock Tree Data (保留供开发调试) ====================

// 注意：Mock 数据已不再用于生产环境。当 API 返回真实语义树数据时直接使用。
// 此函数仅在开发调试时使用，主组件已改为在无数据时展示提示信息。

// ==================== Main Component ====================

/**
 * Syntax Tree Visualization Component
 *
 * Shows the parsed semantic tree structure of the source code with:
 * - Expandable/collapsible nodes using Collapsible
 * - Color-coded node types
 * - Inline property display
 *
 * 当 tree 为 null 时（翻译尚未执行），显示占位提示信息。
 * 当 tree 存在时，使用翻译 API 返回的真实语义树数据。
 */
export function SyntaxTreeView({ tree, className }: SyntaxTreeViewProps) {
  // 如果没有语义树数据，展示提示信息
  if (!tree) {
    return (
      <div className={cn('p-6 bg-[var(--app-bg)] rounded-lg border border-[var(--app-border)]', className)}>
        <h3 className="text-sm font-semibold text-[var(--app-text)] mb-3 flex items-center gap-2">
          <span>🌳</span>
          <span>语法树</span>
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--app-hover-bg)] flex items-center justify-center mb-3">
            <FileCode2 className="h-6 w-6 text-[var(--app-text-muted)]" />
          </div>
          <p className="text-sm text-[var(--app-text-secondary)] mb-1">暂无语法树数据</p>
          <p className="text-xs text-[var(--app-text-muted)]">执行翻译后将在此展示解析的语义树结构</p>
        </div>
      </div>
    )
  }

  // 使用翻译 API 返回的真实语义树数据
  const displayTree = tree
  const rootNode = displayTree.nodes[displayTree.rootId]

  /** 统计各类型节点数量 */
  const nodeTypeCounts = Object.values(displayTree.nodes).reduce<Record<string, number>>(
    (acc, node) => {
      acc[node.nodeType] = (acc[node.nodeType] ?? 0) + 1
      return acc
    },
    {},
  )

  if (!rootNode) {
    return (
      <div className={cn('p-4 bg-[var(--app-bg)] rounded-lg border border-[var(--app-border)]', className)}>
        <h3 className="text-sm font-semibold text-[var(--app-text)] mb-2 flex items-center gap-2">
          <span>🌳</span>
          <span>语法树</span>
        </h3>
        <p className="text-xs text-[var(--app-text-muted)]">语义树数据为空</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-[var(--app-bg)] rounded-lg border border-[var(--app-border)]', className)}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-[var(--app-text)] flex items-center gap-2">
          <span>🌳</span>
          <span>语法树</span>
          <Badge variant="outline" className="text-[10px] bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border-hover)] ml-auto">
            {Object.keys(displayTree.nodes).length} 节点
          </Badge>
        </h3>

        {/* Node type legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {Object.entries(nodeTypeCounts).map(([type, count]) => {
            const color = NODE_COLORS[type] ?? '#6b7280'
            const label = NODE_LABELS[type] ?? type
            return (
              <div key={type} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-[var(--app-text-secondary)]">
                  {label}
                </span>
                <span className="text-[10px] text-[var(--app-text-muted)]">({count})</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tree visualization */}
      <ScrollArea className="max-h-96">
        <div className="px-4 pb-4">
          {/* Render root node */}
          <TreeNode
            node={rootNode}
            nodesMap={displayTree.nodes}
            depth={0}
          />

          {/* Additional root-level nodes that aren't in the tree traversal
              (e.g., state, computed, effects, events, styles) */}
          {Object.values(displayTree.nodes)
            .filter(
              (node) =>
                node.id !== displayTree.rootId &&
                !isDescendantOf(node.id, rootNode, displayTree.nodes),
            )
            .map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                nodesMap={displayTree.nodes}
                depth={0}
              />
            ))}
        </div>
      </ScrollArea>

      {/* Footer with source info */}
      <div className="px-4 py-2 border-t border-[var(--app-border)] text-[10px] text-[var(--app-text-muted)] flex items-center gap-1">
        <span>📋</span>
        <span>源框架: {displayTree.sourceFramework === 'react' ? 'React' : 'Vue 3'}</span>
        <span className="ml-2 text-[#22c55e]">(实时数据)</span>
      </div>
    </div>
  )
}

// ==================== Helper: Check if a node is a descendant of another ====================

function isDescendantOf(
  targetId: SemanticNodeId,
  ancestor: SemanticNode,
  nodesMap: Record<SemanticNodeId, SemanticNode>,
  visited: Set<SemanticNodeId> = new Set(),
): boolean {
  if (visited.has(ancestor.id)) return false
  visited.add(ancestor.id)

  const childIds = getChildIds(ancestor)
  for (const childId of childIds) {
    if (childId === targetId) return true
    const childNode = nodesMap[childId]
    if (childNode && isDescendantOf(targetId, childNode, nodesMap, visited)) {
      return true
    }
  }
  return false
}
