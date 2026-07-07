import { 属性类型 } from '@/@types/属性'
import 获取装备特效增益数据 from './获取装备特效增益数据'

declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: any

describe('获取装备特效增益数据', () => {
  it('可叠加副本精简按每件装备档位分别累加', () => {
    const 装备增益数据 = {
      特效_40803: [{ 值: [1412, 1650, 1928], 属性: 属性类型.全会心等级, 可叠加: true }],
    }

    const [增益] = 获取装备特效增益数据('特效_40803', [3, 2], 装备增益数据 as any)

    expect(增益.值).toBe(3578)
  })
})
