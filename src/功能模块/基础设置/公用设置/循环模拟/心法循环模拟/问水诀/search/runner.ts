import {
  创建问水Beam会话,
  获取问水Beam会话结果,
  搜索问水Beam策略参数,
  推进问水Beam会话,
} from './beam-search'
import { 问水搜索候选 } from './exhaustive-oracle'

export type 问水Runner结束原因 = '确定性预算' | '空间收敛' | '用户取消' | '紧急上限'

export interface 问水Runner进度 {
  扩展节点数: number
  扩展预算: number
  当前最佳伤害: number
}

export interface 运行问水分块搜索参数 {
  搜索参数: 搜索问水Beam策略参数
  每块扩展数: number
  紧急上限毫秒: number
  获取当前时间?: () => number
  让出事件循环?: () => Promise<void>
  是否取消?: () => boolean
  报告进度?: (progress: 问水Runner进度) => void
}

export type 问水Runner结果 =
  | {
      成功: true
      最佳候选: 问水搜索候选
      扩展节点数: number
      结束原因: 问水Runner结束原因
      是否提前结束: boolean
      workerElapsedMs: number
      基线失败原因?: string
    }
  | { 成功: false; 失败原因: string }

const 默认让出事件循环 = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const 校验Runner参数 = (chunkSize: number, emergencyMs: number) => {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) return '每块扩展数必须为正整数'
  if (!Number.isFinite(emergencyMs) || emergencyMs <= 0) return '紧急上限毫秒必须为正有限数'
  return undefined
}

const 创建Runner结果 = (
  session: Parameters<typeof 获取问水Beam会话结果>[0],
  reason: 问水Runner结束原因,
  elapsedMs: number,
): 问水Runner结果 => {
  const result = 获取问水Beam会话结果(session)
  return {
    成功: true,
    最佳候选: result.最佳候选,
    扩展节点数: result.扩展节点数,
    结束原因: reason,
    是否提前结束: reason === '用户取消' || reason === '紧急上限',
    workerElapsedMs: elapsedMs,
    ...(result.基线失败原因 ? { 基线失败原因: result.基线失败原因 } : {}),
  }
}

export const 运行问水分块搜索 = async ({
  搜索参数,
  每块扩展数,
  紧急上限毫秒,
  获取当前时间 = Date.now,
  让出事件循环 = 默认让出事件循环,
  是否取消 = () => false,
  报告进度,
}: 运行问水分块搜索参数): Promise<问水Runner结果> => {
  const validationError = 校验Runner参数(每块扩展数, 紧急上限毫秒)
  if (validationError) return { 成功: false, 失败原因: validationError }
  const startedAt = 获取当前时间()
  const created = 创建问水Beam会话(搜索参数)
  if (!created.成功) return created
  let session = created.会话
  while (true) {
    if (是否取消()) return 创建Runner结果(session, '用户取消', 获取当前时间() - startedAt)
    const advanced = 推进问水Beam会话(session, 每块扩展数)
    if (!advanced.成功) return advanced
    session = advanced.会话
    const state = 获取问水Beam会话结果(session)
    报告进度?.({
      扩展节点数: state.扩展节点数,
      扩展预算: 搜索参数.扩展预算,
      当前最佳伤害: state.最佳候选.期望总伤,
    })
    const elapsed = 获取当前时间() - startedAt
    if (state.结束原因 === '空间收敛') return 创建Runner结果(session, '空间收敛', elapsed)
    if (state.结束原因 === '扩展预算') return 创建Runner结果(session, '确定性预算', elapsed)
    if (是否取消()) return 创建Runner结果(session, '用户取消', elapsed)
    if (elapsed >= 紧急上限毫秒) return 创建Runner结果(session, '紧急上限', elapsed)
    await 让出事件循环()
  }
}
