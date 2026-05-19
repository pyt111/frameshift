/**
 * 代码块提取工具
 * 从 LLM 响应中提取代码块，支持带 markdown 代码块标记和不带标记的响应
 */

/**
 * 从 LLM 响应中提取代码块
 * 支持带 markdown 代码块标记和不带标记的响应
 */
export function extractCodeBlock(response: string, lang: string): string {
  // 尝试匹配带语言标记的代码块
  const codeBlockRegex = new RegExp(`\`\`\`${lang}\\s*\\n([\\s\\S]*?)\`\`\``, 'i');
  const match = response.match(codeBlockRegex);
  if (match) {
    return match[1].trim();
  }

  // 尝试匹配不带语言标记的代码块
  const genericCodeBlockRegex = /```\s*\n([\s\S]*?)```/;
  const genericMatch = response.match(genericCodeBlockRegex);
  if (genericMatch) {
    return genericMatch[1].trim();
  }

  // 没有代码块标记，返回原始响应
  return response.trim();
}
