'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2,
  GitBranch,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileSearch,
  Cpu,
  Eye,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** 节点类型 */
type NodeType = 'start' | 'process' | 'decision' | 'error' | 'output' | 'end'

/** 工作流节点数据 */
interface WorkflowNode {
  id: string
  type: NodeType
  title: string
  description: string
  detail?: string
  icon?: typeof Code2
  color: string
}

/** 连接线数据 */
interface WorkflowEdge {
  from: string
  to: string
  label?: string
  labelColor?: string
  type?: 'yes' | 'no' | 'default'
}

/** 节点类型样式映射 */
const NODE_STYLES: Record<NodeType, { border: string; bg: string; text: string; glow: string }> = {
  start: {
    border: 'border-[#22c55e]/50',
    bg: 'bg-[#22c55e]/10',
    text: 'text-[#22c55e]',
    glow: 'rgba(34,197,94,0.15)',
  },
  process: {
    border: 'border-[#3b82f6]/40',
    bg: 'bg-[#3b82f6]/8',
    text: 'text-[#3b82f6]',
    glow: 'rgba(59,130,246,0.1)',
  },
  decision: {
    border: 'border-[#f59e0b]/50',
    bg: 'bg-[#f59e0b]/8',
    text: 'text-[#f59e0b]',
    glow: 'rgba(245,158,11,0.12)',
  },
  error: {
    border: 'border-[#ef4444]/40',
    bg: 'bg-[#ef4444]/8',
    text: 'text-[#ef4444]',
    glow: 'rgba(239,68,68,0.1)',
  },
  output: {
    border: 'border-[#8b5cf6]/40',
    bg: 'bg-[#8b5cf6]/8',
    text: 'text-[#8b5cf6]',
    glow: 'rgba(139,92,246,0.1)',
  },
  end: {
    border: 'border-[var(--app-border)]',
    bg: 'bg-[var(--app-hover-bg)]',
    text: 'text-[var(--app-text-secondary)]',
    glow: 'transparent',
  },
}

/** 工作流节点列表 */
const WORKFLOW_NODES: WorkflowNode[] = [
  {
    id: 'input',
    type: 'start',
    title: '输入源代码',
    description: '粘贴或编写组件代码，选择源框架和目标框架',
    detail: '支持 React (JSX/TSX)、Vue 3 (SFC)、Angular (TypeScript) 三种框架作为输入源',
    icon: Code2,
    color: '#22c55e',
  },
  {
    id: 'check-empty',
    type: 'decision',
    title: '代码是否为空？',
    description: '验证输入的源代码是否为空字符串',
    detail: '空代码直接返回空结果，避免无效计算',
    color: '#f59e0b',
  },
  {
    id: 'empty-error',
    type: 'error',
    title: '返回空结果',
    description: '置信度 0%，标记为需人工审查',
    icon: XCircle,
    color: '#ef4444',
  },
  {
    id: 'check-same',
    type: 'decision',
    title: '源框架 = 目标框架？',
    description: '判断源框架和目标框架是否相同',
    detail: '相同框架无需翻译，直接返回原始代码，置信度 100%',
    color: '#f59e0b',
  },
  {
    id: 'same-output',
    type: 'output',
    title: '返回原始代码',
    description: '置信度 100%，无需转换',
    icon: CheckCircle2,
    color: '#8b5cf6',
  },
  {
    id: 'parse',
    type: 'process',
    title: '解析源代码 (AST)',
    description: '根据源框架选择对应解析器，将代码解析为语法树',
    detail: 'React 使用 @babel/parser (JSX/TSX)、Vue 3 使用 vue-eslint-parser、Angular 使用正则+babel 混合解析',
    icon: FileSearch,
    color: '#3b82f6',
  },
  {
    id: 'check-parse',
    type: 'decision',
    title: '解析是否成功？',
    description: '检查 AST 解析是否产生了有效的语义节点',
    detail: '解析可能因语法错误、不支持的语法特性等原因失败',
    color: '#f59e0b',
  },
  {
    id: 'parse-error',
    type: 'error',
    title: '解析失败',
    description: '返回错误信息 + 原始代码，置信度 0%',
    icon: XCircle,
    color: '#ef4444',
  },
  {
    id: 'semantic-tree',
    type: 'process',
    title: '构建语义树',
    description: '构建框架无关的四层 UI 语义树，建立结构映射',
    detail: '四层架构：Root → Page/Screen → Component → Element，包含状态管理、事件处理、样式映射',
    icon: GitBranch,
    color: '#3b82f6',
  },
  {
    id: 'validate-tree',
    type: 'process',
    title: '校验语义树',
    description: '验证语义树结构的完整性和一致性',
    detail: '检查根节点存在性、父子关系完整性、循环引用检测、必要属性完备性',
    icon: ShieldCheck,
    color: '#3b82f6',
  },
  {
    id: 'check-root',
    type: 'decision',
    title: '根节点是否有效？',
    description: '确认语义树根节点存在且结构完整',
    detail: '根节点缺失意味着源代码无法被正确解析为组件结构',
    color: '#f59e0b',
  },
  {
    id: 'root-error',
    type: 'error',
    title: '根节点缺失',
    description: '返回解析失败 + 原始代码，置信度 0%',
    icon: XCircle,
    color: '#ef4444',
  },
  {
    id: 'generate',
    type: 'process',
    title: '生成目标代码',
    description: '基于语义树生成目标框架的代码、样式和导入',
    detail: 'React: 生成 JSX + hooks + CSS Modules | Vue 3: 生成 SFC (template + script setup + style) | Angular: 生成 Component + Template + Style',
    icon: Cpu,
    color: '#3b82f6',
  },
  {
    id: 'check-ai',
    type: 'decision',
    title: 'AI 辅助是否启用？',
    description: '用户设置中是否开启了 AI 辅助翻译',
    detail: 'AI 辅助使用 GLM-4 模型，通过 z-ai-web-dev-sdk 调用，优化低置信度翻译点',
    color: '#f59e0b',
  },
  {
    id: 'ai-optimize',
    type: 'process',
    title: 'AI 辅助优化',
    description: 'AI 分析低置信度翻译点，提供优化建议并更新置信度',
    detail: '筛选置信度 < 70% 的警告，AI 逐个分析并提供修复建议，置信度可提升至 90%',
    icon: Sparkles,
    color: '#22c55e',
  },
  {
    id: 'confidence',
    type: 'process',
    title: '置信度评估',
    description: '计算整体翻译置信度，分类标记各翻译点质量',
    detail: '高(≥80%): 可直接使用 | 中(50-80%): 建议审查 | 低(<50%): 需人工干预',
    icon: ShieldCheck,
    color: '#3b82f6',
  },
  {
    id: 'check-confidence',
    type: 'decision',
    title: '置信度等级？',
    description: '根据整体置信度判断翻译质量等级',
    detail: '根据置信度分数自动分级，不同级别采取不同后续处理策略',
    color: '#f59e0b',
  },
  {
    id: 'high-result',
    type: 'output',
    title: '高置信度',
    description: '≥80%，翻译可直接使用',
    detail: '代码结构完整，模式映射精确，可直接用于生产环境',
    icon: CheckCircle2,
    color: '#22c55e',
  },
  {
    id: 'medium-result',
    type: 'output',
    title: '中置信度',
    description: '50-80%，建议人工审查',
    detail: '部分模式映射不够精确，建议审查 AI 提供的优化建议后再使用',
    icon: Eye,
    color: '#f59e0b',
  },
  {
    id: 'low-result',
    type: 'output',
    title: '低置信度',
    description: '<50%，需要人工干预',
    detail: '翻译可能存在较大偏差，必须逐行审查并手动修正',
    icon: AlertTriangle,
    color: '#ef4444',
  },
  {
    id: 'output',
    type: 'start',
    title: '输出翻译结果',
    description: '生成目标代码 + 置信度报告 + 翻译警告 + AI 建议',
    detail: '包含：目标框架代码、CSS 样式、import 语句、置信度报告、警告列表、AI 优化建议、语义树数据',
    icon: Zap,
    color: '#22c55e',
  },
]

/** 连接线列表 - 定义流程走向 */
const WORKFLOW_EDGES: WorkflowEdge[] = [
  { from: 'input', to: 'check-empty', type: 'default' },
  { from: 'check-empty', to: 'empty-error', label: '是', labelColor: '#ef4444', type: 'yes' },
  { from: 'check-empty', to: 'check-same', label: '否', labelColor: '#22c55e', type: 'no' },
  { from: 'check-same', to: 'same-output', label: '是', labelColor: '#8b5cf6', type: 'yes' },
  { from: 'check-same', to: 'parse', label: '否', labelColor: '#22c55e', type: 'no' },
  { from: 'parse', to: 'check-parse', type: 'default' },
  { from: 'check-parse', to: 'parse-error', label: '失败', labelColor: '#ef4444', type: 'yes' },
  { from: 'check-parse', to: 'semantic-tree', label: '成功', labelColor: '#22c55e', type: 'no' },
  { from: 'semantic-tree', to: 'validate-tree', type: 'default' },
  { from: 'validate-tree', to: 'check-root', type: 'default' },
  { from: 'check-root', to: 'root-error', label: '无效', labelColor: '#ef4444', type: 'yes' },
  { from: 'check-root', to: 'generate', label: '有效', labelColor: '#22c55e', type: 'no' },
  { from: 'generate', to: 'check-ai', type: 'default' },
  { from: 'check-ai', to: 'ai-optimize', label: '已启用', labelColor: '#22c55e', type: 'yes' },
  { from: 'check-ai', to: 'confidence', label: '未启用', labelColor: 'var(--app-text-muted)', type: 'no' },
  { from: 'ai-optimize', to: 'confidence', type: 'default' },
  { from: 'confidence', to: 'check-confidence', type: 'default' },
  { from: 'check-confidence', to: 'high-result', label: '高 ≥80%', labelColor: '#22c55e', type: 'yes' },
  { from: 'check-confidence', to: 'medium-result', label: '中 50-80%', labelColor: '#f59e0b', type: 'no' },
  { from: 'check-confidence', to: 'low-result', label: '低 <50%', labelColor: '#ef4444', type: 'default' },
  { from: 'high-result', to: 'output', type: 'default' },
  { from: 'medium-result', to: 'output', type: 'default' },
  { from: 'low-result', to: 'output', type: 'default' },
]

/** 节点位置布局 - 使用网格坐标 */
const NODE_POSITIONS: Record<string, { row: number; col: number }> = {
  'input':          { row: 0, col: 0 },
  'check-empty':    { row: 1, col: 0 },
  'empty-error':    { row: 1, col: 2 },
  'check-same':     { row: 2, col: 0 },
  'same-output':    { row: 2, col: 2 },
  'parse':          { row: 3, col: 0 },
  'check-parse':    { row: 4, col: 0 },
  'parse-error':    { row: 4, col: 2 },
  'semantic-tree':  { row: 5, col: 0 },
  'validate-tree':  { row: 6, col: 0 },
  'check-root':     { row: 7, col: 0 },
  'root-error':     { row: 7, col: 2 },
  'generate':       { row: 8, col: 0 },
  'check-ai':       { row: 9, col: 0 },
  'ai-optimize':    { row: 9, col: 2 },
  'confidence':     { row: 10, col: 0 },
  'check-confidence': { row: 11, col: 0 },
  'high-result':    { row: 12, col: -1 },
  'medium-result':  { row: 12, col: 0 },
  'low-result':     { row: 12, col: 1 },
  'output':         { row: 13, col: 0 },
}

/** 单个流程节点组件 */
function FlowNode({
  node,
  isHovered,
  onHover,
  onLeave,
  animateDelay,
}: {
  node: WorkflowNode
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
  animateDelay: number
}) {
  const styles = NODE_STYLES[node.type]
  const IconComponent = node.icon

  const isDecision = node.type === 'decision'

  return (
    <motion.div
      className={cn(
        'relative group cursor-default',
        isDecision ? 'z-20' : 'z-10',
      )}
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: animateDelay, ease: 'easeOut' }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* 发光效果 */}
      <motion.div
        className="absolute -inset-1 rounded-xl blur-md pointer-events-none"
        animate={isHovered ? { opacity: 0.6 } : { opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ background: styles.glow }}
      />

      <div
        className={cn(
          'relative rounded-xl border-2 px-3 py-2.5 transition-all duration-200',
          styles.border,
          styles.bg,
          isDecision && 'rotate-0', // 决策节点用样式区分
          isHovered && 'scale-[1.02] shadow-lg',
        )}
      >
        {/* 决策节点菱形标记 */}
        {isDecision && (
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rotate-45 bg-[#f59e0b] rounded-[1px]" />
        )}

        <div className="flex items-start gap-2">
          {/* 图标 */}
          {IconComponent && (
            <div className={cn(
              'shrink-0 mt-0.5 p-1 rounded-md',
              node.type === 'error' ? 'bg-[#ef4444]/15' :
              node.type === 'start' ? 'bg-[#22c55e]/15' :
              node.type === 'output' ? 'bg-[#8b5cf6]/15' :
              node.type === 'decision' ? 'bg-[#f59e0b]/15' :
              'bg-[#3b82f6]/15',
            )}>
              <IconComponent className={cn('h-3.5 w-3.5', styles.text)} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* 标题行 */}
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'text-xs font-semibold leading-tight',
                node.type === 'decision' ? 'text-[#f59e0b]' : styles.text,
              )}>
                {node.title}
              </span>
              {node.type === 'decision' && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] font-bold shrink-0">
                  判断
                </span>
              )}
              {node.type === 'error' && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] font-bold shrink-0">
                  异常
                </span>
              )}
            </div>
            {/* 描述 */}
            <p className="text-[10px] text-[var(--app-text-muted)] mt-0.5 leading-relaxed">
              {node.description}
            </p>
          </div>
        </div>

        {/* 悬停展开的详细信息 */}
        <AnimatePresence>
          {isHovered && node.detail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-[var(--app-border)]">
                <p className="text-[10px] text-[var(--app-text-secondary)] leading-relaxed">
                  {node.detail}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/** 连接线组件 - SVG 箭头 */
function FlowEdge({
  from,
  to,
  label,
  labelColor,
  type,
  allPositions,
}: {
  from: string
  to: string
  label?: string
  labelColor?: string
  type?: 'yes' | 'no' | 'default'
  allPositions: Record<string, { row: number; col: number }>
}) {
  const fromPos = allPositions[from]
  const toPos = allPositions[to]
  if (!fromPos || !toPos) return null

  // 计算线的颜色
  const lineColor = type === 'yes' ? '#ef4444' : type === 'no' ? '#22c55e' : 'var(--app-border)'

  // 判断是否为水平分支（col不同）
  const isHorizontal = fromPos.col !== toPos.col
  const isVertical = fromPos.row !== toPos.row && fromPos.col === toPos.col

  if (isHorizontal) {
    // 水平分支线（决策 → 侧边节点）
    return (
      <motion.div
        className="absolute pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {/* 水平连接线将由 CSS 绘制 */}
      </motion.div>
    )
  }

  // 垂直连接线
  return (
    <motion.div
      className="absolute pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* 垂直线和箭头由布局自动处理 */}
    </motion.div>
  )
}

/** 图例项组件 */
function LegendItem({ color, label, shape }: { color: string; label: string; shape: 'rect' | 'diamond' | 'round' }) {
  return (
    <div className="flex items-center gap-2">
      {shape === 'diamond' ? (
        <div className="w-3 h-3 rotate-45 border-2 rounded-[1px]" style={{ borderColor: color, backgroundColor: `${color}20` }} />
      ) : shape === 'round' ? (
        <div className="w-4 h-2.5 rounded-full border-2" style={{ borderColor: color, backgroundColor: `${color}20` }} />
      ) : (
        <div className="w-4 h-2.5 rounded-sm border-2" style={{ borderColor: color, backgroundColor: `${color}20` }} />
      )}
      <span className="text-[10px] text-[var(--app-text-secondary)]">{label}</span>
    </div>
  )
}

/** 翻译工作流完整流程图组件 */
export function TranslationWorkflowDiagram({ className }: { className?: string }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<number | null>(null)

  /** 构建行布局数据 */
  const rows: { row: number; mainNode: WorkflowNode; sideNodes: WorkflowNode[]; sideEdgeLabels: { label: string; color: string }[] }[] = []

  // 按 row 分组
  const rowMap = new Map<number, WorkflowNode[]>()
  for (const node of WORKFLOW_NODES) {
    const pos = NODE_POSITIONS[node.id]
    if (!pos) continue
    if (!rowMap.has(pos.row)) rowMap.set(pos.row, [])
    rowMap.get(pos.row)!.push(node)
  }

  for (const [rowNum, nodes] of rowMap) {
    const mainNode = nodes.find(n => NODE_POSITIONS[n.id]?.col === 0) || nodes[0]
    const sideNodes = nodes.filter(n => n !== mainNode)
    const sideEdgeLabels: { label: string; color: string }[] = []

    // 找到从主节点到侧节点的边标签
    for (const sideNode of sideNodes) {
      const edge = WORKFLOW_EDGES.find(e => e.from === mainNode.id && e.to === sideNode.id)
      if (edge?.label) {
        sideEdgeLabels.push({ label: edge.label, color: edge.labelColor || '#9ca3af' })
      }
    }

    rows.push({ row: rowNum, mainNode, sideNodes, sideEdgeLabels })
  }

  return (
    <div className={cn('relative', className)}>
      {/* 图例 */}
      <motion.div
        className="flex flex-wrap items-center gap-4 mb-6 px-4 py-2.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)]"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="text-[10px] text-[var(--app-text-muted)] font-medium mr-1">图例:</span>
        <LegendItem color="#22c55e" label="输入/输出" shape="round" />
        <LegendItem color="#3b82f6" label="处理步骤" shape="rect" />
        <LegendItem color="#f59e0b" label="判断节点" shape="diamond" />
        <LegendItem color="#ef4444" label="异常路径" shape="rect" />
        <LegendItem color="#8b5cf6" label="输出分支" shape="rect" />
        <div className="flex items-center gap-1 ml-2">
          <ArrowRight className="h-3 w-3 text-[#22c55e]" />
          <span className="text-[10px] text-[var(--app-text-secondary)]">正常路径</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowRight className="h-3 w-3 text-[#ef4444]" />
          <span className="text-[10px] text-[var(--app-text-secondary)]">异常路径</span>
        </div>
      </motion.div>

      {/* 流程图主体 - 竖向时间轴布局 */}
      <div className="relative">
        {rows.map((row, rowIndex) => {
          const hasSideNodes = row.sideNodes.length > 0
          const isConfidenceRow = row.mainNode.id === 'check-confidence'
          const isConfidenceResultRow = row.mainNode.id === 'medium-result' || row.mainNode.id === 'high-result' || row.mainNode.id === 'low-result'

          // 置信度结果行特殊处理 - 三列布局
          if (isConfidenceResultRow) return null // 跳过，由 check-confidence 行一起处理

          return (
            <div key={row.mainNode.id}>
              {/* 连接线 - 主轴竖线 */}
              {rowIndex > 0 && (
                <motion.div
                  className="flex items-center justify-center h-6"
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ duration: 0.3, delay: rowIndex * 0.05 }}
                  style={{ transformOrigin: 'top' }}
                >
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-[2px] h-4',
                      row.mainNode.type === 'error' || row.mainNode.id === 'empty-error' || row.mainNode.id === 'parse-error' || row.mainNode.id === 'root-error'
                        ? 'bg-[#ef4444]/30'
                        : 'bg-[#22c55e]/30',
                    )} />
                    <ArrowRight className="h-2.5 w-2.5 -rotate-90 text-[#22c55e]/50" />
                  </div>
                </motion.div>
              )}

              {/* 节点行 */}
              <div className={cn(
                'flex items-start gap-0',
                hasSideNodes ? 'flex-col sm:flex-row' : 'flex-row justify-center',
              )}>
                {/* 主节点 */}
                <div className={cn(
                  'flex-shrink-0',
                  hasSideNodes ? 'w-full sm:w-[55%]' : 'w-full max-w-md mx-auto',
                )}>
                  <FlowNode
                    node={row.mainNode}
                    isHovered={hoveredNode === row.mainNode.id}
                    onHover={() => setHoveredNode(row.mainNode.id)}
                    onLeave={() => setHoveredNode(null)}
                    animateDelay={rowIndex * 0.08}
                  />
                </div>

                {/* 侧分支 - 水平连接 + 侧节点 */}
                {hasSideNodes && (
                  <div className="flex items-start gap-0 w-full sm:w-[45%] mt-2 sm:mt-0">
                    {/* 水平连接线 */}
                    <div className="flex items-center self-center shrink-0 px-1">
                      <motion.div
                        className="flex items-center gap-0"
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ duration: 0.3, delay: rowIndex * 0.08 + 0.1 }}
                        style={{ transformOrigin: 'left' }}
                      >
                        <div className={cn(
                          'w-6 sm:w-8 h-[2px]',
                          row.sideNodes[0]?.type === 'error' ? 'bg-[#ef4444]/30' :
                          row.sideNodes[0]?.type === 'output' ? 'bg-[#8b5cf6]/30' :
                          'bg-[#22c55e]/30',
                        )} />
                        <ArrowRight className={cn(
                          'h-2.5 w-2.5 shrink-0',
                          row.sideNodes[0]?.type === 'error' ? 'text-[#ef4444]/50' :
                          row.sideNodes[0]?.type === 'output' ? 'text-[#8b5cf6]/50' :
                          'text-[#22c55e]/50',
                        )} />
                      </motion.div>
                    </div>

                    {/* 边标签 */}
                    {row.sideEdgeLabels[0] && (
                      <motion.span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full self-center shrink-0 mr-1"
                        style={{
                          color: row.sideEdgeLabels[0].color,
                          backgroundColor: `${row.sideEdgeLabels[0].color}15`,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: rowIndex * 0.08 + 0.15 }}
                      >
                        {row.sideEdgeLabels[0].label}
                      </motion.span>
                    )}

                    {/* 侧节点 */}
                    <div className="flex-1 min-w-0">
                      {row.sideNodes.map((sideNode) => (
                        <FlowNode
                          key={sideNode.id}
                          node={sideNode}
                          isHovered={hoveredNode === sideNode.id}
                          onHover={() => setHoveredNode(sideNode.id)}
                          onLeave={() => setHoveredNode(null)}
                          animateDelay={rowIndex * 0.08 + 0.15}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 置信度三列结果行 - 特殊布局 */}
              {isConfidenceRow && (
                <motion.div
                  className="mt-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: rows.length * 0.08 + 0.2 }}
                >
                  {/* 连接线 */}
                  <div className="flex items-center justify-center h-6">
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-4 bg-[#f59e0b]/30" />
                      <ArrowRight className="h-2.5 w-2.5 -rotate-90 text-[#f59e0b]/50" />
                    </div>
                  </div>

                  {/* 三列分支 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 从 check-confidence 到三个结果的连接线 */}
                    {[
                      { node: WORKFLOW_NODES.find(n => n.id === 'high-result')!, label: '高 ≥80%', color: '#22c55e' },
                      { node: WORKFLOW_NODES.find(n => n.id === 'medium-result')!, label: '中 50-80%', color: '#f59e0b' },
                      { node: WORKFLOW_NODES.find(n => n.id === 'low-result')!, label: '低 <50%', color: '#ef4444' },
                    ].map((item, idx) => (
                      <div key={item.node.id} className="relative">
                        {/* 分支线 */}
                        <div className="flex items-center justify-center mb-2">
                          <motion.div
                            className="flex items-center gap-1"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.1 + 0.3 }}
                          >
                            <div className="w-[2px] h-3" style={{ backgroundColor: `${item.color}30` }} />
                            <ArrowRight className="h-2 w-2 -rotate-90" style={{ color: `${item.color}50` }} />
                          </motion.div>
                        </div>
                        {/* 分支标签 */}
                        <motion.span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mb-2"
                          style={{
                            color: item.color,
                            backgroundColor: `${item.color}15`,
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.1 + 0.35 }}
                        >
                          {item.label}
                        </motion.span>
                        <FlowNode
                          node={item.node}
                          isHovered={hoveredNode === item.node.id}
                          onHover={() => setHoveredNode(item.node.id)}
                          onLeave={() => setHoveredNode(null)}
                          animateDelay={idx * 0.1 + 0.4}
                        />
                      </div>
                    ))}
                  </div>

                  {/* 三条汇聚线 */}
                  <div className="flex items-center justify-center h-6 mt-2">
                    <div className="flex flex-col items-center">
                      <ArrowRight className="h-2.5 w-2.5 -rotate-90 text-[#22c55e]/50" />
                      <div className="w-[2px] h-3 bg-[#22c55e]/30" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
