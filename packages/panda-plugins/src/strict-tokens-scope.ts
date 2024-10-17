import type {
  CodegenPrepareHookArgs,
  CssProperties,
  LoggerInterface,
  PandaPlugin,
  TokenCategory,
} from '@pandacss/types'
import type { PandaContext } from '@pandacss/node'

export interface StrictTokensScopeOptions {
  categories?: TokenCategory[]
  excludeCategories?: TokenCategory[]
  props?: Array<keyof CssProperties | (string & {})>
}

const allCategories = [
  'zIndex',
  'opacity',
  'colors','fonts',
  'fontSizes',
  'fontWeights',
  'lineHeights',
  'letterSpacings',
  'sizes',
  'shadows',
  'spacing',
  'radii',
  'borders',
  'durations',
  'easings',
  'animations',
  'blurs',
  'gradients',
  'assets',
  'borderWidths',
  'aspectRatios',
  'containerNames',
] as const satisfies TokenCategory[]

/**
 * Enforce `strictTokens` only for a set of `TokenCategory` or style props
 * - `categories`: Every properties bound to those token categories will be restricted with `strictTokens`
 * - `excludeCategories`: Every properties bound to those token categories will be excluded from `strictTokens`
 * - `props`: Explicit list of props that will be restricted with `strictTokens`
 *
 * @see https://panda-css.com/docs/concepts/writing-styles#type-safety
 */
export const pluginStrictTokensScope = (options: StrictTokensScopeOptions): PandaPlugin => {
  let logger: LoggerInterface
  let ctx: PandaContext

  return {
    name: 'strict-tokens-scope',
    hooks: {
      'context:created': (context) => {
        logger = context.logger
        // @ts-expect-error
        ctx = context.ctx.processor.context
      },
      'codegen:prepare': (args) => {
        return transformPropTypes(args, options, ctx, logger)
      },
    },
  }
}

export const transformPropTypes = (
  args: CodegenPrepareHookArgs,
  options: StrictTokensScopeOptions,
  ctx: PandaContext,
  logger?: LoggerInterface,
) => {
  const { categories = [], excludeCategories = [], props = [] } = options
  if (!categories.length && !excludeCategories.length && !props.length) return args.artifacts
  const targetCategories = (categories.length ? categories : allCategories).filter((x) => !excludeCategories.includes(x))

  const artifact = args.artifacts.find((x) => x.id === 'types-styles')
  const content = artifact?.files.find((x) => x.file.includes('style-props'))
  if (!content?.code) return args.artifacts

  const shorthandsByProp = new Map<string, string[]>()
  ctx.utility.shorthands.forEach((longhand, shorthand) => {
    shorthandsByProp.set(longhand, (shorthandsByProp.get(longhand) ?? []).concat(shorthand))
  })

  const types = ctx.utility.getTypes()
  const categoryByProp = new Map<string, TokenCategory>()
  types.forEach((values, prop) => {
    const categoryType = values.find((type) => type.includes('Tokens['))
    if (!categoryType) return

    const tokenCategory = categoryType.replace('Tokens["', '').replace('"]', '') as TokenCategory
    if (!targetCategories.includes(tokenCategory)) {
      return
    }

    categoryByProp.set(prop, tokenCategory)
    const shorthands = shorthandsByProp.get(prop)

    if (!shorthands) return
    shorthands.forEach((shorthand) => {
      categoryByProp.set(shorthand, tokenCategory)
    })
  })

  const strictTokenProps = props.concat(Array.from(categoryByProp.keys()))
  if (!strictTokenProps.length) return args.artifacts

  if (logger) {
    logger.debug('plugin:restrict-strict-tokens', `🐼  Exclude token props: ${strictTokenProps.join(', ')}`)
  }

  // const regex = new RegExp(`(${strictTokenProps.join('|')})\?: ConditionalValue<WithEscapeHatch<(.+)>>`, 'g')
  const regex = /(\w+)\?: ConditionalValue<WithEscapeHatch<(.+)>>/g

  const transformed =
    content.code.replace(regex, (match, prop, value) => {
      // console.log({ match, prop, value, shouldBeStrict: strictTokenProps.includes(prop) })
      if (strictTokenProps.includes(prop)) return match

      const longhand = ctx.utility.shorthands.get(prop)
      // console.log({ prop, longhand, isStrict: strictTokenProps.includes(prop) })
      if (value.includes('CssProperties')) return match
      return `${prop}?: ConditionalValue<${value} | CssProperties["${longhand || prop}"]>`
    }) +
    [
      `\n\ntype StrictTokenProps = ${strictTokenProps.map((t) => `"${t}"`).join(' | ')}`,
      `type Restrict<Key, Value, Fallback> = Key extends StrictTokenProps ? Value : Value | Fallback`,
    ].join('\n\n')

  content.code = transformed
  return args.artifacts
}
