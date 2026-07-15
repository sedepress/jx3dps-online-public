import { 创建问水搜索客户端核心 } from './client-core'

export const 创建问水搜索客户端 = () =>
  创建问水搜索客户端核心(() => new Worker(new URL('./worker.ts', import.meta.url)))
