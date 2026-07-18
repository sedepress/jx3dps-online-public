import type { 心法配置类型 } from '@/心法模块/interface'

const 默认心法 = '问水诀'
const 简写映射 = {
  wsj: 默认心法,
}

const 心法加载器 = {
  [默认心法]: () => import('@/心法模块/心法/问水诀/index'),
}

type 支持心法名称 = keyof typeof 心法加载器

const 是支持心法 = (心法?: string): 心法 is 支持心法名称 => {
  return !!心法 && 心法 in 心法加载器
}

const 获取可用心法 = (心法?: string): 支持心法名称 => {
  return 是支持心法(心法) ? 心法 : 默认心法
}

export const 获取心法数据 = async (心法?): Promise<心法配置类型> => {
  const 页面参数 = 获取页面参数('xf') || ''
  const 应显示心法 = 获取可用心法(简写映射?.[页面参数])
  const 目标心法 = 获取可用心法(心法 || 应显示心法)

  const 加载数据 = await 心法加载器[目标心法]()
  const 目标心法数据 = 加载数据?.default

  if (window) {
    if (window?.心法 !== 目标心法) {
      window.心法 = 目标心法
      if (目标心法数据?.系统配置?.心法图标) {
        修改页面Logo(目标心法数据?.系统配置?.心法图标)
        document.title = `${目标心法}-配装计算器`
      }
    }
  }
  return {
    ...目标心法数据,
  }
}

const 修改页面Logo = (src) => {
  let link: any = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.getElementsByTagName('head')[0].appendChild(link)
  }
  link.href = src
}

const 获取页面参数 = (param) => {
  if (globalThis?.心法 && param === '心法') {
    return globalThis?.心法
  } else if (globalThis?.xf && param === 'xf') {
    return globalThis?.xf
  } else if (window) {
    if (window?.location?.search) {
      const urlParams = new URLSearchParams(window?.location?.search)
      return urlParams.get(param)
    }
  }
  return ''
}
