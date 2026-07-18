import 技能系数 from './技能系数'

declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: any

describe('玉山揽云技改', () => {
  it('只将技能伤害系数提高 50%', () => {
    const 玉山揽云 = 技能系数.find((技能) => 技能.技能名称 === '玉山揽云')

    expect(玉山揽云?.技能伤害系数).toBe(540)
    expect(玉山揽云?.基础伤害_基础值).toBe(317.5)
    expect(玉山揽云?.武器伤害系数).toBe(1)
  })
})
