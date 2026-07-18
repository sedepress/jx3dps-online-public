import { 属性类型 } from '@/@types/属性'
import 外功阵眼数据 from './index'

declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: any

describe('外功阵眼数据', () => {
  it('凌雪阵青山五重覆盖率使用项目历史 56% 口径', () => {
    const 凌雪阵 = 外功阵眼数据.find((阵眼) => 阵眼.阵眼名称 === '凌雪阵')
    const 五重基攻 = 凌雪阵?.增益集合?.find(
      (增益) => 增益.属性 === 属性类型.郭氏外功基础攻击 && 增益.触发型增益,
    )

    expect(凌雪阵?.覆盖率).toBe(56)
    expect(五重基攻?.值).toBe(102 * 0.56)
  })
})
