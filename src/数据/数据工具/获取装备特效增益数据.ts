import { 装备增益数据类型 } from '@/@types/装备'

const 获取装备特效增益数据 = (
  增益名称: string,
  特效等级: number | number[],
  装备增益数据: 装备增益数据类型,
  覆盖率 = 1,
) => {
  if (装备增益数据?.[增益名称]) {
    return 装备增益数据?.[增益名称]?.map((增益) => {
      const 增益基础值 = 获取增益基础值(增益?.值, 特效等级, !!增益?.可叠加)
      return {
        属性: 增益?.属性,
        值: 增益基础值 * 覆盖率,
      }
    })
  } else {
    return []
  }
}

const 获取增益基础值 = (增益值列表: number[], 特效等级: number | number[], 可叠加: boolean) => {
  if (Array.isArray(特效等级)) {
    return 特效等级.reduce((总值, 当前等级) => 总值 + 获取单档增益值(增益值列表, 当前等级), 0)
  }

  const 实际等级 = 特效等级 || 1
  const 叠加层数 = 可叠加 ? 实际等级 : 1
  return 获取单档增益值(增益值列表, 实际等级) * 叠加层数
}

const 获取单档增益值 = (增益值列表: number[], 特效等级: number) => {
  const 安全等级 = Math.max(特效等级 || 1, 1)
  return 增益值列表?.[安全等级 - 1] || 增益值列表?.[0] || 0
}

export default 获取装备特效增益数据
