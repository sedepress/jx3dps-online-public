import { 循环技能详情 } from '@/@types/循环'
import { 问水搜索条件规则 } from '../search/exhaustive-oracle'

export type 问水候选来源 = '预设循环' | '搜索候选'

export interface 问水展示候选 {
  id: string
  来源: 问水候选来源
  技能序列: string[]
  条件规则: 问水搜索条件规则[]
  技能详情: 循环技能详情[]
}

export interface 问水正式展示候选 extends 问水展示候选 {
  DPS: number
}

interface 精确重排问水展示候选参数 {
  预设?: 问水展示候选
  候选: 问水展示候选[]
  计算DPS: (candidate: 问水展示候选) => number | undefined
}

type 问水展示候选重排结果 =
  | { 成功: true; 候选: 问水正式展示候选[] }
  | { 成功: false; 失败原因: string }

const 复算候选 = (
  candidate: 问水展示候选,
  calculator: 精确重排问水展示候选参数['计算DPS'],
) => {
  const dps = calculator(candidate)
  if (!Number.isFinite(dps) || (dps as number) < 0) return undefined
  return { ...candidate, DPS: dps as number }
}

export const 精确重排问水展示候选 = ({
  预设,
  候选,
  计算DPS,
}: 精确重排问水展示候选参数): 问水展示候选重排结果 => {
  const preset = 预设 ? 复算候选(预设, 计算DPS) : undefined
  if (预设 && !preset) return { 成功: false, 失败原因: '预设循环正式复算失败' }
  const search = 候选
    .map((candidate) => 复算候选(candidate, 计算DPS))
    .filter((candidate): candidate is 问水正式展示候选 => !!candidate)
  const ranked = (preset ? [preset, ...search] : search).sort(
    (left, right) => right.DPS - left.DPS || left.id.localeCompare(right.id),
  )
  if (!ranked.length) return { 成功: false, 失败原因: '没有可用的正式复算候选' }
  return { 成功: true, 候选: ranked }
}
