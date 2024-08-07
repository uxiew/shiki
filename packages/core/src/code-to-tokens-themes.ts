import type {
  CodeToTokensWithThemesOptions,
  ShikiInternal,
  ThemedToken,
  ThemedTokenWithVariants,
  ThemeRegistrationResolved,
} from './types'
import { codeToTokensBase } from './code-to-tokens-base'
import { ShikiError } from './error'

/**
 * Get tokens with multiple themes
 */
export function codeToTokensWithThemes(
  internal: ShikiInternal,
  code: string,
  options: CodeToTokensWithThemesOptions,
): ThemedTokenWithVariants[][] {
  const themes = Object.entries(options.themes)
    .filter(i => i[1])
    .map(i => ({ color: i[0], theme: i[1]! }))

  const _gstheme = options.grammarState?.theme
  let gsThemeIncluded  = false

  const tokens = syncThemesTokenization(
    ...themes.map(t => {
    
      const themeName = typeof t.theme === 'string' 
      ? t.theme : ((t.theme as ThemeRegistrationResolved).name)

      if (options.grammarState) {
        if(_gstheme === themeName){
           gsThemeIncluded = true
        }
        options.grammarState.theme = themeName
      }

      return codeToTokensBase(internal, code, {
        ...options,
        theme: t.theme,
      })
    }),
  )
  
  if(options.grammarState) {
    options.grammarState.theme = _gstheme!

    if (!gsThemeIncluded) {
      throw new ShikiError(`Grammar state theme "${_gstheme}" is not in \`themes\``)
    }
  }


  const mergedTokens: ThemedTokenWithVariants[][] = tokens[0]
    .map((line, lineIdx) => line
      .map((_token, tokenIdx) => {
        const mergedToken: ThemedTokenWithVariants = {
          content: _token.content,
          variants: {},
          offset: _token.offset,
        }

        if (options.includeExplanation) {
          mergedToken.explanation = _token.explanation
        }

        tokens.forEach((t, themeIdx) => {
          const {
            content: _,
            explanation: __,
            offset: ___,
            ...styles
          } = t[lineIdx][tokenIdx]

          mergedToken.variants[themes[themeIdx].color] = styles
        })

        return mergedToken
      }),
    )

  return mergedTokens
}

/**
 * Break tokens from multiple themes into same tokenization.
 *
 * For example, given two themes that tokenize `console.log("hello")` as:
 *
 * - `console . log (" hello ")` (6 tokens)
 * - `console .log ( "hello" )` (5 tokens)
 *
 * This function will return:
 *
 * - `console . log ( " hello " )` (8 tokens)
 * - `console . log ( " hello " )` (8 tokens)
 */
export function syncThemesTokenization(...themes: ThemedToken[][][]) {
  const outThemes = themes.map<ThemedToken[][]>(() => [])
  const count = themes.length

  for (let i = 0; i < themes[0].length; i++) {
    const lines = themes.map(t => t[i])

    const outLines = outThemes.map<ThemedToken[]>(() => [])
    outThemes.forEach((t, i) => t.push(outLines[i]))

    const indexes = lines.map(() => 0)
    const current = lines.map(l => l[0])

    while (current.every(t => t)) {
      const minLength = Math.min(...current.map(t => t.content.length))

      for (let n = 0; n < count; n++) {
        const token = current[n]
        if (token.content.length === minLength) {
          outLines[n].push(token)
          indexes[n] += 1
          current[n] = lines[n][indexes[n]]
        }
        else {
          outLines[n].push({
            ...token,
            content: token.content.slice(0, minLength),
          })
          current[n] = {
            ...token,
            content: token.content.slice(minLength),
            offset: token.offset + minLength,
          }
        }
      }
    }
  }

  return outThemes
}
