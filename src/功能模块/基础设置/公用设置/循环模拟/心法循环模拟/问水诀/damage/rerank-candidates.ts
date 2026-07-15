import { 计算结果技能列表类型 } from '@/@types/输出'
import { 循环技能详情 } from '@/@types/循环'
import { INT } from '@/工具函数/help'
import {
  使用问水上下文复算循环,
  标准化问水伤害计算上下文,
  问水伤害计算上下文,
} from './build-damage-table'

export interface 问水待复算候选 {
  id: string
  近似期望伤害: number
  技能详情: 循环技能详情[]
}

export interface 问水精确候选 extends 问水待复算候选 {
  精确总伤: number
  精确DPS: number
  计算结果技能列表: 计算结果技能列表类型[]
}

interface 精确重排问水候选参数 {
  候选: 问水待复算候选[]
  计算上下文: 问水伤害计算上下文
  最大复算数: number
}

type 问水候选重排结果 = { 成功: true; 候选: 问水精确候选[] } | { 成功: false; 失败原因: string }

type 单候选复算结果 = { 成功: true; 候选: 问水精确候选 } | { 成功: false; 失败原因: string }

const 获取秒伤计算时间 = (context: 问水伤害计算上下文) =>
  context.计算循环详情?.秒伤计算时间 || context.战斗时间

const 计算精确DPS = (context: 问水伤害计算上下文, totalDamage: number) => {
  const duration = 获取秒伤计算时间(context)
  const rawDps = totalDamage / duration
  return context.是否郭氏计算 && context.计算循环详情?.伤害计算口径 !== 'Excel小数破防防御'
    ? INT(rawDps)
    : rawDps
}

const 校验候选技能 = (candidate: 问水待复算候选, context: 问水伤害计算上下文) => {
  if (!candidate.技能详情.length) return `${candidate.id}: 技能详情不能为空`
  const normalized = 标准化问水伤害计算上下文(context)
  for (const skill of candidate.技能详情) {
    if (!normalized.技能数据映射.has(skill.技能名称)) {
      return `${candidate.id}: 缺少技能系数 ${skill.技能名称}`
    }
    if (!Number.isFinite(skill.技能数量) || skill.技能数量 <= 0) {
      return `${candidate.id}: ${skill.技能名称} 技能数量必须为正有限数`
    }
  }
  return undefined
}

const 复算单个候选 = (candidate: 问水待复算候选, context: 问水伤害计算上下文): 单候选复算结果 => {
  const validationError = 校验候选技能(candidate, context)
  if (validationError) return { 成功: false, 失败原因: validationError }
  const result = 使用问水上下文复算循环(context, candidate.技能详情)
  const dps = 计算精确DPS(context, result.总伤)
  const hasAllSkills = candidate.技能详情.every((skill) =>
    result.计算结果技能列表.some((item) => item.技能名称 === skill.技能名称),
  )
  if (!hasAllSkills || !Number.isFinite(result.总伤) || !Number.isFinite(dps)) {
    return { 成功: false, 失败原因: `${candidate.id}: 精确复算返回非法结果` }
  }
  return {
    成功: true,
    候选: {
      ...candidate,
      精确总伤: result.总伤,
      精确DPS: dps,
      计算结果技能列表: result.计算结果技能列表,
    },
  }
}

export const 精确重排问水候选 = ({
  候选,
  计算上下文,
  最大复算数,
}: 精确重排问水候选参数): 问水候选重排结果 => {
  const duration = 获取秒伤计算时间(计算上下文)
  if (!Number.isFinite(duration) || duration <= 0) {
    return { 成功: false, 失败原因: '秒伤计算时间必须为正有限数' }
  }
  if (!Number.isInteger(最大复算数) || 最大复算数 < 1) {
    return { 成功: false, 失败原因: '最大复算数必须为正整数' }
  }
  if (!候选.length) return { 成功: false, 失败原因: '候选列表不能为空' }
  const selected = 候选
    .slice()
    .sort((left, right) => right.近似期望伤害 - left.近似期望伤害)
    .slice(0, 最大复算数)
  const reranked: 问水精确候选[] = []
  for (const candidate of selected) {
    const result = 复算单个候选(candidate, 计算上下文)
    if (!result.成功) return result
    reranked.push(result.候选)
  }
  reranked.sort((left, right) => right.精确DPS - left.精确DPS || left.id.localeCompare(right.id))
  return { 成功: true, 候选: reranked }
}
