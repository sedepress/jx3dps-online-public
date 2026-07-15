import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const 当前目录 = path.dirname(fileURLToPath(import.meta.url))
const 项目目录 = path.resolve(当前目录, '..')
const 工作簿路径 = path.join(项目目录, '藏剑配装计算器暗影千机测试版ver1.1(202605212040).xlsx')
const 输出目录 = path.join(
  项目目录,
  'src/功能模块/基础设置/公用设置/循环模拟/心法循环模拟/问水诀/rules',
)
const 每个文件动作数 = 200
const 固定分块数 = 3
const 最大行 = 737

const 技能映射 = {
  '叠1-鹤归孤山': '鹤归孤山',
  '云飞玉皇-峰插': '云飞玉皇-峰插',
  '叠2-夕照雷峰': '夕照雷峰',
  '云景·云飞玉皇': '云景·云飞玉皇',
  '叠3-夕照雷峰': '夕照雷峰',
  云飞玉皇: '云飞玉皇',
  夕照雷峰: '夕照雷峰',
  风来吴山: '风来吴山',
  鹤归孤山: '鹤归孤山',
  '鹤归孤山-叠': '鹤归孤山-叠',
  '夕照雷峰-峰插': '夕照雷峰-峰插',
  '叠1-云飞玉皇': '云飞玉皇',
  '叠2-云景·云飞玉皇': '云景·云飞玉皇',
  '叠3-云飞玉皇': '云飞玉皇',
  '云飞玉皇-玉山揽云': '云飞玉皇-玉山揽云',
  '云飞玉皇-玉山揽云-叠': '云飞玉皇-玉山揽云-叠',
}

const 基线配置 = [
  { 名称: 'zhanyue', 技能列: 'AY', 权重列: 'AZ' },
  { 名称: 'bigui', 技能列: 'BI', 权重列: 'BJ' },
]

const 读取基线 = (工作表, 配置) => {
  const 结果 = []
  for (let 来源行 = 3; 来源行 <= 最大行; 来源行 += 1) {
    const 原始技能 = 工作表[`${配置.技能列}${来源行}`]?.v
    const 权重 = Number(工作表[`${配置.权重列}${来源行}`]?.v)
    if (!原始技能 || !(权重 > 0)) continue
    const 技能 = 技能映射[String(原始技能)]
    if (!技能) throw new Error(`未知技能 token: ${原始技能} (${配置.技能列}${来源行})`)
    结果.push([技能, 权重, 来源行])
  }
  if (!结果.length) throw new Error(`${配置.技能列}:${配置.权重列} 未提取到有效动作`)
  return 结果
}

const 写入分块 = (名称, 动作列表) => {
  if (动作列表.length > 每个文件动作数 * 固定分块数) {
    throw new Error(`${名称} 基线超过 ${固定分块数} 个分块容量`)
  }
  for (let index = 0; index < 固定分块数; index += 1) {
    const 分块 = 动作列表.slice(index * 每个文件动作数, (index + 1) * 每个文件动作数)
    const 文件路径 = path.join(输出目录, `excel-baseline-${名称}-${index + 1}.generated.ts`)
    const 内容 = 分块
      .map(([技能, 权重, 来源行]) => `  ['${技能.replaceAll("'", "\\'")}', ${权重}, ${来源行}]`)
      .join(',\n')
    fs.writeFileSync(文件路径, `const 数据 = [\n${内容},\n] as const\n\nexport default 数据\n`)
  }
  return 固定分块数
}

const main = () => {
  const 工作簿 = XLSX.readFile(工作簿路径)
  const 工作表 = 工作簿.Sheets['技能数计算']
  if (!工作表) throw new Error('缺少工作表：技能数计算')
  fs.mkdirSync(输出目录, { recursive: true })
  const 清单 = {}
  基线配置.forEach((配置) => {
    const 动作列表 = 读取基线(工作表, 配置)
    清单[配置.名称] = {
      技能列: 配置.技能列,
      权重列: 配置.权重列,
      动作数: 动作列表.length,
      分块数: 写入分块(配置.名称, 动作列表),
    }
  })
  fs.writeFileSync(
    path.join(输出目录, 'excel-baseline-manifest.generated.json'),
    `${JSON.stringify(清单, null, 2)}\n`,
  )
}

main()
