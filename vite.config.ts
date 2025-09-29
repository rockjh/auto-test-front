import {resolve} from 'path'
import type {ConfigEnv, UserConfig} from 'vite'
import {loadEnv} from 'vite'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const jitiModule: any = require('jiti')
if (jitiModule && typeof jitiModule.createJiti !== 'function') {
  jitiModule.createJiti = (...args: any[]) => (jitiModule as any)(...args)
}
const unconfigEntry = require.resolve('unconfig')
const unconfigRequire = createRequire(unconfigEntry)
const unconfigJiti: any = unconfigRequire('jiti')
if (unconfigJiti && typeof unconfigJiti.createJiti !== 'function') {
  unconfigJiti.createJiti = (...args: any[]) => (unconfigJiti as any)(...args)
}


// 当前执行node命令时文件夹的地址(工作目录)
const root = process.cwd()

// 路径查找
function pathResolve(dir: string) {
    return resolve(root, '.', dir)
}

// https://vitejs.dev/config/
export default async ({command, mode}: ConfigEnv): Promise<UserConfig> => {
    let env = {} as any
    const isBuild = command === 'build'
    if (!isBuild) {
        env = loadEnv((process.argv[3] === '--mode' ? process.argv[4] : process.argv[3]), root)
    } else {
        env = loadEnv(mode, root)
    }
    const { createVitePlugins } = await import('./build/vite')
    const { exclude, include } = await import('./build/vite/optimize')
    const envPort = Number(env.VITE_PORT)
    const serverPort = envPort >= 1024 ? envPort : 5173
    return {
        base: env.VITE_BASE_PATH,
        root: root,
        // 服务端渲染
        server: {
            port: serverPort, // 端口号
            host: "0.0.0.0",
            open: env.VITE_OPEN === 'true',
            // 本地跨域代理. 目前注释的原因：暂时没有用途，server 端已经支持跨域
            // proxy: {
            //   ['/admin-api']: {
            //     target: env.VITE_BASE_URL,
            //     ws: false,
            //     changeOrigin: true,
            //     rewrite: (path) => path.replace(new RegExp(`^/admin-api`), ''),
            //   },
            // },
        },
        // 项目使用的vite插件。 单独提取到build/vite/plugin中管理
        plugins: createVitePlugins({ isBuild }),
        css: {
            preprocessorOptions: {
                scss: {
                    additionalData: '@use "@/styles/variables.scss" as *;',
                    javascriptEnabled: true,
                    silenceDeprecations: ["legacy-js-api"], // 参考自 https://stackoverflow.com/questions/78997907/the-legacy-js-api-is-deprecated-and-will-be-removed-in-dart-sass-2-0-0
                }
            }
        },
        resolve: {
            extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss', '.css'],
            alias: [
                {
                    find: 'vue-i18n',
                    replacement: 'vue-i18n/dist/vue-i18n.cjs.js'
                },
                {
                    find: /\@\//,
                    replacement: `${pathResolve('src')}/`
                }
            ]
        },
        build: {
            minify: 'terser',
            outDir: env.VITE_OUT_DIR || 'dist',
            sourcemap: env.VITE_SOURCEMAP === 'true' ? 'inline' : false,
            // brotliSize: false,
            terserOptions: {
                compress: {
                    drop_debugger: env.VITE_DROP_DEBUGGER === 'true',
                    drop_console: env.VITE_DROP_CONSOLE === 'true'
                }
            },
            rollupOptions: {
                output: {
                    manualChunks: {
                      echarts: ['echarts'], // 将 echarts 单独打包，参考 https://gitee.com/yudaocode/yudao-ui-admin-vue3/issues/IAB1SX 讨论
                      'form-create': ['@form-create/element-ui'], // 参考 https://github.com/yudaocode/yudao-ui-admin-vue3/issues/148 讨论
                      'form-designer': ['@form-create/designer'],
                    }
                },
            },
        },
        optimizeDeps: {include, exclude}
    }
}
