/**
 * Vue 3 代码生成器 - 主入口
 * 将 UISemanticTree 语义树生成为 Vue 3 SFC 代码
 * 支持 <script setup lang="ts"> + <template> + <style scoped>
 */

import type { UISemanticTree, TranslationWarning } from '../../semantic-tree/types';
import { generateWarning } from '../../translator/confidence';
import { generateScriptSetup } from './script-setup';
import { generateTemplate } from './template';
import { generateStyleBlock } from './styles';
import {
  convertReactSetters,
  fixInterpolationSpacing,
  type VueGenerateResult,
} from './utils';

export type { VueGenerateResult };

/**
 * 主生成函数：从 UISemanticTree 生成 Vue 3 SFC 代码
 */
export function generateVue(tree: UISemanticTree): VueGenerateResult {
  const warnings: TranslationWarning[] = [];

  // 生成 <script setup> 块
  const scriptContent = generateScriptSetup(tree, warnings);

  // 生成 <template> 块
  const templateContent = generateTemplate(tree, warnings);

  // 生成 <style> 块
  const styleContent = generateStyleBlock(tree);

  // 组装完整的 Vue 3 SFC
  const parts: string[] = [];

  // <script setup lang="ts">
  parts.push('<script setup lang="ts">');
  if (scriptContent.trim()) {
    parts.push(scriptContent);
  }
  parts.push('</script>');

  // <template>
  parts.push('');
  parts.push('<template>');
  // 缩进模板内容
  const indentedTemplate = templateContent
    .split('\n')
    .map(line => (line.trim() ? '  ' + line : ''))
    .join('\n');
  parts.push(indentedTemplate);
  parts.push('</template>');

  // <style scoped>（如果有样式）
  if (styleContent.trim()) {
    parts.push('');
    parts.push('<style scoped>');
    parts.push(styleContent);
    parts.push('</style>');
  }

  // 收集所有 import 语句
  const imports: string[] = [];
  const vueImportMatch = scriptContent.match(/import\s+\{[^}]+\}\s+from\s+'vue'/);
  if (vueImportMatch) {
    imports.push(vueImportMatch[0]);
  }

  // 组装完整代码
  let fullCode = parts.join('\n');

  // 后处理：将 React 的 setter 调用转换为 Vue ref 赋值
  fullCode = convertReactSetters(tree, fullCode);

  // 后处理：修复插值表达式空格 {{count}} → {{ count }}
  fullCode = fixInterpolationSpacing(fullCode);

  // 添加源框架特定警告
  if (tree.sourceFramework === 'react') {
    // React → Vue 的特殊转换提示
    warnings.push(generateWarning(
      'React JSX 语法已转换为 Vue 模板语法',
      0.9,
      'mapping-uncertain',
    ));
  }

  return {
    code: fullCode,
    styles: styleContent,
    imports,
    warnings,
  };
}
