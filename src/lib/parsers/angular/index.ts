/**
 * Angular 解析器 - 主入口
 * 将 Angular 17+ 组件代码解析为 UISemanticTree 语义树
 * 支持 standalone 组件、signal()、computed()、@if/@for 控制流
 */

import type {
  UISemanticTree,
  RootComponentNode,
  Framework,
} from '../../semantic-tree/types';
import { resetIdCounter, generateNodeId } from './utils';
import type { AngularParserContext } from './context';
import { parseComponentClass, parseTemplateContent } from './decorator-parser';

/**
 * 解析 Angular 组件源码为 UISemanticTree
 * @param sourceCode Angular 组件源码（TypeScript + template + styles）
 * @returns UISemanticTree 语义树
 */
export function parseAngular(sourceCode: string): UISemanticTree {
  resetIdCounter();

  const ctx: AngularParserContext = {
    nodes: {},
    warnings: [],
    componentName: 'AngularComponent',
    propsDefinition: [],
    styleNodes: [],
    eventHandlers: new Map(),
    signalNames: new Set(),
    computedNames: new Set(),
    templateContent: '',
    stylesContent: '',
    selector: '',
  };

  // Step 1: Parse the TypeScript class to extract signals, computed, methods, etc.
  parseComponentClass(sourceCode, ctx);

  // Step 2: Parse the template content
  if (ctx.templateContent) {
    const bodyId = parseTemplateContent(ctx.templateContent, ctx);
    if (bodyId) {
      // Create root component node
      const rootId = generateNodeId('root');
      const rootNode: RootComponentNode = {
        id: rootId,
        nodeType: 'root',
        componentName: ctx.componentName,
        propsDefinition: ctx.propsDefinition,
        body: bodyId,
        sourceFramework: 'angular' as Framework,
        confidence: 0.9,
        confidenceLevel: 'high',
      };
      ctx.nodes[rootId] = rootNode;

      return {
        id: `tree-${Date.now()}`,
        rootId,
        nodes: ctx.nodes,
        sourceFramework: 'angular' as Framework,
        parsedAt: Date.now(),
        parseWarnings: ctx.warnings,
      };
    }
  }

  // Fallback: create a minimal tree if template parsing failed
  const emptyId = generateNodeId('root');
  const emptyRoot: RootComponentNode = {
    id: emptyId,
    nodeType: 'root',
    componentName: ctx.componentName,
    propsDefinition: [],
    body: '',
    sourceFramework: 'angular' as Framework,
    confidence: 0.3,
    confidenceLevel: 'low',
  };

  const placeholderId = generateNodeId('text');
  ctx.nodes[placeholderId] = {
    id: placeholderId,
    nodeType: 'text',
    content: '// Angular component parsed (template extraction may be limited)',
    confidence: 0.5,
    confidenceLevel: 'medium',
  };
  emptyRoot.body = placeholderId;
  ctx.nodes[emptyId] = emptyRoot;

  ctx.warnings.push({
    message: 'Angular 模板解析受限，建议手动检查生成的代码',
    level: 'info',
  });

  return {
    id: `tree-${Date.now()}`,
    rootId: emptyId,
    nodes: ctx.nodes,
    sourceFramework: 'angular' as Framework,
    parsedAt: Date.now(),
    parseWarnings: ctx.warnings,
  };
}
