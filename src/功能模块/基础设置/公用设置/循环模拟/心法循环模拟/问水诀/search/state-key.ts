import { 问水Buff状态, 问水待生效事件, 问水模拟状态 } from '../types'
import { 比较问水事件 } from '../simulator/events'

const 四季累计技能 = ['夕照雷峰', '云飞玉皇', '云景·云飞玉皇']

const 排序记录 = <T>(record: Record<string, T>) =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)))

const 标准化Buff = (buff: 问水Buff状态) => ({
  层数: buff.层数,
  结束帧: buff.结束帧,
  ...(buff.快照?.length ? { 快照: Array.from(new Set(buff.快照)).sort() } : {}),
})

const 标准化Buff集合 = (buffs: Record<string, 问水Buff状态>) =>
  Object.fromEntries(
    Object.entries(buffs)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, buff]) => [name, 标准化Buff(buff)]),
  )

const 标准化事件 = (event: 问水待生效事件) => ({
  ...event,
  ...(event.增益签名?.length ? { 增益签名: Array.from(new Set(event.增益签名)).sort() } : {}),
  ...(event.快照签名?.length ? { 快照签名: Array.from(new Set(event.快照签名)).sort() } : {}),
  ...(event.事件数据 ? { 事件数据: 排序记录(event.事件数据) } : {}),
})

const 标准化待生效事件 = (events: 问水待生效事件[]) =>
  events
    .map((event, index) => ({ event: 标准化事件(event), index }))
    .sort((left, right) => 比较问水事件(left.event, right.event) || left.index - right.index)
    .map((item) => item.event)

export const 获取问水状态键 = (state: 问水模拟状态) =>
  JSON.stringify({
    当前帧: state.当前帧,
    结束帧: state.结束帧,
    姿态: state.姿态,
    剑气: state.剑气,
    加速值: state.加速值,
    网络延迟: state.网络延迟,
    断潮可用: state.断潮可用,
    自身Buff: 标准化Buff集合(state.自身Buff),
    目标Buff: 标准化Buff集合(state.目标Buff),
    团队增益: 标准化Buff集合(state.团队增益),
    技能CD: 排序记录(state.技能CD),
    技能充能: 排序记录(state.技能充能),
    GCD: { 公共: state.GCD.公共, 自身: 排序记录(state.GCD.自身) },
    待生效事件: 标准化待生效事件(state.待生效事件),
    四季累计余数: state.技能记录.filter((item) => 四季累计技能.includes(item.技能名称)).length % 2,
    技能记录状态: state.待生效事件.length ? state.技能记录.length : state.技能记录.length > 0,
  })
