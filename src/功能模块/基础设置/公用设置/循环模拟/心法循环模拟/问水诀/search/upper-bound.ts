import { 问水模拟状态 } from '../types'

interface 计算问水乐观上界参数 {
  状态: 问水模拟状态
  已累积伤害: number
  最大理论每帧伤害: number
}

const 校验伤害值 = (name: string, value: number) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name}必须为非负有限数`)
}

export const 计算问水乐观上界 = ({ 状态, 已累积伤害, 最大理论每帧伤害 }: 计算问水乐观上界参数) => {
  校验伤害值('已累积伤害', 已累积伤害)
  校验伤害值('最大理论每帧伤害', 最大理论每帧伤害)
  const 剩余帧数 = Math.max(0, 状态.结束帧 - 状态.当前帧 + 1)
  return 已累积伤害 + 剩余帧数 * 最大理论每帧伤害
}
