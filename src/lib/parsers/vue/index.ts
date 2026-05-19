/**
 * Vue 3 解析器主入口
 * 将 Vue 3 SFC 代码解析为 UISemanticTree 语义树
 * 使用 @vue/compiler-sfc 解析 .vue 文件，并结合 Babel 解析 <script setup> 块
 */

import { parse as parseSfc } from '@vue/compiler-sfc';
import type {
  UISemanticTree,
  SemanticNodeId,
  RootComponentNode,
  StyleNode,
  Framework,
} from '../../semantic-tree/types';

import { generateNodeId, resetIdCounter } from './utils';
import { parseTemplateAst } from './template-parser';
import { parseScriptSetup } from './script-parser';
import type { VueParserContext } from './context';

/**
 * 解析 Vue 3 SFC 源码为 UISemanticTree
 * @param sourceCode Vue 3 SFC 源码
 * @returns UISemanticTree 语义树
 */
export function parseVue(sourceCode: string): UISemanticTree {
  resetIdCounter();

  const ctx: VueParserContext = {
    nodes: {},
    warnings: [],
    componentName: 'UnknownComponent',
    propsDefinition: [],
    styleNodes: [],
    eventHandlers: new Map(),
    emitNames: [],
    importStatements: [],
    rawScriptCode: '',
  };

  // 步骤1：使用 @vue/compiler-sfc 解析 SFC
  let sfcResult: ReturnType<typeof parseSfc>;
  try {
    sfcResult = parseSfc(sourceCode, {
      filename: 'component.vue',
      sourceMap: false,
    });
  } catch (e) {
    ctx.warnings.push({
      message: `Vue SFC 解析失败: ${e instanceof Error ? e.message : String(e)}`,
      level: 'error',
    });
    const emptyId = generateNodeId('root');
    const emptyRoot: RootComponentNode = {
      id: emptyId,
      nodeType: 'root',
      componentName: 'ParseError',
      propsDefinition: [],
      body: '',
      sourceFramework: 'vue3',
      confidence: 0,
      confidenceLevel: 'low',
    };
    return {
      id: `tree-${Date.now()}`,
      rootId: emptyId,
      nodes: { [emptyId]: emptyRoot },
      sourceFramework: 'vue3',
      parsedAt: Date.now(),
      parseWarnings: ctx.warnings,
      importStatements: ctx.importStatements,
      rawScriptCode: ctx.rawScriptCode || undefined,
    };
  }

  const { descriptor } = sfcResult;

  // 步骤2：获取组件名称
  // 优先从文件名推断，或从 <script setup> 中提取
  ctx.componentName = descriptor.filename?.replace('.vue', '') || 'VueComponent';
  // 尝试首字母大写
  if (ctx.componentName.charAt(0) === ctx.componentName.charAt(0).toLowerCase()) {
    ctx.componentName = ctx.componentName.charAt(0).toUpperCase() + ctx.componentName.slice(1);
  }

  // 步骤3：解析 <script setup> 块
  if (descriptor.scriptSetup) {
    parseScriptSetup(descriptor.scriptSetup.content, ctx);
  }

  // 也解析非 setup 的 script 块（如 options API）
  if (descriptor.script && !descriptor.scriptSetup) {
    // 简化处理：尝试从 options API 中提取信息
    ctx.warnings.push({
      message: '检测到 Options API 的 <script> 块，暂仅支持 <script setup> 的完整解析',
      level: 'info',
    });
  }

  // 步骤4：解析 <template> 块
  let bodyId: SemanticNodeId;
  if (descriptor.template) {
    // 编译模板为渲染函数以获取 AST
    const templateAst = descriptor.template.ast;

    if (templateAst) {
      // 递归解析模板 AST
      // templateAst 是根节点，通常包含多个子节点
      // 我们需要一个容器来包裹所有根级模板节点
      const rootChildren = templateAst.children || [];

      if (rootChildren.length === 1) {
        // 单根节点，直接解析
        const parsed = parseTemplateAst(rootChildren[0], ctx, sourceCode);
        bodyId = parsed || generateNodeId('component');
      } else {
        // 多根节点（Vue 3 支持片段），创建一个虚拟容器
        const childIds: SemanticNodeId[] = [];
        for (const child of rootChildren) {
          const childId = parseTemplateAst(child, ctx, sourceCode);
          if (childId) childIds.push(childId);
        }

        const containerId = generateNodeId('component');
        ctx.nodes[containerId] = {
          id: containerId,
          nodeType: 'component',
          tagName: 'Fragment',
          isNativeElement: false,
          props: [],
          children: childIds,
          confidence: 0.9,
          confidenceLevel: 'high',
        };
        bodyId = containerId;
      }
    } else {
      // 没有模板 AST，创建空占位
      const emptyId = generateNodeId('text');
      ctx.nodes[emptyId] = {
        id: emptyId,
        nodeType: 'text',
        content: '{ /* 无模板内容 */ }',
        confidence: 0.5,
        confidenceLevel: 'medium',
      };
      bodyId = emptyId;
    }
  } else {
    // 没有 template 块
    const emptyId = generateNodeId('text');
    ctx.nodes[emptyId] = {
      id: emptyId,
      nodeType: 'text',
      content: '{ /* 无模板 */ }',
      confidence: 0.5,
      confidenceLevel: 'medium',
    };
    bodyId = emptyId;
  }

  // 步骤5：解析 <style> 块
  if (descriptor.styles.length > 0) {
    for (const styleBlock of descriptor.styles) {
      const styleId = generateNodeId('style');
      const styleNode: StyleNode = {
        id: styleId,
        nodeType: 'style',
        styleKind: styleBlock.scoped ? 'scoped' : 'global',
        content: styleBlock.content,
        preprocessor: (styleBlock.lang as StyleNode['preprocessor']) || 'css',
        scopeId: styleBlock.scoped ? (styleBlock.module ? String(styleBlock.module) : undefined) : undefined,
        confidence: 0.95,
        confidenceLevel: 'high',
      };
      ctx.nodes[styleId] = styleNode;
      ctx.styleNodes.push(styleNode);
    }
  }

  // 步骤6：创建根节点
  const rootId = generateNodeId('root');
  const rootNode: RootComponentNode = {
    id: rootId,
    nodeType: 'root',
    componentName: ctx.componentName,
    propsDefinition: ctx.propsDefinition,
    body: bodyId,
    sourceFramework: 'vue3' as Framework,
    confidence: 0.9,
    confidenceLevel: 'high',
  };
  ctx.nodes[rootId] = rootNode;

  // 步骤7：构建语义树
  return {
    id: `tree-${Date.now()}`,
    rootId,
    nodes: ctx.nodes,
    sourceFramework: 'vue3' as Framework,
    parsedAt: Date.now(),
    parseWarnings: ctx.warnings,
    importStatements: ctx.importStatements.length > 0 ? ctx.importStatements : undefined,
    rawScriptCode: ctx.rawScriptCode || undefined,
    rawTemplateCode: descriptor.template?.content || undefined,
  };
}
