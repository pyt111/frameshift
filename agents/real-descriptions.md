# Agent 真实描述（来自 Task 工具定义，原文输出）

---

## general-purpose

> General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: *)

---

## Explore

> Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions. (Tools: All tools)

---

## Plan

> Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. (Tools: All tools)

---

## frontend-styling-expert

> Use this agent when you need help with CSS, styling frameworks, responsive design, UI/UX implementation, animations, layout systems, or any visual/presentational aspects of web development. Examples: (1) User: 'I need to create a responsive navigation menu that collapses on mobile' → Assistant: 'Let me use the frontend-styling-expert agent to help design this responsive navigation component' (2) User: 'The button hover effects aren't smooth enough' → Assistant: 'I'll use the frontend-styling-expert agent to optimize these animations' (3) User: 'Can you help me center this div?' → Assistant: 'I'm calling the frontend-styling-expert agent to provide the best centering solution for your use case' (4) After writing HTML structure: Assistant: 'Now let me use the frontend-styling-expert agent to add professional styling to this component' (Tools: All tools)

---

## full-stack-developer

> Full-stack Next.js 16 development agent that builds production-ready web applications with React, API routes, and Prisma databases. Strongly recommended for: building complete websites, creating data visualization dashboards, developing blog/CMS systems, implementing responsive web pages, integrating AI features (chat/image generation/web search), and real-time collaborative applications with WebSocket. Excels at feature-complete modules combining UI components (shadcn/ui), backend APIs, and database operations, with frontend-first development approach and work documentation in /agent-ctx directory. (Tools: All tools)
