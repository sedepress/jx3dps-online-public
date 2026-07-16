import { 循环技能详情 } from '@/@types/循环'
import { 秒伤计算 } from '@/计算模块/计算函数'
import { 数据模块类型 } from '@/store/data'
import { 计算增益数据中加速值 } from '@/工具函数/data'
import 获取当前数据 from '@/数据/数据工具/获取当前数据'
import { 构建问水优化循环 } from '../apply/build-custom-cycle'
import { 应用问水优化循环 } from '../apply/apply-custom-cycle'
import { 聚合问水策略, 问水聚合项, 转换问水聚合项为循环 } from '../damage/aggregate-policy'
import { 问水Runner结果 } from '../search/runner'
import { 问水搜索任务 } from './OptimalSequenceModal'
import { 问水优化展示结果 } from './SearchResult'
import { 创建问水优化搜索任务, 创建问水配置指纹 } from './controller'

interface 问水主线程适配参数 {
  data: 数据模块类型
  dispatch: any
}

const 获取指纹数据 = (data: 数据模块类型) => ({
  心法: 获取当前数据()?.名称,
  装备信息: data.装备信息,
  当前奇穴信息: data.当前奇穴信息,
  当前秘籍信息: data.当前秘籍信息,
  增益启用: data.增益启用,
  增益数据: data.增益数据,
  团队增益轴: data.增益启用 ? data.团队增益轴 : {},
  网络延迟: data.网络延迟,
  当前输出计算目标名称: data.当前输出计算目标名称,
})

export const 获取当前问水配置指纹 = (data: 数据模块类型) => 创建问水配置指纹(获取指纹数据(data))

const 获取当前加速值 = (data: 数据模块类型) => {
  const 装备加速 = data.装备信息?.装备基础属性?.加速等级 || 0
  const 增益加速 = data.增益启用 ? 计算增益数据中加速值(data.增益数据) : 0
  return 装备加速 + 增益加速
}

const 创建循环技能 = (item: 问水聚合项): 循环技能详情 => ({
  技能名称: item.技能名称,
  技能数量: 1,
  ...(item.技能等级 === null ? {} : { 技能等级: item.技能等级 }),
  ...(item.伤害次数 === 1 ? {} : { 伤害层数: item.伤害次数 }),
  ...(item.增益签名.length || item.快照签名.length
    ? {
        技能增益列表: [
          {
            增益名称: Array.from(new Set(item.增益签名.concat(item.快照签名)))
              .sort()
              .join(','),
            增益技能数: 1,
          },
        ],
      }
    : {}),
})

const 执行问水DPS计算 = (
  params: 问水主线程适配参数 & { 战斗时间: number; 技能详情: 循环技能详情[] },
) =>
  params.dispatch(
    秒伤计算({
      更新循环技能列表: params.技能详情,
      更新计算时间: params.战斗时间,
      更新奇穴数据: params.data.当前奇穴信息,
      更新秘籍信息: params.data.当前秘籍信息,
      更新网络延迟: params.data.网络延迟,
      更新增益启用: params.data.增益启用,
      计算技能详情: true,
    }),
  )

const 创建单次伤害计算器 = (params: 问水主线程适配参数, 战斗时间: number) => (item: 问水聚合项) => {
  const result = 执行问水DPS计算({
    ...params,
    战斗时间,
    技能详情: [创建循环技能(item)],
  })
  const skill = result.计算结果技能列表.find((current) => current.技能名称 === item.技能名称)
  if (!skill) throw new Error(`${item.技能名称}: 精确计算缺少技能结果`)
  return { 伤害: skill.技能总输出, 会心率: skill.会心几率 || 0 }
}

export const 创建当前问水搜索任务 = (params: 问水主线程适配参数 & { 战斗时间: number }) => {
  if (!params.data.装备信息?.装备基础属性?.基础攻击) {
    throw new Error('缺少装备基础攻击，无法开始搜索')
  }
  return 创建问水优化搜索任务({
    战斗时间: params.战斗时间,
    加速值: 获取当前加速值(params.data),
    网络延迟: params.data.网络延迟,
    奇穴: params.data.当前奇穴信息,
    秘籍: params.data.当前秘籍信息,
    团队增益轴: params.data.增益启用 ? params.data.团队增益轴 : {},
    武器类型: params.data.装备信息?.装备增益?.大橙武特效 ? '橙武' : '紫武',
    配置指纹: 获取当前问水配置指纹(params.data),
    计算单次伤害: 创建单次伤害计算器(params, params.战斗时间),
  })
}

const 获取循环增益签名 = (item: 问水聚合项) =>
  Array.from(new Set(item.增益签名.concat(item.快照签名))).sort()

export const 转换当前问水搜索结果 = (
  result: 问水Runner结果,
  task: 问水搜索任务,
  params: 问水主线程适配参数,
): 问水优化展示结果 => {
  if (!result.成功) throw new Error(result.失败原因)
  const aggregated = 聚合问水策略({ 分支: result.最佳候选.分支 })
  if (!aggregated.成功) throw new Error(aggregated.失败原因)
  const cycle = 转换问水聚合项为循环({
    项目: aggregated.项目,
    解析增益签名: 获取循环增益签名,
  })
  if (!cycle.成功) throw new Error(cycle.失败原因)
  const exact = 执行问水DPS计算({ ...params, 战斗时间: task.战斗时间, 技能详情: cycle.技能详情 })
  return {
    战斗时间: task.战斗时间,
    配置指纹: task.配置指纹,
    技能序列: result.最佳候选.主序列,
    条件规则: result.最佳候选.条件规则,
    技能详情: cycle.技能详情,
    预期DPS: exact.秒伤,
    搜索耗时: result.workerElapsedMs,
    扩展节点数: result.扩展节点数,
    扩展预算: task.搜索参数.扩展预算,
    提前结束: result.是否提前结束,
    结束原因: result.结束原因,
  }
}

export const 应用当前问水搜索结果 = (result: 问水优化展示结果, params: 问水主线程适配参数) => {
  const cycle = 构建问水优化循环({
    战斗时间: result.战斗时间,
    奇穴: params.data.当前奇穴信息,
    秘籍: params.data.当前秘籍信息,
    技能序列: result.技能序列,
    条件规则: result.条件规则,
    技能详情: result.技能详情,
    加速值: 获取当前加速值(params.data),
    网络延迟: params.data.网络延迟,
    配置指纹: result.配置指纹,
    扩展预算: result.扩展预算,
    提前结束: result.提前结束,
    搜索耗时: result.搜索耗时,
    预期DPS: result.预期DPS,
  })
  params.dispatch(应用问水优化循环(cycle))
}
