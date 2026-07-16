import { 问水伤害事件 } from '../types'

export interface 问水聚合项 {
  技能名称: string
  技能等级: number | null
  增益签名: string[]
  快照签名: string[]
  施放数量: number
  伤害次数: number
}

export type 问水压缩伤害 = Record<string, 问水聚合项>

export const 标准化问水签名 = (signature?: string[]) => Array.from(new Set(signature || [])).sort()

const 创建伤害键 = (data: {
  技能名称: string
  技能等级?: number | null
  增益签名?: string[]
  快照签名?: string[]
}) =>
  JSON.stringify({
    技能名称: data.技能名称,
    技能等级: data.技能等级 ?? null,
    增益签名: 标准化问水签名(data.增益签名),
    快照签名: 标准化问水签名(data.快照签名),
  })

export const 获取问水伤害键 = (event: 问水伤害事件) => 创建伤害键(event)

export const 获取问水聚合项键 = (item: 问水聚合项) => 创建伤害键(item)

export const 从问水伤害事件创建聚合项 = (event: 问水伤害事件): 问水聚合项 => ({
  技能名称: event.技能名称,
  技能等级: event.技能等级 ?? null,
  增益签名: 标准化问水签名(event.增益签名),
  快照签名: 标准化问水签名(event.快照签名),
  施放数量: 0,
  伤害次数: 0,
})
