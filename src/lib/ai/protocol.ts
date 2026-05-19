/**
 * API 协议工具函数
 * 
 * 包含协议规范化、URL 构建、SSE 事件解析等功能。
 * 响应格式自动检测：无论用户选了什么协议，中转服务可能返回任意格式。
 * extractContentFromAnyFormat() 按优先级尝试所有格式，
 * 确保中转服务也能正常工作。
 */

import type { AIApiProtocol } from './types';

/** 规范化协议值（向后兼容旧的 'openai' 值） */
export function normalizeProtocol(protocol: string | undefined): AIApiProtocol {
  if (protocol === 'openai') return 'openai-completions'; // 向后兼容
  if (protocol === 'openai-completions' || protocol === 'openai-responses' || protocol === 'anthropic-messages') return protocol;
  if (protocol === 'anthropic') return 'anthropic-messages'; // 向后兼容旧值
  return 'openai-completions'; // 默认值
}

/**
 * 智能构建 API 的完整请求 URL
 * 
 * 根据 API 协议类型构建不同的 URL：
 * - OpenAI: .../v1/chat/completions
 * - Anthropic: .../v1/messages
 * - OpenAI Responses: .../v1/responses
 * 
 * 支持多种 base URL 格式：
 * - https://api.openai.com/v1 → https://api.openai.com/v1/chat/completions
 * - https://rehdasu.cn → https://rehdasu.cn/v1/chat/completions（自动添加版本路径）
 * - https://api.anthropic.com → https://api.anthropic.com/v1/messages
 */
export function buildApiUrl(baseUrl: string, protocol: AIApiProtocol = 'openai-completions'): string {
  const normalizedProtocol = normalizeProtocol(protocol);
  let url = baseUrl.replace(/\/+$/, ''); // 移除末尾斜杠
  
  let endpoint: string;
  if (normalizedProtocol === 'anthropic-messages') {
    endpoint = '/messages';
  } else if (normalizedProtocol === 'openai-responses') {
    endpoint = '/responses';
  } else {
    endpoint = '/chat/completions';
  }
  
  // 如果 URL 已经以正确的 endpoint 结尾，直接使用
  if (url.endsWith(endpoint)) {
    return url;
  }
  
  // 如果 URL 以不匹配的 endpoint 结尾，先移除
  const knownEndpoints = ['/chat/completions', '/messages', '/responses'];
  for (const ep of knownEndpoints) {
    if (url.endsWith(ep)) {
      url = url.slice(0, -ep.length);
      break;
    }
  }
  
  // 检测 URL 是否已经包含版本路径（如 /v1, /v2, /v3, /v4 等）
  const hasVersionPath = /\/v\d+(?:\/|$)/.test(url) || url.endsWith('/v1') || url.endsWith('/v2') || url.endsWith('/v3') || url.endsWith('/v4') || url.endsWith('/v5') || url.endsWith('/beta');
  
  if (hasVersionPath) {
    return url + endpoint;
  }
  
  // URL 没有版本路径，自动添加 /v1
  return url + '/v1' + endpoint;
}

/**
 * 从 JSON 响应中提取内容——多协议兼容解析
 *
 * 核心思路：无论用户选了什么协议，API 代理可能返回任意格式的响应。
 * 本函数按优先级尝试所有格式，确保中转服务也能正常工作。
 *
 * 解析优先级：
 * 1. OpenAI Chat Completions: choices[0].message.content
 * 2. Anthropic: content[{type:"text"}].text
 * 3. OpenAI Responses: output[{type:"message"}].content[{type:"output_text"}].text
 * 4. Anthropic (text 类型宽松匹配): content[any].text
 * 5. Responses (宽松匹配): output[any].content[any].text
 *
 * @returns {{ content: string; detectedFormat: string }} 提取到的内容和检测到的响应格式
 */
export function extractContentFromAnyFormat(data: any, preferredProtocol?: AIApiProtocol): { content: string; detectedFormat: string } {
  // 规范化首选协议为内部检测键
  const normalizedPreferred = preferredProtocol ? normalizeProtocol(preferredProtocol) : undefined;
  
  // 按首选协议优先尝试
  const tryOrder: string[] = [];
  if (normalizedPreferred) {
    // 将协议类型映射为内部检测键
    // openai-completions → openai, anthropic-messages → anthropic, openai-responses → openai-responses
    const detectKey = normalizedPreferred === 'openai-completions' ? 'openai'
      : normalizedPreferred === 'anthropic-messages' ? 'anthropic'
      : normalizedPreferred;
    tryOrder.push(detectKey);
  }
  // 补充其余格式（包括 OpenAI Responses 格式，中转服务可能返回）
  const allFormats = ['openai', 'anthropic', 'openai-responses'];
  for (const p of allFormats) {
    if (!tryOrder.includes(p)) tryOrder.push(p);
  }

  for (const p of tryOrder) {
    if (p === 'openai') {
      // OpenAI Chat Completions: { choices: [{message: {content: "..."}}] }
      const openaiContent = data.choices?.[0]?.message?.content;
      if (typeof openaiContent === 'string' && openaiContent.trim()) {
        return { content: openaiContent, detectedFormat: 'OpenAI Chat' };
      }
    } else if (p === 'anthropic') {
      // Anthropic: { content: [{type: "text", text: "..."}] }
      if (data.content && Array.isArray(data.content)) {
        let anthropicContent = '';
        for (const block of data.content) {
          if (block.type === 'text' && block.text) {
            anthropicContent += block.text;
          }
        }
        if (anthropicContent.trim()) {
          return { content: anthropicContent, detectedFormat: 'Anthropic' };
        }
        // 宽松匹配：content 数组中有 text 字段就行
        let looseContent = '';
        for (const block of data.content) {
          if (typeof block.text === 'string') looseContent += block.text;
        }
        if (looseContent.trim()) {
          return { content: looseContent, detectedFormat: 'Anthropic (宽松)' };
        }
      }
    } else if (p === 'openai-responses') {
      // OpenAI Responses: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
      if (data.output && Array.isArray(data.output)) {
        let responsesContent = '';
        for (const item of data.output) {
          if (item.content && Array.isArray(item.content)) {
            for (const block of item.content) {
              if (block.type === 'output_text' && block.text) {
                responsesContent += block.text;
              }
            }
          }
        }
        if (responsesContent.trim()) {
          return { content: responsesContent, detectedFormat: 'OpenAI Responses' };
        }
        // 宽松匹配：output 数组中任何有 text 的内容
        let looseContent = '';
        for (const item of data.output) {
          if (item.content && Array.isArray(item.content)) {
            for (const block of item.content) {
              if (typeof block.text === 'string') looseContent += block.text;
            }
          }
        }
        if (looseContent.trim()) {
          return { content: looseContent, detectedFormat: 'OpenAI Responses (宽松)' };
        }
      }
    }
  }

  return { content: '', detectedFormat: '未知' };
}

/**
 * 从 SSE 流式事件中提取 token——多协议兼容解析
 *
 * 不管选择了什么协议，尝试从所有可能的 SSE 事件格式中提取 token。
 * 这确保中转服务返回任何格式的 SSE 都能被正确解析。
 */
export function extractTokenFromSSEEvent(parsed: any, detectedType: string): string {
  // 1. OpenAI Chat Completions: choices[0].delta.content
  const openaiToken = parsed.choices?.[0]?.delta?.content;
  if (typeof openaiToken === 'string') return openaiToken;

  // 2. Anthropic: content_block_delta → delta.text
  if (detectedType === 'content_block_delta') {
    return parsed.delta?.text || '';
  }

  // 3. OpenAI Responses: response.output_text.delta / response.text.delta
  if (detectedType === 'response.output_text.delta' || detectedType === 'response.text.delta') {
    return parsed.delta || parsed.content || parsed.text || '';
  }

  // 4. 通用回退：尝试从 delta 字段中取内容
  if (parsed.delta) {
    if (typeof parsed.delta === 'string') return parsed.delta;
    if (typeof parsed.delta?.text === 'string') return parsed.delta.text;
    if (typeof parsed.delta?.content === 'string') return parsed.delta.content;
  }

  // 5. 尝试直接取 text / content 字段
  if (typeof parsed.text === 'string' && !detectedType.startsWith('response.')) return parsed.text;
  if (typeof parsed.content === 'string' && !detectedType.startsWith('response.')) return parsed.content;

  return '';
}

/** 判断 SSE 事件是否是结束事件 */
export function isSSEStreamEndEvent(detectedType: string): boolean {
  return detectedType === 'message_stop'
    || detectedType === 'response.completed'
    || detectedType === 'response.done'
    || detectedType === 'done';
}

/** 判断 SSE 事件是否是错误事件 */
export function isSSEErrorEvent(detectedType: string): boolean {
  return detectedType === 'error'
    || detectedType === 'response.error';
}

/** 从 SSE 错误事件中提取错误消息 */
export function extractSSEErrorMessage(parsed: any, fallbackMsg: string): string {
  return parsed.error?.message || parsed.message || fallbackMsg;
}
