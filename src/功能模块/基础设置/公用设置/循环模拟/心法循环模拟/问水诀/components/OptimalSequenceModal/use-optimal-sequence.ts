import { useEffect, useRef, useState } from 'react'
import { 问水Runner结果 } from '../../search/runner'
import { 问水优化展示结果 } from '../SearchResult'
import type { OptimalSequenceModalProps, 问水搜索客户端, 问水搜索任务 } from '.'

const 初始进度 = { 扩展节点数: 0, 扩展预算: 0, 当前最佳伤害: 0 }

export const 校验问水战斗时间 = (value: number | null) =>
  value !== null && Number.isInteger(value) && value >= 1 && value <= 600

const 获取Worker参数 = ({ 战斗时间: _战斗时间, 配置指纹: _配置指纹, ...params }: 问水搜索任务) =>
  params

const use搜索状态 = (初始战斗时间: number) => {
  const [战斗时间, 设置战斗时间] = useState<number | null>(初始战斗时间)
  const [运行中, 设置运行中] = useState(false)
  const [进度, 设置进度] = useState(初始进度)
  const [结果, 设置结果] = useState<问水优化展示结果>()
  const [错误, 设置错误] = useState<string>()
  const [已用毫秒, 设置已用毫秒] = useState(0)
  const clientRef = useRef<问水搜索客户端>()
  const taskRef = useRef<{ id: string; data: 问水搜索任务; startedAt: number }>()
  useEffect(() => {
    if (!运行中) return undefined
    const timer = window.setInterval(() => {
      if (taskRef.current) 设置已用毫秒(Date.now() - taskRef.current.startedAt)
    }, 250)
    return () => window.clearInterval(timer)
  }, [运行中])
  return {
    战斗时间,
    设置战斗时间,
    运行中,
    设置运行中,
    进度,
    设置进度,
    结果,
    设置结果,
    错误,
    设置错误,
    已用毫秒,
    设置已用毫秒,
    clientRef,
    taskRef,
  }
}

type 搜索状态 = ReturnType<typeof use搜索状态>

const 获取客户端 = (props: OptimalSequenceModalProps, state: 搜索状态) => {
  if (!state.clientRef.current) state.clientRef.current = props.创建客户端()
  return state.clientRef.current
}

const 完成搜索 = (
  props: OptimalSequenceModalProps,
  state: 搜索状态,
  workerResult: 问水Runner结果,
) => {
  const task = state.taskRef.current?.data
  state.设置运行中(false)
  if (!task || !workerResult.成功) {
    state.设置错误(workerResult.成功 ? '搜索任务已失效' : workerResult.失败原因)
    return
  }
  try {
    state.设置结果(props.转换结果(workerResult, task))
    state.设置已用毫秒(workerResult.workerElapsedMs)
  } catch (error) {
    state.设置错误(error instanceof Error ? error.message : String(error))
  }
}

const 开始搜索 = (props: OptimalSequenceModalProps, state: 搜索状态) => {
  if (!校验问水战斗时间(state.战斗时间)) {
    state.设置错误('战斗时长必须是 1-600 的整数秒')
    return
  }
  try {
    const task = props.创建任务(state.战斗时间 as number)
    state.设置错误(undefined)
    state.设置结果(undefined)
    state.设置进度({ ...初始进度, 扩展预算: task.搜索参数.扩展预算 })
    state.设置已用毫秒(0)
    state.设置运行中(true)
    const id = 获取客户端(props, state).开始(获取Worker参数(task), {
      进度: (message) => state.设置进度(message),
      完成: (result) => 完成搜索(props, state, result),
      错误: (error) => {
        state.设置运行中(false)
        state.设置错误(error.message)
      },
    })
    state.taskRef.current = { id, data: task, startedAt: Date.now() }
  } catch (error) {
    state.设置运行中(false)
    state.设置错误(error instanceof Error ? error.message : String(error))
  }
}

export const use问水最优序列 = (props: OptimalSequenceModalProps) => {
  const state = use搜索状态(props.初始战斗时间)
  useEffect(() => () => state.clientRef.current?.销毁(), [])
  const 配置已过期 =
    !!state.结果 &&
    (state.结果.配置指纹 !== props.获取当前配置指纹() || state.结果.战斗时间 !== state.战斗时间)
  return {
    ...state,
    配置已过期,
    开始搜索: () => 开始搜索(props, state),
    停止搜索: () => 获取客户端(props, state).取消(state.taskRef.current?.id),
    关闭弹窗: () => {
      if (state.运行中) 获取客户端(props, state).取消(state.taskRef.current?.id)
      props.onClose()
    },
    应用当前结果: () => {
      if (!state.结果 || 配置已过期) return
      props.应用结果(state.结果)
      props.onClose()
    },
  }
}
