import { Worker出站消息, Worker启动参数 } from './protocol'

interface 问水搜索客户端回调 {
  进度?: (message: Extract<Worker出站消息, { 类型: '进度' }>) => void
  完成?: (result: Extract<Worker出站消息, { 类型: '完成' }>['结果']) => void
  错误?: (error: Error) => void
}

type Worker工厂 = () => Worker

interface 客户端状态 {
  worker?: Worker
  currentTaskId?: string
  callbacks?: 问水搜索客户端回调
  sequence: number
  createWorker: Worker工厂
}

const 清理当前任务 = (state: 客户端状态) => {
  state.currentTaskId = undefined
  state.callbacks = undefined
}

const 废弃Worker = (state: 客户端状态) => {
  const worker = state.worker
  state.worker = undefined
  worker?.terminate()
}

const 标准化错误 = (error: unknown) => (error instanceof Error ? error : new Error(String(error)))

const 处理Worker消息 = (state: 客户端状态, message: Worker出站消息) => {
  if (!state.currentTaskId || message.任务ID !== state.currentTaskId) return
  if (message.类型 === '进度') state.callbacks?.进度?.(message)
  if (message.类型 === '完成') {
    const complete = state.callbacks?.完成
    清理当前任务(state)
    complete?.(message.结果)
  }
  if (message.类型 === '错误') {
    const handleError = state.callbacks?.错误
    清理当前任务(state)
    handleError?.(new Error(message.错误信息))
  }
}

const 获取Worker = (state: 客户端状态) => {
  if (state.worker) return state.worker
  state.worker = state.createWorker()
  state.worker.onmessage = (event: MessageEvent<Worker出站消息>) =>
    处理Worker消息(state, event.data)
  state.worker.onerror = (event) => {
    const handleError = state.callbacks?.错误
    清理当前任务(state)
    废弃Worker(state)
    handleError?.(new Error(event.message || 'Worker 运行失败'))
  }
  return state.worker
}

const 请求取消任务 = (state: 客户端状态, taskId = state.currentTaskId, abandon = false) => {
  if (!taskId || taskId !== state.currentTaskId) return
  try {
    state.worker?.postMessage({ 类型: '取消', 任务ID: taskId })
    if (abandon) 清理当前任务(state)
  } catch (error) {
    const handleError = state.callbacks?.错误
    清理当前任务(state)
    废弃Worker(state)
    if (!abandon) handleError?.(标准化错误(error))
  }
}

export const 创建问水搜索客户端核心 = (createWorker: Worker工厂) => {
  const state: 客户端状态 = { sequence: 0, createWorker }

  const 开始 = (params: Worker启动参数, nextCallbacks: 问水搜索客户端回调 = {}) => {
    if (state.currentTaskId) 请求取消任务(state, state.currentTaskId, true)
    const taskId = `wenshui-${(state.sequence += 1)}`
    state.currentTaskId = taskId
    state.callbacks = nextCallbacks
    try {
      获取Worker(state).postMessage({ 类型: '开始', 任务ID: taskId, 参数: params })
    } catch (error) {
      清理当前任务(state)
      废弃Worker(state)
      throw error
    }
    return taskId
  }

  const 销毁 = () => {
    if (state.currentTaskId) 请求取消任务(state, state.currentTaskId, true)
    清理当前任务(state)
    废弃Worker(state)
  }

  return {
    开始,
    取消: (taskId?: string) => 请求取消任务(state, taskId),
    销毁,
    当前任务ID: () => state.currentTaskId,
  }
}
