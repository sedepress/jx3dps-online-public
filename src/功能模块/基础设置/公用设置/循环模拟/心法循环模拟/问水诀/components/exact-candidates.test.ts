import { describe, expect, it } from '@jest/globals'
import { 循环技能详情 } from '@/@types/循环'
import { 获取问水候选展示序列, 精确重排问水展示候选 } from './exact-candidates'

const 技能 = (技能名称: string): 循环技能详情 => ({ 技能名称, 技能数量: 1 })

describe('问水正式候选重排', () => {
  it('预设循环始终参与并按正式 DPS 排序', () => {
    const result = 精确重排问水展示候选({
      预设: {
        id: 'preset',
        来源: '预设循环',
        技能序列: ['听雷-轻'],
        条件规则: [],
        技能详情: [技能('听雷-轻')],
      },
      候选: [
        {
          id: 'search',
          来源: '搜索候选',
          技能序列: ['黄龙吐翠'],
          条件规则: [],
          技能详情: [技能('黄龙吐翠')],
        },
      ],
      计算DPS: (candidate) => (candidate.id === 'preset' ? 100 : 80),
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.候选[0].id).toBe('preset')
    expect(result.候选[0].DPS).toBe(100)
  })

  it('正式复算失败的搜索候选会被丢弃', () => {
    const result = 精确重排问水展示候选({
      预设: {
        id: 'preset',
        来源: '预设循环',
        技能序列: ['听雷-轻'],
        条件规则: [],
        技能详情: [技能('听雷-轻')],
      },
      候选: [
        {
          id: 'bad',
          来源: '搜索候选',
          技能序列: ['未知'],
          条件规则: [],
          技能详情: [技能('未知')],
        },
      ],
      计算DPS: (candidate) => (candidate.id === 'bad' ? undefined : 100),
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.候选.map((item) => item.id)).toEqual(['preset'])
  })

  it('胜者序列缺失时依次使用基线和已知最佳合法序列', () => {
    const winner = {
      id: 'preset',
      来源: '预设循环' as const,
      技能序列: [],
      条件规则: [],
      技能详情: [技能('听雷-轻')],
    }

    expect(获取问水候选展示序列(winner, ['啸日'], ['莺鸣柳'])).toEqual(['啸日'])
    expect(获取问水候选展示序列(winner, undefined, ['莺鸣柳'])).toEqual(['莺鸣柳'])
    expect(() => 获取问水候选展示序列(winner, undefined, [])).toThrow(
      '最终候选缺少可展示的玩家按键序列',
    )
  })
})
