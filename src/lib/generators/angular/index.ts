/**
 * Angular 代码生成器 — 主入口
 * 将 UISemanticTree 语义树生成为 Angular 17+ standalone 组件代码
 * 支持 signal()、computed()、@if/@for 控制流
 */

import type { UISemanticTree } from '../../semantic-tree/types';
import { generateWarning } from '../../translator/confidence';

import type { AngularGenerateResult } from './utils';
import { generateTemplateContent } from './template';
import { generateComponentClass } from './class';
import { generateStyleBlock, postProcessCode } from './styles';

/**
 * 主生成函数：从 UISemanticTree 生成 Angular 组件代码
 */
export function generateAngular(tree: UISemanticTree): AngularGenerateResult {
  const warnings: import('../../semantic-tree/types').TranslationWarning[] = [];

  // Generate template content
  const templateContent = generateTemplateContent(tree, warnings);

  // Generate style content
  const styleContent = generateStyleBlock(tree);

  // Generate component class (without template/styles in decorator)
  const classCode = generateComponentClass(tree, warnings);

  // Now assemble the full component by replacing the placeholder template and styles
  let fullCode = classCode;

  // Replace template placeholder with actual template
  fullCode = fullCode.replace(
    /template:\s*`\s*<!-- Template will be generated below -->\s*`,/,
    () => {
      const indentedTemplate = templateContent
        .split('\n')
        .map(line => (line.trim() ? '    ' + line : ''))
        .join('\n');
      return `template: \`\n${indentedTemplate}\n  \`,`;
    }
  );

  // Replace styles placeholder with actual styles
  if (styleContent.trim()) {
    fullCode = fullCode.replace(
      /styles:\s*\[\s*`\/\* Styles will be generated below \*\/`\s*\]/,
      () => {
        const indentedStyles = styleContent
          .split('\n')
          .map(line => (line.trim() ? '    ' + line : ''))
          .join('\n');
        return `styles: [\`\n${indentedStyles}\n  \`]`;
      }
    );
  } else {
    // Remove empty styles
    fullCode = fullCode.replace(
      /,\s*styles:\s*\[\s*`\/\* Styles will be generated below \*\/`\s*\]/,
      ''
    );
  }

  // Post-process: convert setter calls and ref mutations
  fullCode = postProcessCode(tree, fullCode);

  // Add source framework specific warnings
  if (tree.sourceFramework === 'react') {
    warnings.push(generateWarning(
      'React JSX 语法已转换为 Angular 模板语法 (Angular 17+)',
      0.85,
      'mapping-uncertain',
    ));
  } else if (tree.sourceFramework === 'vue3') {
    warnings.push(generateWarning(
      'Vue 模板语法已转换为 Angular 模板语法 (Angular 17+)',
      0.85,
      'mapping-uncertain',
    ));
  }

  // Collect imports
  const imports: string[] = [];
  const angularCoreImport = fullCode.match(/import\s+\{[^}]+\}\s+from\s+'@angular\/core'/);
  if (angularCoreImport) {
    imports.push(angularCoreImport[0]);
  }
  const commonImport = fullCode.match(/import\s+\{[^}]+\}\s+from\s+'@angular\/common'/);
  if (commonImport) {
    imports.push(commonImport[0]);
  }
  const formsImport = fullCode.match(/import\s+\{[^}]+\}\s+from\s+'@angular\/forms'/);
  if (formsImport) {
    imports.push(formsImport[0]);
  }

  return {
    code: fullCode,
    styles: styleContent,
    imports,
    warnings,
  };
}

// Re-export types for backward compatibility
export type { AngularGenerateResult } from './utils';
