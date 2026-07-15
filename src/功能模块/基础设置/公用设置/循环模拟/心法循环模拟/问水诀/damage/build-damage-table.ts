import { 技能总伤害计算入参类型 } from '@/@types/计算'
import { 计算结果技能列表类型 } from '@/@types/输出'
import { 循环技能详情 } from '@/@types/循环'
import 循环秒伤计算 from '@/计算模块/循环秒伤计算'
import { 获取问水聚合项键, 问水聚合项, 转换问水聚合项为循环 } from './aggregate-policy'

export type 问水伤害计算上下文 = Omit<技能总伤害计算入参类型, '计算循环'>

const 层云每层增伤 = [102, 204, 307, 410, 512]

export interface 问水伤害表项 {
  key: string
  技能名称: string
  技能等级: number | null
  增益签名: string[]
  快照签名: string[]
  单次施放伤害: number
}

interface 构建问水伤害表参数 {
  项目: 问水聚合项[]
  计算上下文: 问水伤害计算上下文
  解析增益签名: (item: 问水聚合项) => string[] | undefined
}

type 问水伤害表结果 = { 成功: true; 表项: 问水伤害表项[] } | { 成功: false; 失败原因: string }

interface 计算问水聚合期望伤害参数 {
  项目: 问水聚合项[]
  伤害表: 问水伤害表项[]
}

type 问水期望伤害结果 = { 成功: true; 期望总伤: number } | { 成功: false; 失败原因: string }

export const 标准化问水伤害计算上下文 = (context: 问水伤害计算上下文) => {
  const wind = context.技能数据映射.get('风来吴山')
  const cloud = wind?.技能增益列表?.find((gain) => gain.增益名称 === '层云')
  if (!wind || !cloud || wind.技能增益列表?.some((gain) => gain.增益名称 === '层云1')) {
    return context
  }
  const cloudGains = 层云每层增伤.map((value, index) => ({
    ...cloud,
    增益名称: `层云${index + 1}`,
    增益启用: true,
    增益类型: '部分启用' as const,
    增益集合: (cloud.增益集合 || []).map((gain) => ({ ...gain, 值: value / 1024 })),
  }))
  const skillMap = new Map(context.技能数据映射)
  skillMap.set('风来吴山', {
    ...wind,
    技能增益列表: (wind.技能增益列表 || [])
      .filter((gain) => gain.增益名称 !== '层云')
      .concat(cloudGains),
  })
  return { ...context, 技能数据映射: skillMap }
}

export const 使用问水上下文复算循环 = (context: 问水伤害计算上下文, skills: 循环技能详情[]) => {
  const normalized = 标准化问水伤害计算上下文(context)
  return 循环秒伤计算({
    ...normalized,
    计算循环: skills,
    计算循环详情: {
      ...(normalized.计算循环详情 || { 战斗时间: normalized.战斗时间 }),
      技能详情: skills,
    },
  })
}

const 获取单次施放项 = (item: 问水聚合项): 问水聚合项 => ({
  ...item,
  施放数量: 1,
  伤害次数: item.伤害次数 / item.施放数量,
})

const 查找主技能 = (技能列表: 计算结果技能列表类型[], item: 问水聚合项) =>
  技能列表.find((skill) => skill.技能名称 === item.技能名称)

const 构建单个表项 = (
  item: 问水聚合项,
  context: 问水伤害计算上下文,
  resolver: 构建问水伤害表参数['解析增益签名'],
): 问水伤害表结果 => {
  if (!context.技能数据映射.has(item.技能名称)) {
    return { 成功: false, 失败原因: `${item.技能名称}: 缺少技能系数` }
  }
  const loop = 转换问水聚合项为循环({ 项目: [获取单次施放项(item)], 解析增益签名: resolver })
  if (!loop.成功) return loop
  const result = 使用问水上下文复算循环(context, loop.技能详情)
  const mainSkill = 查找主技能(result.计算结果技能列表, item)
  if (!mainSkill || !Number.isFinite(mainSkill.技能总输出)) {
    return { 成功: false, 失败原因: `${item.技能名称}: 无法提取单次伤害` }
  }
  return {
    成功: true,
    表项: [
      {
        key: 获取问水聚合项键(item),
        技能名称: item.技能名称,
        技能等级: item.技能等级,
        增益签名: item.增益签名,
        快照签名: item.快照签名,
        单次施放伤害: mainSkill.技能总输出,
      },
    ],
  }
}

export const 构建问水伤害表 = ({
  项目,
  计算上下文,
  解析增益签名,
}: 构建问水伤害表参数): 问水伤害表结果 => {
  const uniqueItems = Array.from(
    new Map(项目.map((item) => [获取问水聚合项键(item), item])).values(),
  )
  const table: 问水伤害表项[] = []
  for (const item of uniqueItems) {
    const result = 构建单个表项(item, 计算上下文, 解析增益签名)
    if (!result.成功) return result
    table.push(result.表项[0])
  }
  return { 成功: true, 表项: table }
}

export const 计算问水聚合期望伤害 = ({
  项目,
  伤害表,
}: 计算问水聚合期望伤害参数): 问水期望伤害结果 => {
  const table = new Map(伤害表.map((item) => [item.key, item]))
  let totalDamage = 0
  for (const item of 项目) {
    const damage = table.get(获取问水聚合项键(item))
    if (!damage) {
      return { 成功: false, 失败原因: `${item.技能名称}: 伤害表缺少对应签名` }
    }
    totalDamage += item.施放数量 * damage.单次施放伤害
  }
  return { 成功: true, 期望总伤: totalDamage }
}
