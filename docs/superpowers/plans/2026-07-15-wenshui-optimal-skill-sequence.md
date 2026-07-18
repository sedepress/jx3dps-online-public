# 问水诀最优技能序列 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户输入 `1-600` 秒战斗时长，在当前问水诀配装环境下搜索当前预算内期望 DPS 最高的主技能序列与断潮条件规则，并可应用为当前自定义循环。

**Architecture:** 先建立纯 TypeScript 的问水诀 16 帧不可变状态机，再以概率加权的可观察状态策略执行 Beam Search 与分支限界。搜索在分块执行的 Web Worker 中运行，最终把随机分支按概率聚合为现有 `循环技能详情[]`，交给当前 DPS 内核精确复算并通过 UI 应用。

**Tech Stack:** React 18、TypeScript、Redux Toolkit、Ant Design、Webpack Web Worker、Jest、Testing Library、SheetJS `xlsx`

> 2026-07-17 纠偏：原 Task 4-6 的“已建模”结论不成立。当前已确认 Excel `AY/BI` 模板能提供 token、造化分档和普通攻击次数公式，但没有可验证的三柴/四季回剑规则，因此不能作为合法动作轴。后续实现以 `docs/superpowers/specs/2026-07-17-wenshui-optimizer-rule-correction-design.md` 为准，搜索下界改为当前正式循环的精确 DPS；模板重放只用于结构化暴露缺失语义。

---

## 实施约束

- 当前工作区存在大量既存未提交修改，实施时必须逐文件阅读并合并，禁止还原用户改动。
- 当前已被用户修改的共享文件包括 `src/@types/循环.ts`、`src/store/data/index.ts`、`src/功能模块/基础设置/公用设置/循环模拟/index.tsx` 和 `AGENTS.md`。这些文件禁止使用 `git commit --only <file>` 提交整文件；必须用 `git add -p` 或等价的精确 hunk 暂存，逐项检查 `git diff --cached`，无法安全拆分时延后到最终集成提交。
- 新文件可以路径限定提交；所有提交前都检查 `git diff --cached --name-only`，不得带入当前已暂存的 Excel 文件。
- 新生产函数不超过 50 行，新生产文件不超过 300 行，嵌套不超过 3 层。
- 新行为按 TDD 执行：先写失败测试并确认失败原因，再实现最小代码。
- 规则值必须带项目测试或 Excel 单元格/列来源，不凭经验填写。
- 默认搜索使用固定节点扩展预算；墙钟 60 秒只是紧急上限。

## 文件结构

```text
scripts/
  extract-wenshui-sequence-baseline.mjs

src/@types/循环.ts

src/功能模块/基础设置/公用设置/循环模拟/
  index.tsx
  心法循环模拟/问水诀/
    types.ts
    rules/
      constants.ts
      excel-baseline-*.generated.ts
      excel-baseline-manifest.generated.json
      skill-definitions.ts
    simulator/
      create-state.ts
      time.ts
      events.ts
      light-skills.ts
      heavy-skills.ts
      buffs.ts
      team-buffs.ts
      stochastic.ts
      engine.ts
    damage/
      context.ts
      build-damage-table.ts
      aggregate-policy.ts
      rerank-candidates.ts
    search/
      state-key.ts
      upper-bound.ts
      baseline.ts
      exhaustive-oracle.ts
      beam-search.ts
      runner.ts
    worker/
      protocol.ts
      worker.ts
      client.ts
    apply/
      build-custom-cycle.ts
      apply-custom-cycle.ts
    components/
      OptimalSequenceModal/index.tsx
      OptimalSequenceModal/index.module.less
      SearchStatus.tsx
      SearchResult.tsx

对应目录内新增 `*.test.ts` / `*.test.tsx`，避免把所有测试堆入现有问水诀 DPS 大文件。
```

### Task 1: 固化 Excel 规则来源和有序基线

**Files:**

- Create: `scripts/extract-wenshui-sequence-baseline.mjs`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/excel-baseline-*.generated.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/excel-baseline-manifest.generated.json`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/constants.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/constants.test.ts`

- [ ] **Step 1: 写规则来源失败测试**

```ts
it('使用 16 帧制并提供斩岳与碧归有序基线', () => {
  expect(每秒郭氏帧).toBe(16)
  expect(获取Excel基线('紫武', '斩岳').slice(0, 3)).toEqual([
    expect.objectContaining({ 技能: '鹤归孤山', 来源列: 'AY', 来源行: 3 }),
    expect.objectContaining({ 技能: '云飞玉皇-峰插', 来源列: 'AY', 来源行: 4 }),
    expect.objectContaining({ 技能: '夕照雷峰', 来源列: 'AY', 来源行: 5 }),
  ])
  expect(获取Excel基线('橙武', '碧归').at(-1)).toMatchObject({ 来源列: 'BI' })
})
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/constants.test.ts --watchAll=false --runInBand`

Expected: FAIL，提示找不到 `constants` 或导出。

- [ ] **Step 3: 实现只读 Excel 提取脚本**

脚本使用 `xlsx` 读取：

- `技能数计算!AY:AZ`：叠锋意斩岳低延迟序列
- `技能数计算!BI:BJ`：叠锋意碧归橙武序列
- `循环手法!B:M`：短轴人工可读模板，用于校验技能 token 映射

输出使用每个文件最多 200 个元组的只读 TypeScript 分块，确保生成文件不超过 300 行；manifest 使用结构化 JSON：

```ts
interface Excel基线动作 {
  技能: string
  权重: number
  序号: number
  来源列: string
  来源行: number
}
```

未知 token、空洞序号、重复序号或来源列错配立即让脚本失败，不静默跳过。测试同时校验生成分块的关键首尾动作、来源和连续序号，防止脚本只生成“非空但无序”的数据。

- [ ] **Step 4: 生成基线并实现常量入口**

Run: `node scripts/extract-wenshui-sequence-baseline.mjs`

`constants.ts` 只导出时间常量、输入边界和基线查询函数；具体技能规则后续拆分。

- [ ] **Step 5: 运行测试与格式检查**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/constants.test.ts --watchAll=false --runInBand`

Run: `git diff --check -- scripts/extract-wenshui-sequence-baseline.mjs src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules`

- [ ] **Step 6: 路径限定提交**

```bash
git add -f scripts/extract-wenshui-sequence-baseline.mjs src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules
git commit -m "test: lock wenshui sequence rules" --only scripts/extract-wenshui-sequence-baseline.mjs src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules
```

### Task 2: 定义优化 DTO、条件规则和固定起手状态

**Files:**

- Modify: `src/@types/循环.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/types.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/create-state.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/create-state.test.ts`

- [ ] **Step 1: 写起手状态失败测试**

```ts
it('从轻剑、0 剑气、无职业 Buff 开始', () => {
  const state = 创建问水起手状态({ 战斗秒数: 220, 加速值: 9232, 网络延迟: 1 })
  expect(state.姿态).toBe('轻剑')
  expect(state.剑气).toBe(0)
  expect(state.自身Buff).toEqual({})
  expect(state.结束帧).toBe(220 * 16)
})
```

- [ ] **Step 2: 确认测试按预期失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/create-state.test.ts --watchAll=false --runInBand`

- [ ] **Step 3: 增加循环持久化类型**

在 `循环数据` 增加可选字段：

```ts
条件规则?: 循环条件规则[]
优化信息?: 循环优化信息
```

条件规则包含技能、条件、优先级、插入范围和回退动作；优化信息包含配置指纹、扩展预算、是否提前结束、搜索耗时和预期 DPS。

- [ ] **Step 4: 实现结构化克隆安全的搜索 DTO 和起手状态**

禁止在 DTO 中放入 `Map`、函数、类实例或 Redux 引用。CD、Buff 和事件队列使用普通对象与数组。

- [ ] **Step 5: 运行定向测试和 TypeScript 构建检查**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/create-state.test.ts --watchAll=false --runInBand`

Run: `npm run build`

- [ ] **Step 6: 提交新增文件，延后共享类型 hunk**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/types.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/create-state.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/create-state.test.ts
git commit -m "feat: define wenshui optimizer state" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/types.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/create-state.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/create-state.test.ts
```

`src/@types/循环.ts` 的新增字段用 `git add -p` 精确暂存，保留到最终集成提交，避免覆盖该文件已有修改。

### Task 3: 实现 16 帧时间推进和稳定事件顺序

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/time.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/events.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/time.test.ts`

- [ ] **Step 1: 写加速、同帧事件和结束边界失败测试**

覆盖：

- `获取实际帧数` 与现有工具结果一致
- 同帧先结算到时事件，再执行玩家动作，再清理过期 Buff
- 命中帧等于结束帧计伤，晚一帧不计伤
- 读条在结束帧前开始、结束帧后命中时越界伤害为零

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/time.test.ts --watchAll=false --runInBand`

- [ ] **Step 3: 实现小函数时间模块**

核心函数保持单一职责：

```ts
推进到帧(state, targetFrame)
结算到时事件(state, frame)
清理过期Buff(state, frame)
伤害是否计入(hitFrame, endFrame)
```

- [ ] **Step 4: 运行测试并复核现有通用加速测试**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/time.test.ts src/心法模块/心法/问水诀/问水诀dps.test.ts --watchAll=false --runInBand -t "加速|战斗时间"`

- [ ] **Step 5: 路径限定提交**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/time.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/events.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/time.test.ts
git commit -m "feat: add wenshui frame timeline" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator
```

### Task 3A: 将团队增益轴和快照窗口转换为时间事件

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/team-buffs.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/team-buffs.test.ts`

- [ ] **Step 1: 写团队增益时间轴失败测试**

构造包含开始帧、结束帧和快照类型的团队增益轴，断言：

- 增益开始帧前技能签名不包含该增益
- 窗口内技能签名包含该增益
- 结束帧后增益移除
- 同帧增益事件按 Task 3 的稳定事件顺序结算

- [ ] **Step 2: 写快照失败测试**

DOT 或支持快照的派生事件在命中/创建时固化快照签名；后续团队增益结束不修改已创建事件的快照。

- [ ] **Step 3: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/team-buffs.test.ts --watchAll=false --runInBand`

- [ ] **Step 4: 实现可结构化克隆的团队增益事件 DTO**

主线程使用现有团队增益轴工具把配置转换为按帧排序的纯数据事件；模拟器只消费事件，不读取 Redux。每个伤害事件记录当时激活的团队增益签名和快照签名，供 Task 7 构建伤害表。

- [ ] **Step 5: 运行团队增益与现有快照回归测试**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/team-buffs.test.ts src/心法模块/心法/问水诀/问水诀dps.test.ts --watchAll=false --runInBand -t "快照|团队增益"`

- [ ] **Step 6: 路径限定提交**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/team-buffs.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/team-buffs.test.ts
git commit -m "feat: model wenshui team buff windows" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/team-buffs.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/team-buffs.test.ts
```

### Task 4: 实现轻剑、姿态切换和剑气规则

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/skill-definitions.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/light-skills.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/engine.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/light-skills.test.ts`

- [ ] **Step 1: 写合法动作和剑气失败测试**

本任务只断言动作合法性、时间、资源变化和生成的伤害事件元数据，不断言具体伤害数值；权威伤害值由 Task 7 的伤害表统一提供。

测试必须从 Excel/项目来源确认具体值，至少覆盖：

- 轻剑起手只能枚举轻剑技能和合法姿态动作
- 听雷、三柴等技能按权威规则获得剑气
- 剑气不低于 `0`、不高于 `100`
- 重剑技能在轻剑姿态不可释放
- GCD 和网络延迟推进与 Task 3 一致

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/light-skills.test.ts --watchAll=false --runInBand`

- [ ] **Step 3: 实现数据驱动技能定义和一步执行引擎**

技能定义保存静态规则，技能函数只处理状态差异；不要为每个简单技能创建类。

```ts
export const 执行动作 = (state, action, context): 动作结果 => {
  // 校验 -> 推进 -> 结算 -> 应用技能 -> 返回新状态
}
```

- [ ] **Step 4: 运行测试并检查函数/文件指标**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/light-skills.test.ts --watchAll=false --runInBand`

- [ ] **Step 5: 路径限定提交**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/skill-definitions.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator
git commit -m "feat: model wenshui light sword actions" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules/skill-definitions.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator
```

### Task 5: 实现重剑技能、职业 Buff 和派生伤害事件

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/heavy-skills.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/buffs.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/heavy-skills.test.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/buffs.test.ts`

- [ ] **Step 1: 写重剑技能失败测试**

分别测试夕照、云飞、鹤归、风来、九皋和玉山：姿态、剑气、CD、读条、技能命中事件及二段/派生事件。本任务只断言事件名称、命中帧和增益/快照签名，不断言伤害数值。

- [ ] **Step 2: 写职业 Buff 失败测试**

分别测试雾锁、造化、层云、怜光等 Buff 的产生、层数、消耗、过期和伤害签名。每条断言注明项目测试或 Excel 来源。

- [ ] **Step 3: 运行两组测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/heavy-skills.test.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/buffs.test.ts --watchAll=false --runInBand`

- [ ] **Step 4: 实现重剑动作和 Buff 状态转换**

派生技能只作为伤害事件，不混入玩家主动作序列。每个事件携带技能名称、命中帧、技能等级和排序后的增益签名。

- [ ] **Step 5: 运行测试并对照现有问水技能增益测试**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/heavy-skills.test.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/buffs.test.ts src/心法模块/心法/问水诀/问水诀dps.test.ts --watchAll=false --runInBand -t "雾锁|造化|层云|怜光|神兵"`

- [ ] **Step 6: 路径限定提交**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator
git commit -m "feat: model wenshui heavy sword effects" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator
```

### Task 6: 实现断潮概率分支和条件策略

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/stochastic.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/stochastic.test.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.test.ts`

- [x] **Step 1: 写概率守恒失败测试**

```ts
it('会心触发将状态拆成断潮可用与不可用且总概率为 1', () => {
  const branches = 处理断潮触发(state, 0.37)
  expect(branches.map((item) => item.概率)).toEqual([0.37, 0.63])
  expect(branches.reduce((sum, item) => sum + item.概率, 0)).toBeCloseTo(1)
})
```

- [x] **Step 2: 写条件动作失败测试**

验证触发分支插入断潮并推进时间，未触发分支执行回退动作；两个分支后续可以依据玩家可观察状态选择不同动作。

- [x] **Step 3: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/stochastic.test.ts --watchAll=false --runInBand`

- [x] **Step 4: 实现概率分支、策略节点和安全合并**

只合并未来决策等价的可观察状态；合并时分别累计概率与概率加权伤害，禁止平均剑气、CD 或 Buff 层数。

- [x] **Step 5: 运行测试和动态断潮回归测试**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/stochastic.test.ts src/心法模块/心法/问水诀/问水诀dps.test.ts --watchAll=false --runInBand -t "断潮"`

- [x] **Step 6: 逐步执行 Excel 模板并结构化暴露首个缺失语义**

`baseline-execution.test.ts` 读取 Task 1 生成的斩岳/碧归模板，逐 token 映射并执行。未知 token、非法姿态、资源不足或无法解释的等待必须明确失败；不得通过猜测普通攻击回剑常量强行让模板通过。

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.test.ts --watchAll=false --runInBand`

- [x] **Step 7: 路径限定提交**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/stochastic.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/stochastic.test.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.test.ts
git commit -m "feat: model conditional duanchao branches" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/stochastic.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/stochastic.test.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/simulator/baseline-execution.test.ts
```

### Task 7: 构建单次伤害表、概率聚合和 DPS 精确复算

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage/build-damage-table.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage/aggregate-policy.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage/rerank-candidates.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage/aggregate-policy.test.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage/rerank-candidates.test.ts`

- [x] **Step 1: 写概率聚合失败测试**

验证成功率 `0.37` 的断潮分支最终聚合为 `技能数量: 0.37`，并按技能名称与增益签名分别聚合。

- [x] **Step 2: 写现有 DPS 内核一致性失败测试**

构造一个短序列，将伤害事件聚合后调用现有 `秒伤计算` 覆盖参数，断言技能总伤和模拟事件期望总伤一致。

- [x] **Step 3: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage/aggregate-policy.test.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage/rerank-candidates.test.ts --watchAll=false --runInBand`

- [x] **Step 4: 实现伤害快照、伤害表和聚合器**

先在 `damage/context.ts` 构建结构化克隆安全的伤害快照：复用当前装备、目标、奇穴、秘籍、团队增益和快照列表的现有工具，但不把 Redux `dispatch`、React 对象或 `Map` 放入 Worker DTO。伤害表通过当前技能系数、装备、奇穴、秘籍和团队增益生成。使用 `循环秒伤计算` 的 `计算结果技能列表` 提取目标技能单次伤害，忽略同次计算追加的顺序无关装备技能。

- [x] **Step 5: 实现最终候选精确重排**

只对 Beam Search 的有限 Top K 候选执行完整 DPS 内核复算，最终结果以复算 DPS 排序。

- [x] **Step 6: 运行测试**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage --watchAll=false --runInBand`

- [x] **Step 7: 提交新增文件；共享计算文件只精确暂存新增 hunks**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage
git commit -m "feat: evaluate wenshui policy damage" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/damage
```

如果后续需要修改 `src/计算模块/循环秒伤计算.ts` 或 `src/计算模块/计算函数.ts`，必须先拆出独立的共享 API 变更并使用精确 hunk 暂存；不得在本任务提交中覆盖其他未相关修改。

### Task 8: 实现状态键、安全上界和合法基线

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/state-key.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/upper-bound.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/baseline.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/pruning.test.ts`

- [x] **Step 1: 写状态键失败测试**

未来决策等价的状态生成相同键；剑气、姿态、关键 Buff、CD、断潮可用状态任一不同则键不同。

- [x] **Step 2: 写上界安全性失败测试**

短时长穷举的真实最优剩余伤害不得高于 `计算乐观上界`。上界可以宽松，但不能低估。

- [x] **Step 3: 写基线合法性失败测试**

Excel token 必须经过模拟器逐步执行；无法执行的 Excel 基线不得进入候选，只回退到合法贪心基线并记录原因。

- [x] **Step 4: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/pruning.test.ts --watchAll=false --runInBand`

- [x] **Step 5: 实现稳定状态键、宽松上界和基线构造**

第一版上界使用“剩余帧 × 所有当前可达技能中的最大理论每帧伤害”，忽略资源和 CD，因此保证不低估。

- [x] **Step 6: 运行测试并提交**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/pruning.test.ts --watchAll=false --runInBand`

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search
git commit -m "feat: add safe wenshui search pruning" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search
```

### Task 9: 用穷举 Oracle 驱动 Beam Search

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/exhaustive-oracle.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.test.ts`

- [x] **Step 1: 写短时长最优性失败测试**

对 `1-10` 秒的小技能集分别计算穷举策略和 Beam Search，断言期望总伤、主序列和条件规则相同。

- [x] **Step 2: 写确定性与基线失败测试**

同一输入和扩展预算运行两次结果完全一致；搜索结果不低于合法贪心基线和可比较的有序 Excel 基线。

- [x] **Step 3: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.test.ts --watchAll=false --runInBand`

- [x] **Step 4: 实现分组 Beam、分支限界和固定扩展预算**

每轮按姿态、剑气区间和关键 Buff 状态分桶；桶内稳定排序。搜索器不直接读取 `Date.now()`，只消费剩余扩展预算。

- [x] **Step 5: 运行测试并记录搜索统计**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search --watchAll=false --runInBand`

- [x] **Step 6: 路径限定提交**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search
git commit -m "feat: search optimal wenshui policies" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search
```

### Task 10: 实现可取消的分块 Runner 和 Web Worker

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/runner.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/protocol.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/worker.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/client.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/client.test.ts`

- [x] **Step 1: 写 Worker 协议和取消失败测试**

测试任务 ID、进度消息、完成消息、取消后忽略旧结果和 Worker 异常清理。

- [x] **Step 2: 写分块 Runner 失败测试**

每个 chunk 只执行固定扩展数并交还事件循环；取消、确定性预算完成和 60 秒紧急上限分别返回不同结束原因。

- [x] **Step 3: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/client.test.ts --watchAll=false --runInBand`

- [x] **Step 4: 实现 Worker 和客户端**

客户端使用：

```ts
new Worker(new URL('./worker.ts', import.meta.url))
```

Worker 通过 `setTimeout(..., 0)` 或等价调度逐块推进，使取消消息可以被处理。墙钟限制只在完整 chunk 边界检查。

- [x] **Step 5: 运行测试与构建**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/client.test.ts --watchAll=false --runInBand`

Run: `npm run build`

- [x] **Step 6: 路径限定提交**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/runner.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker
git commit -m "feat: run wenshui search in worker" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/runner.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker
```

### Task 11: 构建并应用自定义循环

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/apply/build-custom-cycle.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/apply/apply-custom-cycle.ts`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/apply/apply-custom-cycle.test.ts`
- Modify: `src/store/data/index.ts`

- [x] **Step 1: 写循环对象失败测试**

断言生成对象包含：名称、当前奇穴/秘籍、精确战斗时间、技能序列、条件规则、聚合技能详情、当前加速范围、当前延迟、配置指纹和优化信息。

- [x] **Step 2: 写应用原子性失败测试**

应用前 Redux 和 localStorage 不变；应用时更新自定义循环列表、当前循环名、奇穴、秘籍并清空不适用的 `当前战斗时间`，最后只调度一次正式 DPS 计算。

- [x] **Step 3: 运行测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/apply/apply-custom-cycle.test.ts --watchAll=false --runInBand`

- [x] **Step 4: 实现构造和应用 thunk**

缓存映射在函数执行时动态读取 `获取当前数据()`。循环同名时更新旧结果，否则追加；不得依赖循环模拟弹窗的 `useEffect` 才持久化。

- [x] **Step 5: 运行测试和循环选择回归测试**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/apply/apply-custom-cycle.test.ts src/心法模块/心法/问水诀/问水诀dps.test.ts --watchAll=false --runInBand -t "循环选择|自定义循环|战斗时间"`

- [x] **Step 6: 提交新增文件，延后共享 Store hunk**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/apply
git commit -m "feat: apply optimized wenshui cycles" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/apply
```

`src/store/data/index.ts` 的应用 action 用精确 hunk 暂存，和现有用户修改一起在最终集成提交前复核。

### Task 12: 实现最优序列弹窗和结果展示

**Files:**

- Modify: `src/功能模块/基础设置/公用设置/循环模拟/index.tsx`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.tsx`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.module.less`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/SearchStatus.tsx`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/SearchResult.tsx`
- Test: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx`

- [x] **Step 1: 写输入和生命周期失败测试**

覆盖：

- 只接受 `1-600` 整数秒
- 开始后创建 Worker，运行中按钮变为停止
- 进度更新不修改 Redux 当前循环
- 停止后保留当前最佳结果
- 组件卸载时终止 Worker

- [x] **Step 2: 写结果与应用失败测试**

覆盖技能序列/技能统计 Tabs、条件规则展示、提前结束标记、配置指纹过期阻止应用，以及应用成功后关闭弹窗。

- [x] **Step 3: 运行 React 测试确认失败**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx --watchAll=false --runInBand`

- [x] **Step 4: 实现现有风格下的 Modal**

使用 Ant Design `InputNumber`、`Progress`、`Tabs`、`Button` 和现有图标库。入口按钮替换当前禁用的“循环模拟”，不新增营销式页面或嵌套卡片。

- [x] **Step 5: 运行测试、构建并检查样式**

Run: `npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components/OptimalSequenceModal/index.test.tsx --watchAll=false --runInBand`

Run: `npm run build`

- [x] **Step 6: 启动开发服务器进行桌面和移动端冒烟验证**

Run: `HOST=127.0.0.1 BROWSER=none PORT=8001 npm run dev`

检查：弹窗不溢出、长序列可滚动、按钮和文字不重叠、运行中页面仍可操作。

- [x] **Step 7: 提交新增组件，延后共享入口 hunk**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components
git commit -m "feat: add wenshui optimal sequence UI" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/components
```

`src/功能模块/基础设置/公用设置/循环模拟/index.tsx` 的入口改动必须精确暂存，不能提交整个共享文件。

### Task 13: 性能基准、全量回归和经验沉淀

**Files:**

- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.benchmark.test.ts`
- Create: `src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-07-14-wenshui-optimal-skill-sequence-design.md`

- [x] **Step 1: 增加显式启用的 600 秒性能基准**

基准默认 `skip`，仅在 `RUN_WENSHUI_OPTIMIZER_BENCHMARK=1` 时执行。断言：60 秒内返回合法结果、概率总和为 1、结果不低于合法基线、结束原因正确。

- [x] **Step 2: 增加完整 Worker 管线性能基准**

`full-pipeline.benchmark.test.ts` 必须执行与 Worker 相同的完整路径：构建并 `structuredClone` 计算快照、分块 Runner、概率聚合、Top K 精确复算、协议完成消息序列化。断言完整管线 60 秒内结束，而不只测裸 `beam-search`。

- [x] **Step 3: 运行新增测试集合**

Run: `npx jest src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀 --watchAll=false --runInBand`

- [x] **Step 4: 运行两个 600 秒真实性能基准**

Run: `RUN_WENSHUI_OPTIMIZER_BENCHMARK=1 npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.benchmark.test.ts --watchAll=false --runInBand`

Run: `RUN_WENSHUI_OPTIMIZER_BENCHMARK=1 npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts --watchAll=false --runInBand`

记录实际耗时、扩展节点数、Beam 宽度、内存峰值、精确复算耗时和相对基线提升。若超过 60 秒，优先优化状态复制、状态键和伤害表查询，不降低正确性断言。

独立进程实测：Beam Search `9.104s`、峰值堆 `501.22 MiB`；完整管线最终复跑 `11.479s`、峰值堆 `614.73 MiB`、精确复算 `<1ms`。两者均为 `Beam=32`、`50,000 / 50,000` 扩展，以 `确定性预算` 结束且未提前结束。

- [x] **Step 5: 在开发服务器中执行一次真实浏览器 Worker 600 秒搜索**

从“最优序列”弹窗启动 600 秒搜索，确认页面在搜索中仍可交互、Worker 返回的 `workerElapsedMs <= 60000`、最终精确复算完成、应用按钮可用。记录结果中的结束原因和是否提前结束；这一步验证真实浏览器 Worker 启动、消息和渲染开销。

实测 `50,000 / 50,000` 扩展、耗时 `6.8s`，最终精确复算结果已展示，“应用为当前循环”按钮可用；控制台只有项目既存 antd deprecated/useForm 警告。

- [x] **Step 6: 运行问水诀完整回归测试**

Run: `npx jest --runTestsByPath src/心法模块/心法/问水诀/问水诀dps.test.ts src/心法模块/心法/问水诀/玉山揽云.test.ts --watchAll=false --runInBand`

- [x] **Step 7: 运行项目构建**

Run: `npm run build`

- [x] **Step 8: 使用 requesting-code-review 做规格符合性和风险审查**

重点审查：概率策略语义、上界安全性、Worker 取消、配置指纹、现有循环兼容和性能退化。

审查发现并修复一个 Critical 和两类 Important 问题：共享循环入口曾整体替换原有心法模拟器；完整管线基准曾过滤缺失系数技能且未让 cloned 快照驱动 Worker DTO；浏览器构建发现 type-only 符号使用普通重导出。入口改为问水诀专属分流并补回归测试，同时补齐三项轻剑技能系数、严格预算断言和 type-only 导出后，回归、基准、浏览器和生产构建均通过。

- [x] **Step 9: 根据真实实现经验更新 AGENTS**

按项目经验模板记录：触发信号、根因/约束、正确做法、验证方式和适用范围。只沉淀经测试或性能基准证明的结论。

- [x] **Step 10: 使用 verification-before-completion 完成最终验证**

重新运行所有声称通过的命令，检查 `git diff --check`、实际 UI、开发服务器和剩余未验证风险。

- [x] **Step 11: 提交新增基准测试，延后项目规则文档 hunk**

```bash
git add -f src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.benchmark.test.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts
git commit -m "test: benchmark wenshui optimizer" --only src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.benchmark.test.ts src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts
```

`AGENTS.md` 的经验条目以及设计文档的修订必须单独精确审查后再提交，不能使用整文件 `--only`。

## 最终验收命令

```bash
npx jest src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀 --watchAll=false --runInBand
npx jest --runTestsByPath src/心法模块/心法/问水诀/问水诀dps.test.ts src/心法模块/心法/问水诀/玉山揽云.test.ts --watchAll=false --runInBand
RUN_WENSHUI_OPTIMIZER_BENCHMARK=1 npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/search/beam-search.benchmark.test.ts --watchAll=false --runInBand
RUN_WENSHUI_OPTIMIZER_BENCHMARK=1 npx jest --runTestsByPath src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/worker/full-pipeline.benchmark.test.ts --watchAll=false --runInBand
npm run build
git diff --check
```

验收证据必须同时证明：短时长最优性、随机概率守恒、长时长合法性、Worker 可取消、应用循环一致性、600 秒性能和现有问水诀回归无退化。
