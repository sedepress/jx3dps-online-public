import { describe, expect, it, jest } from '@jest/globals'
import { 获取问水聚合项键, 问水聚合项 } from '../damage/aggregate-policy'
import { 问水伤害表项 } from '../damage/build-damage-table'
import { 创建问水起手状态 } from '../simulator/create-state'
import { 搜索问水Beam策略 } from '../search/beam-search'
import { 问水搜索配置 } from '../search/exhaustive-oracle'
import { 运行问水分块搜索 } from '../search/runner'
import { 创建问水搜索客户端核心 } from './client-core'
import { Worker出站消息 } from './protocol'

describe('问水诀分块 Runner', () => {
  it('按固定 chunk 推进并在 chunk 之间让出事件循环', async () => {
    const progress: number[] = []
    const yieldControl = jest.fn(async () => undefined)
    const searchParams = { ...创建搜索配置(), Beam宽度: 4, 扩展预算: 5 }
    const result = await 运行问水分块搜索({
      搜索参数: searchParams,
      每块扩展数: 2,
      紧急上限毫秒: 60_000,
      获取当前时间: () => 0,
      让出事件循环: yieldControl,
      是否取消: () => false,
      报告进度: (message) => progress.push(message.扩展节点数),
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.结束原因).toBe('确定性预算')
    expect(progress).toEqual([2, 4, 5])
    expect(yieldControl).toHaveBeenCalledTimes(2)
    const direct = 搜索问水Beam策略(searchParams)
    expect(direct.成功).toBe(true)
    if (!direct.成功) return
    expect(result.最佳候选.期望总伤).toBeCloseTo(direct.最佳候选.期望总伤)
    expect(result.最佳候选.主序列).toEqual(direct.最佳候选.主序列)
    expect(result.最佳候选.条件规则).toEqual(direct.最佳候选.条件规则)
  })

  it('区分用户取消和紧急墙钟上限', async () => {
    let yielded = false
    const cancelled = await 运行问水分块搜索({
      搜索参数: { ...创建搜索配置(), Beam宽度: 4, 扩展预算: 100 },
      每块扩展数: 1,
      紧急上限毫秒: 60_000,
      获取当前时间: () => 0,
      让出事件循环: async () => {
        yielded = true
      },
      是否取消: () => yielded,
    })
    const times = [0, 61_000]
    const timedOut = await 运行问水分块搜索({
      搜索参数: { ...创建搜索配置(), Beam宽度: 4, 扩展预算: 100 },
      每块扩展数: 1,
      紧急上限毫秒: 60_000,
      获取当前时间: () => {
        const value = times.shift()
        return value === undefined ? 61_000 : value
      },
      让出事件循环: async () => undefined,
      是否取消: () => false,
    })

    expect(cancelled).toMatchObject({ 成功: true, 结束原因: '用户取消', 是否提前结束: true })
    expect(timedOut).toMatchObject({ 成功: true, 结束原因: '紧急上限', 是否提前结束: true })
  })
})

describe('问水诀 Worker 客户端', () => {
  it('用任务 ID 忽略旧结果并转发当前进度和完成消息', () => {
    const worker = new MockWorker()
    const client = 创建问水搜索客户端核心(() => worker as unknown as Worker)
    const oldComplete = jest.fn()
    const progress = jest.fn()
    const complete = jest.fn()
    const first = client.开始(创建启动参数(), { 完成: oldComplete })
    const second = client.开始(创建启动参数(), { 进度: progress, 完成: complete })

    expect(worker.sent).toEqual([
      expect.objectContaining({ 类型: '开始', 任务ID: first }),
      { 类型: '取消', 任务ID: first },
      expect.objectContaining({ 类型: '开始', 任务ID: second }),
    ])
    worker.emit({ 类型: '完成', 任务ID: first, 结果: 创建完成结果() })
    worker.emit({ 类型: '进度', 任务ID: second, 扩展节点数: 2, 扩展预算: 10, 当前最佳伤害: 100 })
    worker.emit({ 类型: '完成', 任务ID: second, 结果: 创建完成结果() })

    expect(oldComplete).not.toHaveBeenCalled()
    expect(progress).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('显式取消保留用户取消结果并在 Worker 异常时清理', () => {
    const worker = new MockWorker()
    const client = 创建问水搜索客户端核心(() => worker as unknown as Worker)
    const complete = jest.fn()
    const error = jest.fn()
    const task = client.开始(创建启动参数(), { 完成: complete, 错误: error })

    client.取消(task)
    worker.emit({ 类型: '完成', 任务ID: task, 结果: { ...创建完成结果(), 结束原因: '用户取消' } })
    const next = client.开始(创建启动参数(), { 错误: error })
    worker.emitError('worker failed')

    expect(worker.sent).toContainEqual({ 类型: '取消', 任务ID: task })
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ 结束原因: '用户取消' }))
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'worker failed' }))
    expect(client.当前任务ID()).toBeUndefined()
    expect(next).not.toBe(task)
  })

  it('完成回调中启动的新任务不会被旧消息清理', () => {
    const worker = new MockWorker()
    const client = 创建问水搜索客户端核心(() => worker as unknown as Worker)
    const nextComplete = jest.fn()
    let nextTask = ''
    const first = client.开始(创建启动参数(), {
      完成: () => {
        nextTask = client.开始(创建启动参数(), { 完成: nextComplete })
      },
    })

    worker.emit({ 类型: '完成', 任务ID: first, 结果: 创建完成结果() })
    expect(client.当前任务ID()).toBe(nextTask)
    worker.emit({ 类型: '完成', 任务ID: nextTask, 结果: 创建完成结果() })
    expect(nextComplete).toHaveBeenCalledTimes(1)
  })

  it('postMessage 同步失败后清理任务并使用新 Worker 重试', () => {
    const failedWorker = new MockWorker()
    const nextWorker = new MockWorker()
    failedWorker.throwNext = new DOMException('无法克隆', 'DataCloneError')
    const workers = [failedWorker, nextWorker]
    const client = 创建问水搜索客户端核心(() => workers.shift() as unknown as Worker)

    expect(() => client.开始(创建启动参数())).toThrow('无法克隆')
    expect(client.当前任务ID()).toBeUndefined()
    expect(failedWorker.terminated).toBe(true)

    const task = client.开始(创建启动参数())
    expect(client.当前任务ID()).toBe(task)
    expect(nextWorker.sent).toContainEqual(expect.objectContaining({ 类型: '开始', 任务ID: task }))
  })
})

class MockWorker {
  sent: unknown[] = []
  throwNext?: Error
  terminated = false
  onmessage: ((event: MessageEvent<Worker出站消息>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage(message: unknown) {
    if (this.throwNext) {
      const error = this.throwNext
      this.throwNext = undefined
      throw error
    }
    this.sent.push(message)
  }
  terminate() {
    this.terminated = true
  }
  emit(message: Worker出站消息) {
    this.onmessage?.({ data: message } as MessageEvent<Worker出站消息>)
  }
  emitError(message: string) {
    this.onerror?.({ message } as ErrorEvent)
  }
}

const 创建搜索配置 = (): 问水搜索配置 => ({
  初始状态: 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 }),
  主技能: ['听雷-轻', '黄龙吐翠'],
  条件动作: [],
  伤害表: [
    创建伤害表项('听雷-轻', 100),
    创建伤害表项('黄龙吐翠', 125),
    创建伤害表项('三柴剑法', 30),
    创建伤害表项('新破招(夕)', 200),
    创建伤害表项('新破招(云)', 300),
    创建伤害表项('四季剑法', 40),
  ],
  最大理论每帧伤害: 125,
})

const 创建伤害表项 = (name: string, damage: number): 问水伤害表项 => {
  const item: 问水聚合项 = {
    技能名称: name,
    技能等级: null,
    增益签名: [],
    快照签名: [],
    施放数量: 1,
    伤害次数: 1,
  }
  return { ...item, key: 获取问水聚合项键(item), 单次施放伤害: damage }
}

const 创建启动参数 = () => ({
  搜索参数: { ...创建搜索配置(), Beam宽度: 4, 扩展预算: 10 },
  每块扩展数: 2,
  紧急上限毫秒: 60_000,
})

const 创建完成结果 = () => ({
  成功: true as const,
  最佳候选: { 主序列: [], 条件规则: [], 分支: [], 期望总伤: 0, 乐观上界: 0, 稳定序号: 0 },
  扩展节点数: 0,
  结束原因: '确定性预算' as const,
  是否提前结束: false,
  workerElapsedMs: 0,
})
