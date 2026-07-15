import { 问水模拟状态 } from '../types'
import { 获取问水技能定义, 问水技能定义 } from '../rules/skill-definitions'

export const 获取轻剑动作 = (state: 问水模拟状态): 问水技能定义[] => {
  if (state.姿态 !== '轻剑') {
    return [问水技能定义.啸日]
  }
  return Object.values(问水技能定义).filter(
    (技能) => 技能.姿态 === '轻剑' || (技能.名称 === '啸日' && 技能.姿态 === '任意'),
  )
}

export const 获取轻剑技能定义 = (技能名称: string) => {
  const 技能 = 获取问水技能定义(技能名称)
  return 技能 && (技能.姿态 === '轻剑' || 技能.姿态 === '任意') ? 技能 : undefined
}
