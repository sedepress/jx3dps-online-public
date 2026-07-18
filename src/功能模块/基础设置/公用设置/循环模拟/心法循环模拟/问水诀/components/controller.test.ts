import { describe, expect, it } from '@jest/globals'
import { 问水聚合项 } from '../damage/aggregate-policy'
import { 创建问水优化搜索任务 } from './controller'

describe('问水诀搜索任务控制器', () => {
  it('伤害表覆盖模拟器派生技能和叠锋意签名', () => {
    const items: 问水聚合项[] = []

    创建问水优化搜索任务({
      战斗时间: 1,
      加速值: 0,
      网络延迟: 0,
      奇穴: ['叠锋意', '雾锁', '怜光', '造化'],
      秘籍: {},
      团队增益轴: {},
      武器类型: '紫武',
      配置指纹: 'controller-damage-table',
      计算单次伤害: (item) => {
        items.push(item)
        return { 伤害: 100, 会心率: 0.5 }
      },
    })

    const names = items.map((item) => item.技能名称)
    expect(names).toEqual(
      expect.arrayContaining(['新破招(夕)', '新破招(云)', '云景·云飞玉皇', '四季剑法']),
    )

    const hasSignature = (skill: string, signatures: string[]) =>
      items.some(
        (item) =>
          item.技能名称 === skill &&
          signatures.every((signature) => item.增益签名.includes(signature)),
      )

    expect(hasSignature('新破招(夕)', ['怜光', '叠锋意·1'])).toBe(true)
    expect(hasSignature('新破招(云)', ['怜光', '叠锋意·2'])).toBe(true)
    expect(hasSignature('云景·云飞玉皇', ['怜光', '造化2', '叠锋意·3'])).toBe(true)
    expect(hasSignature('四季剑法', ['怜光', '叠锋意·3'])).toBe(true)
  })
})
