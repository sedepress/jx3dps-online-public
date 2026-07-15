import { 问水聚合项 } from './aggregate-policy'
import {
  构建问水伤害表,
  标准化问水伤害计算上下文,
  问水伤害表项,
  问水伤害计算上下文,
} from './build-damage-table'

export interface 问水伤害快照DTO {
  版本: 1
  战斗时间: number
  秒伤计算时间: number
  是否郭氏计算: boolean
  伤害计算口径?: 'Excel小数破防防御'
  伤害表: 问水伤害表项[]
}

interface 创建问水伤害快照参数 {
  项目: 问水聚合项[]
  计算上下文: 问水伤害计算上下文
  解析增益签名: (item: 问水聚合项) => string[] | undefined
}

type 创建问水伤害快照结果 =
  | { 成功: true; 快照: 问水伤害快照DTO }
  | { 成功: false; 失败原因: string }

export const 创建问水增益签名解析器 = (context: 问水伤害计算上下文) => {
  const normalized = 标准化问水伤害计算上下文(context)
  return (item: 问水聚合项) => {
    const skill = normalized.技能数据映射.get(item.技能名称)
    if (!skill) return undefined
    const available = new Set((skill.技能增益列表 || []).map((gain) => gain.增益名称))
    const signatures = Array.from(new Set(item.增益签名.concat(item.快照签名))).sort()
    return signatures.every((signature) => available.has(signature)) ? signatures : undefined
  }
}

export const 创建问水伤害快照 = ({
  项目,
  计算上下文,
  解析增益签名,
}: 创建问水伤害快照参数): 创建问水伤害快照结果 => {
  const table = 构建问水伤害表({ 项目, 计算上下文, 解析增益签名 })
  if (!table.成功) return table
  return {
    成功: true,
    快照: {
      版本: 1,
      战斗时间: 计算上下文.战斗时间,
      秒伤计算时间: 计算上下文.计算循环详情?.秒伤计算时间 || 计算上下文.战斗时间,
      是否郭氏计算: 计算上下文.是否郭氏计算,
      ...(计算上下文.计算循环详情?.伤害计算口径
        ? { 伤害计算口径: 计算上下文.计算循环详情.伤害计算口径 }
        : {}),
      伤害表: table.表项,
    },
  }
}
