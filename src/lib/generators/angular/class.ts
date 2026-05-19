/**
 * Angular 代码生成器 — 组件类生成
 */

import type {
  UISemanticTree,
  RootComponentNode,
  ReactiveStateNode,
  ComputedPropNode,
  WatchEffectNode,
  EventHandlerNode,
  TranslationWarning,
} from '../../semantic-tree/types';
import { generateWarning } from '../../translator/confidence';
import { findMapping } from '../../translator/mappings';
import {
  formatCallbackBody,
  escapeRegex,
  toAngularSelector,
  isBlockExpression,
  stripValueAccessForRefs,
  convertStateAccessInExpression,
} from './utils';

/**
 * 从语义树生成 Angular 组件 TypeScript 类代码
 */
export function generateComponentClass(tree: UISemanticTree, warnings: TranslationWarning[]): string {
  const lines: string[] = [];
  const angularImports: Set<string> = new Set();
  const rootNode = tree.nodes[tree.rootId] as RootComponentNode;
  const componentName = rootNode.componentName;

  // Collect needed Angular imports
  let needsCommonModule = false;
  let needsFormsModule = false;

  for (const node of Object.values(tree.nodes)) {
    switch (node.nodeType) {
      case 'reactive-state':
        angularImports.add('signal');
        break;
      case 'computed-prop':
        angularImports.add('computed');
        break;
      case 'watch-effect':
        if (node.effectKind === 'lifecycle') {
          if (node.lifecycleKind === 'onMounted') {
            // Will use ngOnInit
          } else if (node.lifecycleKind === 'onUnmounted') {
            // Will use ngOnDestroy
          }
        }
        break;
      case 'component':
        // Check for v-model → ngModel
        if ((node as import('../../semantic-tree/types').ComponentNode).vModelInfo) {
          needsFormsModule = true;
        }
        break;
    }
  }

  // Check for event handlers that use $event
  needsCommonModule = true; // Most components need CommonModule for basic directives

  // Generate imports
  lines.push("import { Component } from '@angular/core';");
  if (angularImports.size > 0) {
    lines.push(`import { ${Array.from(angularImports).sort().join(', ')} } from '@angular/core';`);
  }
  if (needsCommonModule) {
    lines.push("import { CommonModule } from '@angular/common';");
  }
  if (needsFormsModule) {
    lines.push("import { FormsModule } from '@angular/forms';");
  }

  lines.push('');

  // Generate @Component decorator
  const selector = toAngularSelector(componentName);
  const decoratorImports: string[] = ['CommonModule'];
  if (needsFormsModule) decoratorImports.push('FormsModule');

  lines.push('@Component({');
  lines.push(`  selector: '${selector}',`);
  lines.push('  standalone: true,');
  lines.push(`  imports: [${decoratorImports.join(', ')}],`);
  lines.push('  template: `');
  lines.push('    <!-- Template will be generated below -->');
  lines.push('  `,');
  lines.push('  styles: [`');
  lines.push('    /* Styles will be generated below */');
  lines.push('  ]');
  lines.push('})');

  // Generate class declaration
  lines.push(`export class ${componentName} {`);

  // Collect state names and setter maps for expression conversion
  const stateNames = new Set<string>();
  const setterMap = new Map<string, string>(); // setterName → stateName
  const refNames = new Set<string>(); // Vue ref names

  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state') {
      const stateNode = node as ReactiveStateNode;
      stateNames.add(stateNode.name);
      refNames.add(stateNode.name);
      if (stateNode.setterName) {
        setterMap.set(stateNode.setterName, stateNode.name);
      }
    }
  }

  // Generate signal properties
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state') {
      const stateNode = node as ReactiveStateNode;
      lines.push('');
      const initValue = stateNode.initialValue || 'undefined';

      if (stateNode.stateKind === 'state' || stateNode.stateKind === 'ref') {
        // React useState / Vue ref → Angular signal
        lines.push(`  ${stateNode.name} = signal(${initValue});`);

        if (stateNode.stateKind === 'state') {
          const mapping = findMapping('useState', tree.sourceFramework, 'angular');
          if (mapping && mapping.confidence < 0.9) {
            warnings.push(generateWarning(
              `useState → signal 的转换可能需要手动调整 setter 调用方式`,
              mapping.confidence,
              'mapping-uncertain',
              `useState(${initValue})`,
              `signal(${initValue})`,
            ));
          }
        }
        if (stateNode.stateKind === 'ref') {
          const mapping = findMapping('ref', tree.sourceFramework, 'angular');
          if (mapping && mapping.confidence < 0.9) {
            warnings.push(generateWarning(
              `Vue ref → Angular signal 需要调整 .value 访问方式为函数调用`,
              mapping.confidence,
              'mapping-uncertain',
              `ref(${initValue})`,
              `signal(${initValue})`,
            ));
          }
        }
      } else if (stateNode.stateKind === 'reactive') {
        // Vue reactive → Angular signal with object
        lines.push(`  ${stateNode.name} = signal(${stateNode.initialValue || '{}'});`);
      }
    }
  }

  // Generate computed properties
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'computed-prop') {
      const computedNode = node as ComputedPropNode;
      lines.push('');

      // Strip .value from ref accesses and convert to signal() calls
      let expression = computedNode.expression;
      if (tree.sourceFramework === 'vue3') {
        expression = stripValueAccessForRefs(expression, refNames);
      } else if (tree.sourceFramework === 'react') {
        // For React, just use the expression directly (no .value to strip)
        // but signal names need () for read access
        for (const stateName of stateNames) {
          // In computed expressions, state variables are read, so add ()
          const escaped = escapeRegex(stateName);
          // Don't replace if already followed by () or .set( or .update(
          const pattern = new RegExp(`(?<![a-zA-Z0-9_])${escaped}(?!\\(|\\.set\\(|\\.update\\(|[a-zA-Z0-9_])`, 'g');
          expression = expression.replace(pattern, `${stateName}()`);
        }
      }

      const needsBlock = isBlockExpression(expression);

      if (computedNode.hasSetter && computedNode.setterExpression) {
        lines.push(`  ${computedNode.name} = computed({`);
        lines.push(`    get: () => { return ${expression} },`);
        lines.push(`    set: (val) => { ${computedNode.setterExpression} }`);
        lines.push('  });');
      } else if (needsBlock) {
        lines.push(`  ${computedNode.name} = computed(() => {`);
        lines.push(`    ${expression}`);
        lines.push('  });');
      } else {
        lines.push(`  ${computedNode.name} = computed(() => ${expression});`);
      }
    }
  }

  // Generate lifecycle hooks
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'watch-effect') {
      const effectNode = node as WatchEffectNode;
      lines.push('');

      if (effectNode.effectKind === 'lifecycle' && effectNode.lifecycleKind === 'onMounted') {
        lines.push('  ngOnInit() {');
        lines.push(formatCallbackBody(effectNode.callbackBody));
        lines.push('  }');
      } else if (effectNode.effectKind === 'lifecycle' && effectNode.lifecycleKind === 'onUnmounted') {
        lines.push('  ngOnDestroy() {');
        lines.push(formatCallbackBody(effectNode.callbackBody));
        lines.push('  }');
      } else if (effectNode.effectKind === 'watch' || effectNode.effectKind === 'effect') {
        // Watch/effect → Angular effect() or manual subscription
        // For simplicity, we use effect() for watchEffect-like behavior
        // and a manual approach for watch with specific sources
        if (effectNode.effectKind === 'effect' || effectNode.sources.length === 0) {
          lines.push('  constructor() {');
          lines.push('    effect(() => {');
          lines.push(formatCallbackBody(effectNode.callbackBody, 3));
          lines.push('    });');
          lines.push('  }');
        } else {
          // watch with specific sources → constructor with effect
          lines.push('  constructor() {');
          const sources = effectNode.sources.join(', ');
          lines.push(`    // Watching: ${sources}`);
          lines.push('    effect(() => {');
          lines.push(formatCallbackBody(effectNode.callbackBody, 3));
          lines.push('    });');
          lines.push('  }');
        }
      }
    }
  }

  // Generate event handler methods
  const generatedHandlers = new Set<string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'event-handler') {
      const handlerNode = node as EventHandlerNode;
      if (generatedHandlers.has(handlerNode.handlerName)) continue;
      generatedHandlers.add(handlerNode.handlerName);

      // Skip inline short functions
      if (handlerNode.isInline && handlerNode.handlerBody.length < 40) continue;

      lines.push('');
      const param = handlerNode.eventParam || 'event: any';
      lines.push(`  ${handlerNode.handlerName}(${param}) {`);
      let body = handlerNode.handlerBody;
      // Convert React setter calls to Angular signal.set()
      body = convertStateAccessInExpression(body, stateNames, setterMap);
      lines.push(formatCallbackBody(body));
      lines.push('  }');
    }
  }

  // Add constructor if not already added but needed
  const hasConstructor = lines.some(l => l.includes('constructor()'));
  if (!hasConstructor) {
    // Check if we need to add ngOnInit/ngOnDestroy implements
  }

  // Close class
  lines.push('}');

  return lines.join('\n');
}
