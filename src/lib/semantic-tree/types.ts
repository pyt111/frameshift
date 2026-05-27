/**
 * FrameShift 语义树类型定义
 * 
 * 这是整个项目最核心的设计 —— 框架无关的 UI 语义树。
 * 包含四个子树：组件结构层、状态管理层、事件绑定层、样式层。
 * 每个语义节点都有明确的类型，用于在不同前端框架之间进行等价翻译。
 */

// ==================== 基础类型 ====================

/** 支持的前端框架 */
export type Framework = 'react' | 'vue3' | 'angular';

/** 语义节点的唯一标识 */
export type SemanticNodeId = string;

/** 翻译置信度等级 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** 语义节点基础接口 */
export interface SemanticNodeBase {
  /** 节点唯一标识 */
  id: SemanticNodeId;
  /** 节点类型 */
  nodeType: string;
  /** 翻译置信度 0-1 */
  confidence: number;
  /** 置信度等级 */
  confidenceLevel: ConfidenceLevel;
  /** 源码位置信息 */
  sourceLocation?: SourceLocation;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
}

/** 源码位置信息 */
export interface SourceLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// ==================== 第一层：组件结构层 ====================

/** DOM 元素类型 */
export type DOMTag = string;

/** 组件节点 —— 表示一个 DOM 元素或自定义组件 */
export interface ComponentNode extends SemanticNodeBase {
  nodeType: 'component';
  /** 标签名（如 'div', 'span', 'Counter'） */
  tagName: DOMTag;
  /** 是否为原生 HTML 元素 */
  isNativeElement: boolean;
  /** 属性列表 */
  props: ComponentProp[];
  /** 子节点 */
  children: SemanticNodeId[];
  /** 文本内容（如果有） */
  textContent?: string;
  /** v-model 双向绑定信息（仅 Vue 源码中存在 v-model 时有值） */
  vModelInfo?: VModelInfo;
}

/** 组件属性 */
export interface ComponentProp {
  /** 属性名 */
  name: string;
  /** 属性值（静态值或表达式） */
  value: string | ExpressionValue;
  /** 是否为动态绑定 */
  isDynamic: boolean;
  /** 属性来源（如 React 的 className -> Vue 的 class） */
  originalName?: string;
}

/** v-model 双向绑定信息 */
export interface VModelInfo {
  /** 绑定的变量名（如 "email"） */
  modelVarName: string;
  /** 对应的 React setter 名（如 "setEmail"） */
  setterName: string;
  /** 所在元素标签名（如 "input", "textarea", "select"） */
  tagName: string;
  /** input 的 type 属性（如 "number", "email", "password"），仅 input 元素有 */
  inputType?: string;
  /** v-model 修饰符（如 ["number", "trim"]） */
  modifiers?: string[];
  /** v-model 的参数名（如 v-model:foo 中的 "foo"） */
  arg?: string;
}

/** 表达式值 */
export interface ExpressionValue {
  /** 表达式字符串 */
  expression: string;
  /** 表达式类型 */
  type: 'identifier' | 'member' | 'call' | 'binary' | 'ternary' | 'template' | 'arrow-function' | 'other';
}

/** 文本节点 */
export interface TextNode extends SemanticNodeBase {
  nodeType: 'text';
  /** 文本内容（可能包含插值表达式） */
  content: string;
  /** 插值表达式列表 */
  interpolations?: Interpolation[];
}

/** 插值表达式 */
export interface Interpolation {
  /** 表达式字符串 */
  expression: string;
  /** 在文本中的起始位置 */
  startIndex: number;
  /** 在文本中的结束位置 */
  endIndex: number;
}

/** 根组件节点 */
export interface RootComponentNode extends SemanticNodeBase {
  nodeType: 'root';
  /** 组件名称 */
  componentName: string;
  /** 组件参数（Props 定义） */
  propsDefinition: PropDefinition[];
  /** 组件子节点的根 ID */
  body: SemanticNodeId;
  /** 源框架 */
  sourceFramework: Framework;
}

/** Props 定义 */
export interface PropDefinition {
  /** 属性名 */
  name: string;
  /** 类型（字符串形式，如 'string', 'number'） */
  type: string;
  /** 默认值 */
  defaultValue?: string;
  /** 是否必填 */
  required: boolean;
  /** 属性描述 */
  description?: string;
}

// ==================== 第二层：状态管理层 ====================

/** 响应式状态节点 */
export interface ReactiveStateNode extends SemanticNodeBase {
  nodeType: 'reactive-state';
  /** 状态变量名 */
  name: string;
  /** 初始值表达式 */
  initialValue: string;
  /** 状态类型 */
  stateKind: 'state' | 'ref' | 'reactive';
  /** 对应的 setter/更新函数名（React: setXxx, Vue: 直接赋值） */
  setterName?: string;
  /** TypeScript 类型注解 */
  typeAnnotation?: string;
}

/** 计算属性节点 */
export interface ComputedPropNode extends SemanticNodeBase {
  nodeType: 'computed-prop';
  /** 计算属性名 */
  name: string;
  /** 计算表达式 */
  expression: string;
  /** 依赖列表 */
  dependencies: string[];
  /** 是否有 getter 和 setter */
  hasSetter: boolean;
  /** setter 表达式（如果有） */
  setterExpression?: string;
}

/** 副作用/观察节点 */
export interface WatchEffectNode extends SemanticNodeBase {
  nodeType: 'watch-effect';
  /** 观察的源 */
  sources: string[];
  /** 回调函数体 */
  callbackBody: string;
  /** 是否立即执行 */
  immediate: boolean;
  /** 是否深度观察 */
  deep: boolean;
  /** 清理函数体（React useEffect 的 return / Vue watch 的 onCleanup） */
  cleanupBody?: string;
  /** 副作用类型 */
  effectKind: 'watch' | 'effect' | 'lifecycle';
  /** 生命周期类型（仅 effectKind 为 lifecycle 时有效） */
  lifecycleKind?: 'onMounted' | 'onUnmounted' | 'onUpdated' | 'onCreated' | 'other';
}

// ==================== 第三层：事件绑定层 ====================

/** 事件处理节点 */
export interface EventHandlerNode extends SemanticNodeBase {
  nodeType: 'event-handler';
  /** 事件名（如 'click', 'input', 'change'） */
  eventName: string;
  /** 事件处理函数名 */
  handlerName: string;
  /** 处理函数体 */
  handlerBody: string;
  /** 事件参数 */
  eventParam?: string;
  /** 是否为内联处理函数 */
  isInline: boolean;
  /** 修饰符（Vue 的 .stop, .prevent 等） */
  modifiers?: string[];
}

/** 条件渲染节点 */
export interface ConditionalRenderNode extends SemanticNodeBase {
  nodeType: 'conditional-render';
  /** 条件表达式 */
  condition: string;
  /** 条件为真时的内容节点 ID */
  trueBranch: SemanticNodeId;
  /** 条件为假时的内容节点 ID（v-else / : else） */
  falseBranch?: SemanticNodeId;
  /** 条件类型 */
  conditionalKind: 'if' | 'ternary' | 'logical-and';
}

/** 列表渲染节点 */
export interface ListRenderNode extends SemanticNodeBase {
  nodeType: 'list-render';
  /** 被迭代的数组表达式 */
  iterableExpression: string;
  /** 迭代变量名 */
  itemName: string;
  /** 索引变量名 */
  indexName?: string;
  /** 列表项的 key 表达式 */
  keyExpression?: string;
  /** 循环体内容节点 ID */
  body: SemanticNodeId;
}

// ==================== 第四层：样式层 ====================

/** 样式节点 */
export interface StyleNode extends SemanticNodeBase {
  nodeType: 'style';
  /** 样式类型 */
  styleKind: 'inline' | 'scoped' | 'global' | 'module';
  /** CSS/SCSS 内容 */
  content: string;
  /** CSS 预处理器类型 */
  preprocessor?: 'css' | 'scss' | 'less' | 'tailwind';
  /** 关联的选择器/类名 */
  selector?: string;
  /** 作用域标识（Vue scoped style） */
  scopeId?: string;
}

// ==================== 联合类型 ====================

/** 所有语义节点类型的联合 */
export type SemanticNode =
  | RootComponentNode
  | ComponentNode
  | TextNode
  | ReactiveStateNode
  | ComputedPropNode
  | WatchEffectNode
  | EventHandlerNode
  | ConditionalRenderNode
  | ListRenderNode
  | StyleNode;

// ==================== 语义树 ====================

/** 完整的 UI 语义树 */
export interface UISemanticTree {
  /** 树的唯一标识 */
  id: string;
  /** 根节点 ID */
  rootId: SemanticNodeId;
  /** 所有节点的映射表（ID → 节点） */
  nodes: Record<SemanticNodeId, SemanticNode>;
  /** 源框架 */
  sourceFramework: Framework;
  /** 解析时间戳 */
  parsedAt: number;
  /** 解析警告 */
  parseWarnings: ParseWarning[];
  /** 原始 import 语句（从 <script setup> 中提取，供生成器使用） */
  importStatements?: string[];
  /** 原始脚本代码（未被 AST 解析器处理的代码，供生成器保留） */
  rawScriptCode?: string;
  /** 原始模板代码（供参考） */
  rawTemplateCode?: string;
}

/** 解析警告 */
export interface ParseWarning {
  /** 警告消息 */
  message: string;
  /** 警告级别 */
  level: 'error' | 'warning' | 'info';
  /** 源码位置 */
  location?: SourceLocation;
  /** 关联的节点 ID */
  nodeId?: SemanticNodeId;
}

// ==================== 翻译结果 ====================

/** 翻译结果 */
export interface TranslationResult {
  /** 生成的代码 */
  code: string;
  /** 目标框架 */
  targetFramework: Framework;
  /** 整体置信度 0-1 */
  overallConfidence: number;
  /** 置信度等级 */
  confidenceLevel: ConfidenceLevel;
  /** 警告列表 */
  warnings: TranslationWarning[];
  /** 翻译耗时（毫秒） */
  duration: number;
  /** 语义树（供前端展示） */
  semanticTree?: UISemanticTree;
  /** 生成的样式代码 */
  styles?: string;
  /** 额外需要的 import 语句 */
  imports?: string[];
  /** 翻译流水线步骤 */
  pipeline?: TranslationPipeline;
}

/** 翻译警告 */
export interface TranslationWarning {
  /** 警告唯一标识 */
  id: string;
  /** 警告消息 */
  message: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 置信度等级 */
  confidenceLevel: ConfidenceLevel;
  /** 警告类型 */
  warningType: 'mapping-uncertain' | 'pattern-unsupported' | 'manual-review' | 'ai-assisted' | 'style-mismatch';
  /** 源码位置 */
  sourceLocation?: SourceLocation;
  /** AI 建议（如果使用 AI 辅助翻译） */
  aiSuggestion?: string;
  /** 关联的源代码片段 */
  sourceSnippet?: string;
  /** 关联的目标代码片段 */
  targetSnippet?: string;
}

// ==================== 翻译请求 ====================

/** AI 配置（从前端传入后端） */
export interface TranslationAIConfig {
  /** 提供商类型 */
  provider: 'custom';
  /** API 协议（openai-completions / openai-responses / anthropic-messages） */
  apiProtocol?: 'openai-completions' | 'openai-responses' | 'anthropic-messages';
  /** 自定义 API Base URL */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 模型名称 */
  model: string;
}

/** 翻译请求参数 */
export interface TranslationRequest {
  /** 源代码 */
  sourceCode: string;
  /** 源框架 */
  sourceFramework: Framework;
  /** 目标框架 */
  targetFramework: Framework;
  /** 是否启用 AI 辅助 */
  enableAI?: boolean;
  /** AI 配置（自定义 API 时需要传入） */
  aiConfig?: TranslationAIConfig;
}

// ==================== 翻译流水线步骤 ====================

/** 翻译流水线步骤状态 */
export type PipelineStepStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

/** 单个流水线步骤 */
export interface PipelineStep {
  /** 步骤 ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤描述 */
  description: string;
  /** 步骤状态 */
  status: PipelineStepStatus;
  /** 步骤耗时（毫秒） */
  duration?: number;
  /** 步骤图标名 */
  icon: string;
  /** 步骤产出的摘要信息 */
  summary?: string;
  /** 步骤详细数据（JSON 序列化） */
  detail?: Record<string, unknown>;
}

/** 完整的翻译流水线 */
export interface TranslationPipeline {
  /** 流水线步骤列表 */
  steps: PipelineStep[];
  /** 总耗时 */
  totalDuration?: number;
}

// ==================== 示例组件定义 ====================

/** 示例组件 */
export interface ExampleComponent {
  /** 示例 ID */
  id: string;
  /** 示例名称 */
  name: string;
  /** 示例描述 */
  description: string;
  /** 示例难度 */
  difficulty: 'basic' | 'intermediate' | 'advanced';
  /** 标签 */
  tags: string[];
  /** 源框架代码 */
  reactCode: string;
  /** Vue 3 代码 */
  vueCode: string;
  /** Angular 代码 */
  angularCode?: string;
  /** 涵盖的模式列表 */
  patterns: string[];
}
