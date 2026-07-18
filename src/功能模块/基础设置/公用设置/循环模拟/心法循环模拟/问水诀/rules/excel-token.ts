const 基础动作 = new Set(['夕照雷峰', '云飞玉皇', '云景·云飞玉皇', '鹤归孤山', '风来吴山'])

interface Excel动作Token {
  成功: true
  token: string
  前置动作: string[]
  主要动作: string
  后置动作: string[]
}

type Excel动作Token结果 = Excel动作Token | { 成功: false; 失败原因: string }

export const 解析问水Excel动作Token = (token: string): Excel动作Token结果 => {
  if (token === '听雷-轻') {
    return { 成功: true, token, 前置动作: ['啸日'], 主要动作: token, 后置动作: ['啸日'] }
  }
  const 前置动作: string[] = []
  const 后置动作: string[] = []
  let 主要动作 = token
  if (/^叠[123]-/.test(主要动作)) {
    前置动作.push('莺鸣柳')
    主要动作 = 主要动作.replace(/^叠[123]-/, '')
  }
  if (主要动作.endsWith('-叠')) {
    前置动作.push('莺鸣柳')
    主要动作 = 主要动作.slice(0, -2)
  }
  if (主要动作.endsWith('-峰插')) {
    后置动作.push('峰插云景')
    主要动作 = 主要动作.slice(0, -3)
  }
  if (!基础动作.has(主要动作)) {
    return { 成功: false, 失败原因: `${token}: 未知 Excel 动作 token` }
  }
  return { 成功: true, token, 前置动作, 主要动作, 后置动作 }
}
