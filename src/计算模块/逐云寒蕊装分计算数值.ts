/**
 * @name 获取逐云寒蕊装分计算数值
 * @description 根据装分计算逐云寒蕊装的实际真实伤害
 * @param 技能等级
 * @param 最终计算属性
 * @returns number
 */

import { 最终计算属性类型 } from '@/@types/计算'
import { INT } from '@/工具函数/help'

export const 获取逐云寒蕊真实伤害 = (技能等级: number, 最终计算属性: 最终计算属性类型): number => {
  // 体服飘黄装分判定是写死的
  const 装分 = 最终计算属性?.最终人物属性?.装分 || 0
  const 基础伤害 = INT(0.0080170644 * 装分 - 1388.323959)

  const 最终基础伤害 = Math.max(1300, 基础伤害)
  const 最终计算层数 = Math.max(技能等级, 1)

  return 最终基础伤害 * 最终计算层数 * 1.25 * 1.3 * 1.15 * 0.5
}
