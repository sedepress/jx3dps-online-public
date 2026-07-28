export const 配装方案上限 = 5

export interface 配装方案数据类型 {
  名称: string
  配装数据: Record<string, any>
  更新时间: number
}

export const 读取配装方案 = (缓存键?: string): 配装方案数据类型[] => {
  if (!缓存键) return []

  try {
    const 方案列表 = JSON.parse(localStorage.getItem(缓存键) || '[]')
    if (!Array.isArray(方案列表)) return []

    return 方案列表.filter((方案) => 方案?.名称 && 方案?.配装数据).slice(0, 配装方案上限)
  } catch {
    return []
  }
}

export const 保存配装方案 = (
  当前方案: 配装方案数据类型[],
  名称: string,
  配装数据: Record<string, any>,
): 配装方案数据类型[] => {
  const 方案名称 = 名称.trim()
  const 已有方案索引 = 当前方案.findIndex((方案) => 方案.名称 === 方案名称)

  if (已有方案索引 < 0 && 当前方案.length >= 配装方案上限) {
    throw new Error(`最多保存${配装方案上限}套配装方案`)
  }

  const 新方案 = {
    名称: 方案名称,
    配装数据: JSON.parse(JSON.stringify(配装数据)),
    更新时间: Date.now(),
  }

  if (已有方案索引 >= 0) {
    return 当前方案.map((方案, 索引) => (索引 === 已有方案索引 ? 新方案 : 方案))
  }

  return [...当前方案, 新方案]
}

export const 持久化配装方案 = (缓存键: string | undefined, 方案列表: 配装方案数据类型[]) => {
  if (!缓存键) return
  localStorage.setItem(缓存键, JSON.stringify(方案列表))
}
