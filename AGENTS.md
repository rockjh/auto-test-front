# 项目目录概览

## 根目录
- `build/`：集中维护 Vite 插件与构建优化脚本，涵盖 Vue、Element Plus、UnoCSS 以及 gzip 压缩设置。
- `doc/`：项目补充文档，例如 `API_REFERENCE.md`。
- `.image/`：按业务模块整理的产品截图与设计稿，用于文档与宣传素材。
- `public/`：构建时原样拷贝到产物中的静态资源（如 favicon、logo 等）。
- `src/`：Vue 3 + Element Plus 前端应用的全部源代码。
- `types/`：位于 `src` 之外的全局 TypeScript 声明文件（环境、路由、组件类型等）。
- `.idea/`、`.vscode/`：JetBrains 与 VS Code 的工作区配置。
- `.pnpm-store/`：pnpm 安装依赖时使用的本地缓存目录。
- 项目根部的配置文件（`uno.config.ts`、`vite.config.ts`、`tsconfig.json`、`postcss.config.js`、`stylelint.config.js`、`prettier.config.js`）：分别负责构建、样式、Lint 与格式化工具链配置。

## `src/` 子目录
- `api/`：按业务域拆分的后端接口封装（如 `system`、`pay`、`bpm` 等模块）。
- `assets/`：被 Vite 打包的静态资源（图片、SVG 精灵、地图、音频、AI 资源等）。
- `components/`：复用型 Vue 组件（通用组件、表单控件、表格封装等）。
- `config/`：前端配置项，例如 Axios 请求实例设置。
- `directives/`：自定义 Vue 指令（如基于权限的元素显示控制）。
- `hooks/`：组合式 API 的复用逻辑，按用途分为 `event`、`web` 等分组。
- `layout/`：整体布局外壳及头部、侧边栏等结构组件。
- `locales/`：`vue-i18n` 使用的国际化语言包。
- `plugins/`：第三方库的初始化封装（Element Plus、UnoCSS、ECharts、统计埋点等）。
- `router/`：Vue Router 配置、路由表与导航守卫。
- `store/`：Pinia 状态仓库（应用配置、权限、用户、字典以及业务模块状态）。
- `styles/`：全局样式与主题变量，含 SCSS、UnoCSS 相关文件。
- `types/`：与组件配套维护或自动生成的 TypeScript 声明。
- `utils/`：通用工具函数（鉴权、时间格式化、文件下载、加解密、树形结构等）。
- `views/`：按业务域划分的页面级 Vue 组件（登录、仪表盘、系统管理、工作流、CRM 等）。
- 根级入口文件（`main.ts`、`App.vue`、`permission.ts`）：应用初始化逻辑、全局守卫与根组件。

## 构建辅助
- `build/vite/index.ts`：集中创建开发/生产环境所需的全部 Vite 插件。
- `build/vite/optimize.ts`：指定手动依赖预构建策略，优化启动与打包速度。
- `build/vite/svg-icons-lite.ts`：自定义 SVG 图标加载器，配合 UnoCSS 与 Icon 体系使用。

## 文档与素材
- `doc/API_REFERENCE.md`：前端可参考的后台 API 列表与说明。
- `.image/demo`、`.image/common` 等：README 及文档中配套的可视化素材目录。

## Playwright MCP 服务
- 使用 `pnpm exec playwright install` 为当前机器拉取运行所需的浏览器内核后，可通过 `pnpm mcp:playwright` 启动 Playwright MCP server。
- MCP server 提供 `playwright_launch`、`playwright_goto`、`playwright_click`、`playwright_fill`、`playwright_wait_for_selector`、`playwright_screenshot` 与 `playwright_close` 七个工具，方便在对话里编排网页操作。
- 默认以 `chromium` + headless 模式启动；如需连同页面一并打开，可在 `playwright_launch` 里传 `baseUrl`。
- 截图工具在传入 `includeBase64: true` 时，会将图片数据作为返回内容供 MCP 客户端直接展示；如果提供 `path`，则也会写入本地文件。
