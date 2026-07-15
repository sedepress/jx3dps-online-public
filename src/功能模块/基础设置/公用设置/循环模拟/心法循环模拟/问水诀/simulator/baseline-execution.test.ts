import { describe, expect, it } from '@jest/globals'
import { 获取Excel基线 } from '../rules/constants'
import { 创建问水起手状态 } from './create-state'
import { 执行Excel基线 } from './baseline-execution'

describe('问水诀 Excel 基线执行', () => {
  it('伤害模板不能冒充玩家动作基线并返回首个非法 token', () => {
    const result = 执行Excel基线(
      创建问水起手状态({ 战斗秒数: 220, 加速值: 0, 网络延迟: 0 }),
      获取Excel基线('紫武', '斩岳'),
    )

    expect(result).toMatchObject({
      成功: false,
      执行数量: 0,
      失败原因: 'AY3 鹤归孤山: 姿态不满足技能要求',
    })
  })

  it('未知 token 返回结构化失败而不是抛出异常', () => {
    const result = 执行Excel基线(创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }), [
      { 技能: '未知技能', 权重: 1, 序号: 0, 来源列: 'AY', 来源行: 99 },
    ])

    expect(result).toMatchObject({
      成功: false,
      执行数量: 0,
      失败原因: 'AY99 未知技能: 未知 Excel 基线 token',
    })
  })
})
