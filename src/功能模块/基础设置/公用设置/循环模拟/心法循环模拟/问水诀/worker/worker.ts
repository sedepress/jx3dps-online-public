/// <reference lib="webworker" />

import { 运行问水分块搜索 } from '../search/runner'
import { Worker入站消息, Worker出站消息 } from './protocol'

const scope = self as DedicatedWorkerGlobalScope
const cancelled = new Set<string>()

const post = (message: Worker出站消息) => scope.postMessage(message)

const 运行任务 = async (message: Extract<Worker入站消息, { 类型: '开始' }>) => {
  const { 任务ID, 参数 } = message
  cancelled.delete(任务ID)
  try {
    const result = await 运行问水分块搜索({
      ...参数,
      是否取消: () => cancelled.has(任务ID),
      报告进度: (progress) => post({ 类型: '进度', 任务ID, ...progress }),
    })
    post({ 类型: '完成', 任务ID, 结果: result })
  } catch (error) {
    post({ 类型: '错误', 任务ID, 错误信息: error instanceof Error ? error.message : String(error) })
  } finally {
    cancelled.delete(任务ID)
  }
}

scope.onmessage = (event: MessageEvent<Worker入站消息>) => {
  const message = event.data
  if (message.类型 === '取消') {
    cancelled.add(message.任务ID)
    return
  }
  void 运行任务(message)
}

export {}
