import { describe, expect, it } from '@jest/globals'
import { 获取Excel基线, 每秒郭氏帧 } from './constants'

describe('问水诀最优序列规则来源', () => {
  it('使用 16 帧制', () => {
    expect(每秒郭氏帧).toBe(16)
  })

  it('按来源顺序提供斩岳有序基线', () => {
    const 基线 = 获取Excel基线('紫武', '斩岳')

    expect(基线).toHaveLength(532)
    expect(基线.slice(0, 3)).toEqual([
      { 技能: '鹤归孤山', 权重: 2, 序号: 0, 来源列: 'AY', 来源行: 3 },
      { 技能: '云飞玉皇-峰插', 权重: 2, 序号: 1, 来源列: 'AY', 来源行: 4 },
      { 技能: '夕照雷峰', 权重: 2, 序号: 2, 来源列: 'AY', 来源行: 5 },
    ])
    expect(基线.at(-1)).toEqual({
      技能: '夕照雷峰',
      权重: 1,
      序号: 531,
      来源列: 'AY',
      来源行: 581,
    })
  })

  it('保留碧归基线的来源信息和连续序号', () => {
    const 基线 = 获取Excel基线('橙武', '碧归')

    expect(基线).toHaveLength(500)
    expect(基线.every((动作, index) => 动作.序号 === index)).toBe(true)
    expect(基线.at(-1)).toEqual({
      技能: '风来吴山',
      权重: 2,
      序号: 499,
      来源列: 'BI',
      来源行: 614,
    })
  })
})
