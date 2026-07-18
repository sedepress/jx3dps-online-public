# 问水诀最优序列质量修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让问水诀最优序列按正式 DPS 复算选择胜者，保证结果不低于当前预设循环，并展示带技能图标的完整玩家按键序列。

**Architecture:** 先把奇穴“如风”的 8% 加速接入问水诀动作帧计算，使合法 Excel 基线能产生正确数量的主动及衍生技能；Worker 再返回最多 16 个多样化候选。主线程把这些候选与当前预设基线统一交给正式 `秒伤计算`，按正式 DPS 选出最终胜者，UI 只展示胜者的玩家按键序列并通过集中图标映射渲染。

**Tech Stack:** TypeScript、React 18、Redux Toolkit、Ant Design 5、Jest、Testing Library、Web Worker

## Global Constraints

- 最终正式 DPS 必须大于等于同配置、同战斗时间的当前预设循环 DPS。
- 220–600 秒只表述为“当前搜索预算内，经正式复算后的最高序列”，不宣称数学全局最优。
- 主序列只包含玩家实际按键；断潮、破招、九皋落剑、四季剑法继续放在技能统计中。
- Worker 最多返回 16 个候选；预设基线不占用这 16 个搜索候选名额。
- 不修改其他心法的循环模拟逻辑。
- 函数不超过 50 行，文件不超过 300 行，嵌套深度不超过 3 层。
- 生产代码必须在对应失败测试之后编写。
- 保留用户未提交的 `src/功能模块/系统说明/index.tsx` 修改，不纳入任何提交。

## 执行结果（2026-07-18）

- Task 1 已完成：如风 `82/1024` 郭氏加速已进入 GCD/读条，220 秒 Excel 基线动作轴回归通过。
- Task 2 已完成：Beam/Runner 返回最多 16 个终点候选；预算截断且无终点时回退当前最佳，Worker DTO 可结构化克隆。
- Task 3 已完成：预设循环与搜索候选统一走正式 `秒伤计算`，正式 DPS 排序；搜索候选失败时丢弃，预设循环始终作为下界候选。
- Task 4 已完成：完整玩家按键序列改为编号 + 32px JX3BOX 技能图标流，图标失败回退心法图标；自动触发技能仍只出现在技能统计。
- Task 5 已完成：220 秒真实完整管线通过，候选数 `15`，正式胜者 DPS `5,534,477.43`，预设 DPS `5,534,477.43`，胜者序列非空；问水诀全目录测试和生产构建通过。

说明：长时长结果表述为当前搜索预算内经正式复算的最高候选，不宣称数学全局最优。

---

### Task 1: 补齐如风加速并锁定 220 秒基线数量

**Files:**

- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/engine.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/time.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/heavy-skills.test.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.test.ts`

**Interfaces:**

- Consumes: `执行动作(state, 技能名称, context)`、`执行Excel基线(state, baseline, context)`。
- Produces: 如风的 `82/1024` 郭氏加速同时进入 GCD 和读条帧计算；220 秒 Excel 基线能执行与预设主动技能数量一致的合法前缀。

- [ ] **Step 1: 写如风加速影响云飞动作帧的失败测试**

在 `heavy-skills.test.ts` 增加：

```ts
it('如风八点加速率进入云飞公共 GCD 和读条帧', () => {
  const 普通 = 执行动作(创建重剑状态(), '云飞玉皇')
  const 如风 = 执行动作(创建重剑状态(), '云飞玉皇', { 奇穴: ['如风'] })

  expect(普通.状态.GCD.公共).toBe(22)
  expect(如风.状态.GCD.公共).toBe(20)
  expect(如风.状态.技能记录[0].命中帧).toBe(20)
})
```

- [ ] **Step 2: 运行测试并确认按当前错误行为失败**

Run:

```bash
npx jest --runTestsByPath 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/heavy-skills.test.ts' --watchAll=false --runInBand
```

Expected: FAIL，如风结果仍为 `22` 帧。

- [ ] **Step 3: 将如风郭氏加速传入动作帧计算**

在 `time.ts` 扩展 wrapper：

```ts
export const 获取问水实际帧数 = (原始帧数: number, 加速值: number, 郭氏加速 = 0) =>
  获取实际帧数(原始帧数, 加速值, 郭氏加速)
```

在 `engine.ts` 增加具名常量与 helper：

```ts
const 如风郭氏加速 = 82

const 获取奇穴郭氏加速 = (context: 问水动作上下文) =>
  context.奇穴?.includes('如风') ? 如风郭氏加速 : 0
```

`获取读条帧` 和 `应用技能变化` 的 GCD 帧都调用：

```ts
获取问水实际帧数(基础帧数, state.加速值, 获取奇穴郭氏加速(context))
```

不得修改读条与公共 GCD 的现有 `Math.max` 关系，也不得改变技能命中、回剑和伤害事件时序。

- [ ] **Step 4: 运行重剑动作测试并确认通过**

Run:

```bash
npx jest --runTestsByPath 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/heavy-skills.test.ts' --watchAll=false --runInBand
```

Expected: PASS。

- [ ] **Step 5: 写 220 秒 Excel 基线主动技能数量回归测试**

在 `baseline-execution.test.ts` 增加真实默认加速 `13739`、网络延迟 `1` 的用例，统计 `状态.技能记录`：

```ts
it('220 秒斩岳基线按 Excel GCD 推进并覆盖预设主动技能数量', () => {
  const initial = {
    ...创建问水起手状态({ 战斗秒数: 220, 加速值: 13739, 网络延迟: 1 }),
    姿态: '重剑' as const,
    剑气: 100,
  }
  const result = 执行Excel基线(initial, 获取Excel基线('紫武', '斩岳'), {
    奇穴: ['叠锋意', '斩岳', '造化', '山倾', '层云', '雾锁', '怜光', '如风'],
    秘籍: { 夕照雷峰: ['4%伤害', '3%伤害'] },
  })
  const counts = result.状态.技能记录.reduce<Record<string, number>>((map, item) => {
    map[item.技能名称] = (map[item.技能名称] || 0) + 1
    return map
  }, {})

  expect(result.成功).toBe(true)
  expect(result.状态.当前帧).toBe(3518)
  expect(counts['听雷-轻']).toBe(4)
  expect(counts['夕照雷峰']).toBe(85)
  expect((counts['云飞玉皇'] || 0) + (counts['云景·云飞玉皇'] || 0)).toBe(61)
  expect(counts['鹤归孤山']).toBe(15)
  expect(counts['风来吴山']).toBe(3)
})
```

- [ ] **Step 6: 运行基线测试并确认预设数量下界通过**

Run:

```bash
npx jest --runTestsByPath 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.test.ts' --watchAll=false --runInBand
```

Expected: PASS。夕照和云飞各比预设聚合统计少一个结束边界动作；最终 DPS 下界仍由正式预设候选保证，不得再扩大这项边界差。

- [ ] **Step 7: 提交模拟规则修复**

```bash
git add 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/engine.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/time.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/heavy-skills.test.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.test.ts'
git commit -m 'fix: include rufeng haste in wenshui simulator'
```

### Task 2: 让 Worker 返回有界多候选集合

**Files:**

- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.test.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/runner.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/protocol.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/client.test.ts`

**Interfaces:**

- Consumes: `问水搜索候选`、`比较问水搜索候选`、`获取问水策略状态键`。
- Produces: `问水Beam搜索结果.候选列表` 与 `问水Runner结果.候选列表`，长度 `1..16`，无重复候选。

- [ ] **Step 1: 写 Beam 结果包含多个稳定候选的失败测试**

在 `beam-search.test.ts` 增加：

```ts
it('返回最多十六个按近似伤害排序的唯一候选', () => {
  const result = 搜索问水Beam策略({ ...创建搜索配置(3), Beam宽度: 8, 扩展预算: 500 })

  expect(result.成功).toBe(true)
  if (!result.成功) return
  expect(result.候选列表.length).toBeGreaterThan(1)
  expect(result.候选列表.length).toBeLessThanOrEqual(16)
  expect(new Set(result.候选列表.map((item) => JSON.stringify(item.主序列))).size).toBe(
    result.候选列表.length,
  )
  expect(result.候选列表[0]).toEqual(result.最佳候选)
  expect(result.候选列表.map((item) => item.期望总伤)).toEqual(
    result.候选列表.map((item) => item.期望总伤).sort((a, b) => b - a),
  )
})
```

- [ ] **Step 2: 运行 Beam 测试确认缺少候选列表**

Run:

```bash
npx jest --runTestsByPath 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.test.ts' --watchAll=false --runInBand
```

Expected: FAIL，`候选列表` 未定义。

- [ ] **Step 3: 在 Beam 运行状态维护候选池**

在 `beam-search.ts` 增加常量和纯函数：

```ts
const 最大候选数 = 16

const 获取候选唯一键 = (candidate: 问水搜索候选) =>
  `${获取问水策略状态键(candidate.分支)}|${JSON.stringify(candidate.主序列)}|${JSON.stringify(
    candidate.条件规则,
  )}`

const 合并候选池 = (current: 问水搜索候选[], incoming: 问水搜索候选[]) =>
  Array.from(
    new Map(current.concat(incoming).map((candidate) => [获取候选唯一键(candidate), candidate])).values(),
  )
    .sort(比较问水搜索候选)
    .slice(0, 最大候选数)
```

给 `Beam运行状态` 增加：

```ts
候选池: 问水搜索候选[]
```

初始化时使用空候选池。一个 frontier 候选完成所有动作扩展且没有生成任何子节点时，说明该候选无法继续推进，将它加入候选池：

```ts
const 已到终点 = expanded.是否完成 && expanded.候选.length === 0
const 候选池 = 已到终点
  ? 合并候选池(runtime.候选池, [candidate])
  : runtime.候选池
```

每次更新 `runtime` 时保留新的 `候选池`。`获取问水Beam会话结果` 只返回终点候选；搜索被预算截断且候选池为空时，才使用当前 `best`：

```ts
const 候选列表 = session.runtime.候选池.length
  ? session.runtime.候选池
  : [session.runtime.best]
return {
  最佳候选: 候选列表[0],
  候选列表,
  // 保留现有扩展节点数、结束原因和基线失败原因
}
```

- [ ] **Step 4: 传递候选列表到 Runner 与 Worker 协议**

扩展成功的 `问水Runner结果`：

```ts
候选列表: 问水搜索候选[]
```

`创建Runner结果` 从 `获取问水Beam会话结果` 同时复制 `最佳候选` 和 `候选列表`。`Worker出站消息` 继续复用 `问水Runner结果`，不增加不可克隆字段。

- [ ] **Step 5: 更新客户端协议测试**

在 `worker/client.test.ts` 的成功结果 fixture 中增加：

```ts
候选列表: [候选],
```

并断言完成回调收到相同候选列表。

- [ ] **Step 6: 运行搜索与 Worker 测试**

Run:

```bash
npx jest --runTestsByPath \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.test.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/client.test.ts' \
  --watchAll=false --runInBand
```

Expected: PASS。

- [ ] **Step 7: 提交多候选协议**

```bash
git add 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.test.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/runner.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/protocol.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/client.test.ts'
git commit -m 'feat: return multiple wenshui search candidates'
```

### Task 3: 将预设基线与搜索候选统一正式复算

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/exact-candidates.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/exact-candidates.test.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/adapter.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/SearchResult.tsx`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx`

**Interfaces:**

- Consumes: Worker `候选列表`、`问水当前循环基线`、正式 DPS 回调。
- Produces: `选择问水正式最高候选(params): 问水正式候选结果`，胜者正式 DPS 永远不低于预设基线。

- [ ] **Step 1: 写正式候选排序的失败测试**

新建 `exact-candidates.test.ts`：

```ts
import { describe, expect, it } from '@jest/globals'
import { 选择问水正式最高候选 } from './exact-candidates'

describe('问水诀正式候选重排', () => {
  it('搜索正式 DPS 较低时返回带完整序列的预设基线', () => {
    const result = 选择问水正式最高候选({
      预设基线: {
        id: 'baseline',
        来源: '预设基线',
        技能序列: ['莺鸣柳', '鹤归孤山'],
        条件规则: [],
        技能详情: [{ 技能名称: '鹤归孤山', 技能数量: 1 }],
        近似期望伤害: 0,
        稳定序号: 0,
        正式DPS: 500,
      },
      搜索候选: [
        {
          id: 'search-1',
          来源: 'Beam搜索',
          技能序列: ['云飞玉皇'],
          条件规则: [],
          技能详情: [{ 技能名称: '云飞玉皇', 技能数量: 1 }],
          近似期望伤害: 1000,
          稳定序号: 1,
        },
      ],
      计算正式DPS: () => 400,
    })

    expect(result.胜者.来源).toBe('预设基线')
    expect(result.胜者.正式DPS).toBe(500)
    expect(result.胜者.技能序列).toEqual(['莺鸣柳', '鹤归孤山'])
  })

  it('按正式 DPS 而不是近似伤害选择搜索胜者', () => {
    const result = 选择问水正式最高候选({
      预设基线: 创建候选('baseline', '预设基线', 500, 0),
      搜索候选: [创建候选('high-approx', 'Beam搜索', undefined, 1000), 创建候选('high-exact', 'Beam搜索', undefined, 900)],
      计算正式DPS: (candidate) => (candidate.id === 'high-exact' ? 550 : 450),
    })

    expect(result.胜者.id).toBe('high-exact')
    expect(result.胜者.正式DPS).toBe(550)
  })
})
```

同文件在 `describe` 前定义：

```ts
const 创建候选 = (
  id: string,
  来源: '预设基线' | 'Beam搜索',
  正式DPS: number | undefined,
  近似期望伤害: number,
) => ({
  id,
  来源,
  技能序列: [id],
  条件规则: [],
  技能详情: [{ 技能名称: '云飞玉皇', 技能数量: 1 }],
  近似期望伤害,
  稳定序号: 1,
  ...(正式DPS === undefined ? {} : { 正式DPS }),
})
```

- [ ] **Step 2: 运行测试确认模块不存在**

Run:

```bash
npx jest --runTestsByPath 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/exact-candidates.test.ts' --watchAll=false --runInBand
```

Expected: FAIL，无法导入 `exact-candidates`。

- [ ] **Step 3: 实现纯正式候选重排模块**

`exact-candidates.ts` 定义：

```ts
export interface 问水待正式复算候选 {
  id: string
  来源: '预设基线' | 'Beam搜索'
  技能序列: string[]
  条件规则: 问水搜索条件规则[]
  技能详情: 循环技能详情[]
  近似期望伤害: number
  稳定序号: number
  正式DPS?: number
}

export interface 问水正式候选 extends 问水待正式复算候选 {
  正式DPS: number
}
```

实现规则：

```ts
const DPS容差 = 1e-6

const 比较正式候选 = (left: 问水正式候选, right: 问水正式候选) =>
  right.正式DPS - left.正式DPS ||
  right.近似期望伤害 - left.近似期望伤害 ||
  left.技能序列.length - right.技能序列.length ||
  left.稳定序号 - right.稳定序号
```

`选择问水正式最高候选` 必须：

- 校验预设基线正式 DPS 为非负有限数。
- 逐一复算搜索候选；非法结果放入 `失败候选`，不终止整个转换。
- 将预设基线无条件加入成功候选。
- 排序后返回第一名、全部成功候选和失败候选。
- 若第一名比预设只高 `DPS容差` 以内，稳定选择预设基线。

- [ ] **Step 4: 让 adapter 构造非空预设序列**

修改 `获取当前循环基线`，接收 `回退技能序列: string[]`：

```ts
const 技能序列 = cycle?.技能序列?.length ? cycle.技能序列 : 回退技能序列
if (!技能序列.length) return undefined
```

`创建当前问水搜索任务` 先创建搜索任务，再将 `task.搜索参数.基线动作序列 || []` 传给 `获取当前循环基线`。保留自定义循环自身序列的优先级。

随后强制校验：

```ts
const 当前循环基线 = 获取当前循环基线(params, params.战斗时间, 回退技能序列)
if (!当前循环基线) throw new Error('当前循环缺少可搜索的玩家按键序列')
return { ...task, 当前循环基线 }
```

- [ ] **Step 5: 转换所有 Worker 候选并正式复算**

在 `adapter.ts` 提取以下不超过 50 行的转换函数：

```ts
const 转换搜索候选 = (candidate: 问水搜索候选, index: number): 问水待正式复算候选 => {
  const aggregated = 聚合问水策略({ 分支: candidate.分支 })
  if (!aggregated.成功) throw new Error(aggregated.失败原因)
  const cycle = 转换问水聚合项为循环({ 项目: aggregated.项目, 解析增益签名: 获取循环增益签名 })
  if (!cycle.成功) throw new Error(cycle.失败原因)
  return {
    id: `beam-${index}`,
    来源: 'Beam搜索',
    技能序列: candidate.主序列,
    条件规则: candidate.条件规则,
    技能详情: cycle.技能详情,
    近似期望伤害: candidate.期望总伤,
    稳定序号: candidate.稳定序号,
  }
}
```

预设基线候选使用已有 `baseline.DPS`，搜索候选的 `计算正式DPS` 继续调用 `执行问水DPS计算`，并传入基线循环详情以保留装备追加技能、覆盖率和伤害口径。

`转换当前问水搜索结果` 使用正式胜者生成展示结果，增加：

```ts
结果来源: winner.来源,
候选数量: reranked.成功候选.length,
当前循环DPS: baseline.DPS,
DPS提升: winner.正式DPS - baseline.DPS,
是否优于当前循环: winner.来源 === 'Beam搜索' && winner.正式DPS > baseline.DPS,
```

当预设胜出时不再清空技能序列。

- [ ] **Step 6: 更新控制器和 UI fixture 测试**

在 `OptimalSequenceModal/index.test.tsx`：

- 所有成功 `问水Runner结果` fixture 增加 `候选列表`。
- 预设胜出用例断言技能序列标签仍存在，并能看到 `莺鸣柳`。
- 真实 220 秒用例断言：

```ts
expect(display.预期DPS).toBeGreaterThanOrEqual(task.当前循环基线?.DPS || 0)
expect(display.技能序列.length).toBeGreaterThan(0)
expect(display.结果来源).toBe('预设基线')
```

- [ ] **Step 7: 运行正式重排与弹窗测试**

Run:

```bash
npx jest --runTestsByPath \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/exact-candidates.test.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx' \
  --watchAll=false --runInBand
```

Expected: PASS，且真实 220 秒用例的最终正式 DPS 不低于预设。

- [ ] **Step 8: 提交正式候选重排**

```bash
git add 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/exact-candidates.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/exact-candidates.test.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/adapter.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/SearchResult.tsx' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx'
git commit -m 'fix: rank wenshui candidates by official dps'
```

### Task 4: 添加技能图标映射和图标序列展示

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/skill-display.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/skill-display.test.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/SearchResult.tsx`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.module.less`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx`

**Interfaces:**

- Consumes: `技能序列: string[]`。
- Produces: `获取问水技能展示(技能名称)` 和带 `<img>` 的可滚动技能序列。

- [ ] **Step 1: 写完整动作空间图标映射失败测试**

新建 `skill-display.test.ts`：

```ts
import { describe, expect, it } from '@jest/globals'
import { 问水技能定义 } from '../rules/skill-definitions'
import { 获取问水技能展示 } from './skill-display'

describe('问水诀技能展示映射', () => {
  it('所有玩家动作都有稳定图标和显示名称', () => {
    Object.keys(问水技能定义).forEach((skill) => {
      expect(获取问水技能展示(skill)).toEqual({
        技能名称: skill,
        显示名称: expect.any(String),
        图标: expect.stringMatching(/^https:\/\/icon\.jx3box\.com\/icon\/\d+\.png$/),
      })
    })
  })
})
```

- [ ] **Step 2: 运行测试确认映射模块不存在**

Run:

```bash
npx jest --runTestsByPath 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/skill-display.test.ts' --watchAll=false --runInBand
```

Expected: FAIL，无法导入映射模块。

- [ ] **Step 3: 实现集中图标映射**

`skill-display.ts` 使用已核对的 JX3BOX `skill_name_icon.json` 数据：

```ts
const 图标ID: Record<string, number> = {
  莺鸣柳: 2388,
  啸日: 2369,
  '听雷-轻': 2363,
  黄龙吐翠: 2386,
  平湖断月: 2383,
  '九溪弥烟-轻': 2384,
  夕照雷峰: 2372,
  云飞玉皇: 2370,
  '云景·云飞玉皇': 2370,
  鹤归孤山: 2371,
  风来吴山: 2375,
  峰插云景: 2374,
}

const 显示名称: Record<string, string> = {
  '听雷-轻': '听雷',
  '九溪弥烟-轻': '九溪弥烟',
  '云景·云飞玉皇': '云景·云飞玉皇',
}

export const 获取问水技能展示 = (技能名称: string) => ({
  技能名称,
  显示名称: 显示名称[技能名称] || 技能名称,
  图标: `https://icon.jx3box.com/icon/${图标ID[技能名称]}.png`,
})
```

测试保证 `图标ID[技能名称]` 不会缺失，因此生产函数不静默生成 `undefined.png`。

- [ ] **Step 4: 将文字 `<ol>` 攐为图标流**

在 `SearchResult.tsx` 中将每个序列动作渲染为：

```tsx
const info = 获取问水技能展示(skill)
return (
  <li className={styles.sequenceItem} key={`${skill}-${index}`} title={info.显示名称}>
    <span className={styles.sequenceIndex}>{index + 1}</span>
    <img
      src={info.图标}
      alt={info.显示名称}
      loading='lazy'
      onError={(event) => {
        event.currentTarget.onerror = null
        event.currentTarget.src = 'https://img.jx3box.com/image/xf/10144.png'
      }}
    />
    <span className={styles.sequenceName}>{info.显示名称}</span>
  </li>
)
```

结果顶部增加：

```tsx
<Tag color={结果.结果来源 === 'Beam搜索' ? 'green' : 'blue'}>{结果.结果来源}</Tag>
<span>{`预设 ${Math.round(结果.当前循环DPS || 0).toLocaleString()} DPS`}</span>
<span>{`提升 ${Math.round(结果.DPS提升 || 0).toLocaleString()} DPS`}</span>
```

- [ ] **Step 5: 添加紧凑响应式样式**

在 `index.module.less`：

```less
.sequenceList {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 360px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.sequenceItem {
  display: grid;
  grid-template-columns: 24px 32px minmax(72px, auto);
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fafafa;
}

.sequenceItem img {
  width: 32px;
  height: 32px;
  border-radius: 4px;
}
```

移动端将 `.sequenceItem` 设为 `flex: 1 1 100%`，桌面端为 `flex: 0 1 auto`。

- [ ] **Step 6: 更新 UI 测试**

在 `OptimalSequenceModal/index.test.tsx` 的技能序列测试中增加：

```ts
expect(screen.getByRole('img', { name: '听雷' }).getAttribute('src')).toBe(
  'https://icon.jx3box.com/icon/2363.png',
)
expect(screen.getByRole('img', { name: '云飞玉皇' })).toBeTruthy()
expect(screen.getByText('预设基线')).toBeTruthy()
```

再触发图片错误并断言心法图标兜底：

```ts
const icon = screen.getByRole('img', { name: '听雷' })
fireEvent.error(icon)
expect(icon.getAttribute('src')).toBe('https://img.jx3box.com/image/xf/10144.png')
```

- [ ] **Step 7: 运行图标与弹窗测试**

Run:

```bash
npx jest --runTestsByPath \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/skill-display.test.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx' \
  --watchAll=false --runInBand
```

Expected: PASS。

- [ ] **Step 8: 提交图标序列 UI**

```bash
git add 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/skill-display.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/skill-display.test.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/SearchResult.tsx' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.module.less' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx'
git commit -m 'feat: show wenshui optimal sequence skill icons'
```

### Task 5: 恢复完整管线质量门禁并完成交付验证

**Files:**

- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts`
- Modify: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.benchmark.test.ts`
- Modify: `AGENTS.md`（仅在本次根因和验证入口对后续排查具有重复价值时追加经验）

**Interfaces:**

- Consumes: 完整 Worker 结果、主线程正式重排、当前预设基线。
- Produces: 220 秒真实性能与质量门禁，证明最终正式 DPS、序列和图标要求同时满足。

- [ ] **Step 1: 先恢复会失败的正式 DPS 下界断言**

修改 `full-pipeline.benchmark.test.ts`，使用 `转换当前问水搜索结果(result, task, { data, dispatch })` 获得最终展示结果，并增加：

```ts
expect(display.预期DPS).toBeGreaterThanOrEqual(prepared.baseline.DPS)
expect(display.技能序列.length).toBeGreaterThan(0)
expect(display.候选数量).toBeGreaterThan(0)
expect(['预设基线', 'Beam搜索']).toContain(display.结果来源)
```

指标输出增加：

```ts
officialWinnerDps: Number(display.预期DPS.toFixed(2)),
winnerSource: display.结果来源,
winnerSequenceLength: display.技能序列.length,
```

- [ ] **Step 2: 运行 220 秒基准并确认当前代码失败**

Run:

```bash
env RUN_WENSHUI_OPTIMIZER_BENCHMARK=1 WENSHUI_BENCHMARK_SECONDS=220 \
  npx jest --runTestsByPath \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts' \
  --watchAll=false --runInBand
```

Expected before Tasks 1–4: FAIL，搜索候选正式 DPS 约为 `4,781,540`，低于预设 `5,534,477.43`；完成 Tasks 1–4 后 PASS。

- [ ] **Step 3: 更新 Beam 性能基准的候选协议断言**

在 `beam-search.benchmark.test.ts` 增加：

```ts
expect(result.候选列表.length).toBeGreaterThan(0)
expect(result.候选列表.length).toBeLessThanOrEqual(16)
expect(result.候选列表[0]).toEqual(result.最佳候选)
```

保留 60 秒、扩展预算和基线下界断言。

- [ ] **Step 4: 运行问水诀最优序列全部测试**

Run:

```bash
npx jest --runTestsByPath \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀' \
  --watchAll=false --runInBand
```

如果 Jest 不接受目录路径，使用：

```bash
npx jest 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀' --watchAll=false --runInBand
```

Expected: 所有启用测试 PASS，benchmark skip 用例不计为失败。

- [ ] **Step 5: 运行问水诀 DPS 回归测试**

Run:

```bash
npx jest --runTestsByPath 'src/心法模块/心法/问水诀/问水诀dps.test.ts' --watchAll=false --runInBand
```

Expected: PASS。

- [ ] **Step 6: 运行真实 220 秒完整管线**

Run:

```bash
env RUN_WENSHUI_OPTIMIZER_BENCHMARK=1 WENSHUI_BENCHMARK_SECONDS=220 \
  npx jest --runTestsByPath \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts' \
  --watchAll=false --runInBand
```

Expected:

- PASS。
- `officialWinnerDps >= baselineDps`。
- `winnerSequenceLength > 0`。
- `workerElapsedMs < 60000`。

- [ ] **Step 7: 运行生产构建**

Run:

```bash
npm run build
```

Expected: exit code `0`。

- [ ] **Step 8: 检查代码指标和 diff**

Run:

```bash
git diff --check
git status --short
```

确认：

- `adapter.ts` 不超过 300 行；候选排序和校验逻辑固定放在 `exact-candidates.ts`，不回填到 adapter。
- 没有新函数超过 50 行。
- `src/功能模块/系统说明/index.tsx` 仍是用户原有未提交修改，没有进入本次 staged diff。

- [ ] **Step 9: 按 requesting-code-review 执行代码审查**

使用 `requesting-code-review` 的 reviewer 模板审查本计划、设计规格和当前实现 diff。修复全部 Critical 和 Important 问题，并重新运行受影响测试。

- [ ] **Step 10: 按 verification-before-completion 做完成审计**

逐项核对设计文档“完成标准”，重新读取最近一次测试、基准和构建输出；只有所有证据均为当前代码的新鲜结果时，才允许声明完成。

- [ ] **Step 11: 提交基准与经验记录**

```bash
git add 'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts' \
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.benchmark.test.ts'
git add AGENTS.md
git commit -m 'test: enforce wenshui optimizer dps floor'
```

如果 `AGENTS.md` 没有新增经验，则不要执行 `git add AGENTS.md`。
