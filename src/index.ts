export interface MinimatchOptions {
  nobrace?: boolean
  nocomment?: boolean
  nonegate?: boolean
  debug?: boolean
  noglobstar?: boolean
  noext?: boolean
  nonull?: boolean
  windowsPathsNoEscape?: boolean
  allowWindowsEscape?: boolean
  partial?: boolean
  dot?: boolean
  nocase?: boolean
  nocaseMagicOnly?: boolean
  matchBase?: boolean
  flipNegate?: boolean
  preserveMultipleSlashes?: boolean
  optimizationLevel?: number
  platform?: typeof process.platform
  windowsNoMagicRoot?: boolean
}

export const minimatch = (
  p: string,
  pattern: string,
  options: MinimatchOptions = {}
) => {
  assertValidPattern(pattern)

  // shortcut: comments match nothing.
  if (!options.nocomment && pattern.charAt(0) === '#') {
    return false
  }

  return new Minimatch(pattern, options).match(p)
}

export default minimatch

// Optimized checking for the most common glob patterns.
const starDotExtRE = /^\*+([^+@!?\*\[\(]*)$/
const starDotExtTest = (ext: string) => (f: string) =>
  !f.startsWith('.') && f.endsWith(ext)
const starDotExtTestDot = (ext: string) => (f: string) => f.endsWith(ext)
const starDotExtTestNocase = (ext: string) => {
  ext = ext.toLowerCase()
  return (f: string) => !f.startsWith('.') && f.toLowerCase().endsWith(ext)
}
const starDotExtTestNocaseDot = (ext: string) => {
  ext = ext.toLowerCase()
  return (f: string) => f.toLowerCase().endsWith(ext)
}
const starDotStarRE = /^\*+\.\*+$/
const starDotStarTest = (f: string) => !f.startsWith('.') && f.includes('.')
const starDotStarTestDot = (f: string) =>
  f !== '.' && f !== '..' && f.includes('.')
const dotStarRE = /^\.\*+$/
const dotStarTest = (f: string) => f !== '.' && f !== '..' && f.startsWith('.')
const starRE = /^\*+$/
const starTest = (f: string) => f.length !== 0 && !f.startsWith('.')
const starTestDot = (f: string) => f.length !== 0 && f !== '.' && f !== '..'
const qmarksRE = /^\?+([^+@!?\*\[\(]*)?$/
const qmarksTestNocase = ([$0, ext = '']: RegExpMatchArray) => {
  const noext = qmarksTestNoExt([$0])
  if (!ext) return noext
  ext = ext.toLowerCase()
  return (f: string) => noext(f) && f.toLowerCase().endsWith(ext)
}
const qmarksTestNocaseDot = ([$0, ext = '']: RegExpMatchArray) => {
  const noext = qmarksTestNoExtDot([$0])
  if (!ext) return noext
  ext = ext.toLowerCase()
  return (f: string) => noext(f) && f.toLowerCase().endsWith(ext)
}
const qmarksTestDot = ([$0, ext = '']: RegExpMatchArray) => {
  const noext = qmarksTestNoExtDot([$0])
  return !ext ? noext : (f: string) => noext(f) && f.endsWith(ext)
}
const qmarksTest = ([$0, ext = '']: RegExpMatchArray) => {
  const noext = qmarksTestNoExt([$0])
  return !ext ? noext : (f: string) => noext(f) && f.endsWith(ext)
}
const qmarksTestNoExt = ([$0]: RegExpMatchArray) => {
  const len = $0.length
  return (f: string) => f.length === len && !f.startsWith('.')
}
const qmarksTestNoExtDot = ([$0]: RegExpMatchArray) => {
  const len = $0.length
  return (f: string) => f.length === len && f !== '.' && f !== '..'
}

type Platform = typeof process.platform
/* c8 ignore start */
const defaultPlatform: Platform = (
  typeof process === 'object' && process
    ? (typeof process.env === 'object' &&
        process.env &&
        process.env.__MINIMATCH_TESTING_PLATFORM__) ||
      process.platform
    : 'posix'
) as Platform
type Sep = '\\' | '/'
const path: { [k: string]: { sep: Sep } } = {
  win32: { sep: '\\' },
  posix: { sep: '/' },
}
/* c8 ignore stop */

export const sep = defaultPlatform === 'win32' ? path.win32.sep : path.posix.sep
minimatch.sep = sep

export const GLOBSTAR = Symbol('globstar **')
minimatch.GLOBSTAR = GLOBSTAR
import expand from 'brace-expansion'

const plTypes = {
  '!': { open: '(?:(?!(?:', close: '))[^/]*?)' },
  '?': { open: '(?:', close: ')?' },
  '+': { open: '(?:', close: ')+' },
  '*': { open: '(?:', close: ')*' },
  '@': { open: '(?:', close: ')' },
}
type StateChar = '!' | '?' | '+' | '*' | '@'

// any single thing other than /
// don't need to escape / when using new RegExp()
const qmark = '[^/]'

// * => any number of characters
const star = qmark + '*?'

// ** when dots are allowed.  Anything goes, except .. and .
// not (^ or / followed by one or two dots followed by $ or /),
// followed by anything, any number of times.
const twoStarDot = '(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?'

// not a ^ or / followed by a dot,
// followed by anything, any number of times.
const twoStarNoDot = '(?:(?!(?:\\/|^)\\.).)*?'

// "abc" -> { a:true, b:true, c:true }
const charSet = (s: string) =>
  s.split('').reduce((set: { [k: string]: boolean }, c) => {
    set[c] = true
    return set
  }, {})

// characters that need to be escaped in RegExp.
const reSpecials = charSet('().*{}+?[]^$\\!')

// characters that indicate we have to add the pattern start
const addPatternStartSet = charSet('[.(')

export const filter =
  (pattern: string, options: MinimatchOptions = {}) =>
  (p: string) =>
    minimatch(p, pattern, options)
minimatch.filter = filter

const ext = (a: MinimatchOptions, b: MinimatchOptions = {}) =>
  Object.assign({}, a, b)

export const defaults = (def: MinimatchOptions): typeof minimatch => {
  if (!def || typeof def !== 'object' || !Object.keys(def).length) {
    return minimatch
  }

  const orig = minimatch

  const m = (p: string, pattern: string, options: MinimatchOptions = {}) =>
    orig(p, pattern, ext(def, options))

  return Object.assign(m, {
    Minimatch: class Minimatch extends orig.Minimatch {
      constructor(pattern: string, options: MinimatchOptions = {}) {
        super(pattern, ext(def, options))
      }
      static defaults(options: MinimatchOptions) {
        return orig.defaults(ext(def, options)).Minimatch
      }
    },

    filter: (pattern: string, options: MinimatchOptions = {}) =>
      orig.filter(pattern, ext(def, options)),

    defaults: (options: MinimatchOptions) => orig.defaults(ext(def, options)),

    makeRe: (pattern: string, options: MinimatchOptions = {}) =>
      orig.makeRe(pattern, ext(def, options)),

    braceExpand: (pattern: string, options: MinimatchOptions = {}) =>
      orig.braceExpand(pattern, ext(def, options)),

    match: (list: string[], pattern: string, options: MinimatchOptions = {}) =>
      orig.match(list, pattern, ext(def, options)),

    sep: orig.sep,
    GLOBSTAR: GLOBSTAR as typeof GLOBSTAR,
  })
}
minimatch.defaults = defaults

// Brace expansion:
// a{b,c}d -> abd acd
// a{b,}c -> abc ac
// a{0..3}d -> a0d a1d a2d a3d
// a{b,c{d,e}f}g -> abg acdfg acefg
// a{b,c}d{e,f}g -> abdeg acdeg abdeg abdfg
//
// Invalid sets are not expanded.
// a{2..}b -> a{2..}b
// a{b}c -> a{b}c
export const braceExpand = (
  pattern: string,
  options: MinimatchOptions = {}
) => {
  assertValidPattern(pattern)

  // Thanks to Yeting Li <https://github.com/yetingli> for
  // improving this regexp to avoid a ReDOS vulnerability.
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    // shortcut. no need to expand.
    return [pattern]
  }

  return expand(pattern)
}
minimatch.braceExpand = braceExpand

const MAX_PATTERN_LENGTH = 1024 * 64
const assertValidPattern: (pattern: any) => void = (
  pattern: any
): asserts pattern is string => {
  if (typeof pattern !== 'string') {
    throw new TypeError('invalid pattern')
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError('pattern is too long')
  }
}

// parse a component of the expanded set.
// At this point, no pattern may contain "/" in it
// so we're going to return a 2d array, where each entry is the full
// pattern, split on '/', and then turned into a regular expression.
// A regexp is made at the end which joins each array with an
// escaped /, and another full one which joins each regexp with |.
//
// Following the lead of Bash 4.1, note that "**" only has special meaning
// when it is the *only* thing in a path portion.  Otherwise, any series
// of * is equivalent to a single *.  Globstar behavior is enabled by
// default, and can be disabled by setting options.noglobstar.
const SUBPARSE = Symbol('subparse')

export const makeRe = (pattern: string, options: MinimatchOptions = {}) =>
  new Minimatch(pattern, options).makeRe()
minimatch.makeRe = makeRe

export const match = (
  list: string[],
  pattern: string,
  options: MinimatchOptions = {}
) => {
  const mm = new Minimatch(pattern, options)
  list = list.filter(f => mm.match(f))
  if (mm.options.nonull && !list.length) {
    list.push(pattern)
  }
  return list
}
minimatch.match = match

// replace stuff like \* with *
const globUnescape = (s: string) => s.replace(/\\(.)/g, '$1')
const globMagic = /[?*]|[+@!]\(.*?\)|\[|\]/
const charUnescape = (s: string) => s.replace(/\\([^-\]])/g, '$1')
const regExpEscape = (s: string) =>
  s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
const braExpEscape = (s: string) => s.replace(/[[\]\\]/g, '\\$&')

interface PatternListEntry {
  type: string
  start: number
  reStart: number
  open: string
  close: string
}
interface NegativePatternListEntry extends PatternListEntry {
  reEnd: number
}

export type MMRegExp = RegExp & {
  _src?: string
  _glob?: string
}

type SubparseReturn = [string, boolean]
type ParseReturnFiltered = string | MMRegExp | typeof GLOBSTAR
type ParseReturn = ParseReturnFiltered | false

export class Minimatch {
  options: MinimatchOptions
  set: ParseReturnFiltered[][]
  pattern: string

  windowsPathsNoEscape: boolean
  nonegate: boolean
  negate: boolean
  comment: boolean
  empty: boolean
  preserveMultipleSlashes: boolean
  partial: boolean
  globSet: string[]
  globParts: string[][]
  nocase: boolean

  isWindows: boolean
  platform: typeof process.platform
  windowsNoMagicRoot: boolean

  regexp: false | null | MMRegExp
  constructor(pattern: string, options: MinimatchOptions = {}) {
    assertValidPattern(pattern)

    options = options || {}
    this.options = options
    this.pattern = pattern
    this.platform = options.platform || defaultPlatform
    this.isWindows = this.platform === 'win32'
    this.windowsPathsNoEscape =
      !!options.windowsPathsNoEscape || options.allowWindowsEscape === false
    if (this.windowsPathsNoEscape) {
      this.pattern = this.pattern.replace(/\\/g, '/')
    }
    this.preserveMultipleSlashes = !!options.preserveMultipleSlashes
    this.regexp = null
    this.negate = false
    this.nonegate = !!options.nonegate
    this.comment = false
    this.empty = false
    this.partial = !!options.partial
    this.nocase = !!this.options.nocase
    this.windowsNoMagicRoot =
      options.windowsNoMagicRoot !== undefined
        ? options.windowsNoMagicRoot
        : !!(this.isWindows && this.nocase)

    this.globSet = []
    this.globParts = []
    this.set = []

    // make the set of regexps etc.
    this.make()
  }

  debug(..._: any[]) {}

  make() {
    const pattern = this.pattern
    const options = this.options

    // empty patterns and comments match nothing.
    if (!options.nocomment && pattern.charAt(0) === '#') {
      this.comment = true
      return
    }

    if (!pattern) {
      this.empty = true
      return
    }

    // step 1: figure out negation, etc.
    this.parseNegate()

    // step 2: expand braces
    this.globSet = [...new Set(this.braceExpand())]

    if (options.debug) {
      this.debug = (...args: any[]) => console.error(...args)
    }

    this.debug(this.pattern, this.globSet)

    // step 3: now we have a set, so turn each one into a series of
    // path-portion matching patterns.
    // These will be regexps, except in the case of "**", which is
    // set to the GLOBSTAR object for globstar behavior,
    // and will not contain any / characters
    //
    // First, we preprocess to make the glob pattern sets a bit simpler
    // and deduped.  There are some perf-killing patterns that can cause
    // problems with a glob walk, but we can simplify them down a bit.
    const rawGlobParts = this.globSet.map(s => this.slashSplit(s))
    this.globParts = this.preprocess(rawGlobParts)
    this.debug(this.pattern, this.globParts)

    // glob --> regexps
    let set = this.globParts.map((s, _, __) => {
      if (this.isWindows && this.windowsNoMagicRoot) {
        // check if it's a drive or unc path.
        const isUNC =
          s[0] === '' &&
          s[1] === '' &&
          (s[2] === '?' || !globMagic.test(s[2])) &&
          !globMagic.test(s[3])
        const isDrive = /^[a-z]:/i.test(s[0])
        if (isUNC) {
          return [...s.slice(0, 4), ...s.slice(4).map(ss => this.parse(ss))]
        } else if (isDrive) {
          return [s[0], ...s.slice(1).map(ss => this.parse(ss))]
        }
      }
      return s.map(ss => this.parse(ss))
    })

    this.debug(this.pattern, set)

    // filter out everything that didn't compile properly.
    this.set = set.filter(
      s => s.indexOf(false) === -1
    ) as ParseReturnFiltered[][]

    // do not treat the ? in UNC paths as magic
    if (this.isWindows) {
      for (let i = 0; i < this.set.length; i++) {
        const p = this.set[i]
        if (
          p[0] === '' &&
          p[1] === '' &&
          this.globParts[i][2] === '?' &&
          typeof p[3] === 'string' &&
          /^[a-z]:$/i.test(p[3])
        ) {
          p[2] = '?'
        }
      }
    }

    this.debug(this.pattern, this.set)
  }

  // various transforms to equivalent pattern sets that are
  // faster to process in a filesystem walk.  The goal is to
  // eliminate what we can, and push all ** patterns as far
  // to the right as possible, even if it increases the number
  // of patterns that we have to process.
  preprocess(globParts: string[][]) {
    // if we're not in globstar mode, then turn all ** into *
    if (this.options.noglobstar) {
      for (let i = 0; i < globParts.length; i++) {
        for (let j = 0; j < globParts[i].length; j++) {
          if (globParts[i][j] === '**') {
            globParts[i][j] = '*'
          }
        }
      }
    }

    const { optimizationLevel = 1 } = this.options

    if (optimizationLevel >= 2) {
      // aggressive optimization for the purpose of fs walking
      globParts = this.firstPhasePreProcess(globParts)
      globParts = this.secondPhasePreProcess(globParts)
    } else if (optimizationLevel >= 1) {
      // just basic optimizations to remove some .. parts
      globParts = this.levelOneOptimize(globParts)
    } else {
      globParts = this.adjascentGlobstarOptimize(globParts)
    }

    return globParts
  }

  // just get rid of adjascent ** portions
  adjascentGlobstarOptimize(globParts: string[][]) {
    return globParts.map(parts => {
      let gs: number = -1
      while (-1 !== (gs = parts.indexOf('**', gs + 1))) {
        let i = gs
        while (parts[i + 1] === '**') {
          i++
        }
        if (i !== gs) {
          parts.splice(gs, i - gs)
        }
      }
      return parts
    })
  }

  // get rid of adjascent ** and resolve .. portions
  levelOneOptimize(globParts: string[][]) {
    return globParts.map(parts => {
      parts = parts.reduce((set: string[], part) => {
        const prev = set[set.length - 1]
        if (part === '**' && prev === '**') {
          return set
        }
        if (part === '..') {
          if (prev && prev !== '..' && prev !== '.' && prev !== '**') {
            set.pop()
            return set
          }
        }
        set.push(part)
        return set
      }, [])
      return parts.length === 0 ? [''] : parts
    })
  }

  levelTwoFileOptimize(parts: string | string[]) {
    if (!Array.isArray(parts)) {
      parts = this.slashSplit(parts)
    }
    let didSomething: boolean = false
    do {
      didSomething = false
      // <pre>/<e>/<rest> -> <pre>/<rest>
      if (!this.preserveMultipleSlashes) {
        for (let i = 1; i < parts.length - 1; i++) {
          const p = parts[i]
          // don't squeeze out UNC patterns
          if (i === 1 && p === '' && parts[0] === '') continue
          if (p === '.' || p === '') {
            didSomething = true
            parts.splice(i, 1)
            i--
          }
        }
        if (
          parts[0] === '.' &&
          parts.length === 2 &&
          (parts[1] === '.' || parts[1] === '')
        ) {
          didSomething = true
          parts.pop()
        }
      }

      // <pre>/<p>/../<rest> -> <pre>/<rest>
      let dd: number = 0
      while (-1 !== (dd = parts.indexOf('..', dd + 1))) {
        const p = parts[dd - 1]
        if (p && p !== '.' && p !== '..' && p !== '**') {
          didSomething = true
          parts.splice(dd - 1, 2)
          dd -= 2
        }
      }
    } while (didSomething)
    return parts.length === 0 ? [''] : parts
  }

  // First phase: single-pattern processing
  // <pre> is 1 or more portions
  // <rest> is 1 or more portions
  // <p> is any portion other than ., .., '', or **
  // <e> is . or ''
  //
  // **/.. is *brutal* for filesystem walking performance, because
  // it effectively resets the recursive walk each time it occurs,
  // and ** cannot be reduced out by a .. pattern part like a regexp
  // or most strings (other than .., ., and '') can be.
  //
  // <pre>/**/../<p>/<p>/<rest> -> {<pre>/../<p>/<p>/<rest>,<pre>/**/<p>/<p>/<rest>}
  // <pre>/<e>/<rest> -> <pre>/<rest>
  // <pre>/<p>/../<rest> -> <pre>/<rest>
  // **/**/<rest> -> **/<rest>
  //
  // **/*/<rest> -> */**/<rest> <== not valid because ** doesn't follow
  // this WOULD be allowed if ** did follow symlinks, or * didn't
  firstPhasePreProcess(globParts: string[][]) {
    let didSomething = false
    do {
      didSomething = false
      // <pre>/**/../<p>/<p>/<rest> -> {<pre>/../<p>/<p>/<rest>,<pre>/**/<p>/<p>/<rest>}
      for (let parts of globParts) {
        let gs: number = -1
        while (-1 !== (gs = parts.indexOf('**', gs + 1))) {
          let gss: number = gs
          while (parts[gss + 1] === '**') {
            // <pre>/**/**/<rest> -> <pre>/**/<rest>
            gss++
          }
          // eg, if gs is 2 and gss is 4, that means we have 3 **
          // parts, and can remove 2 of them.
          if (gss > gs) {
            parts.splice(gs + 1, gss - gs)
          }

          let next = parts[gs + 1]
          const p = parts[gs + 2]
          const p2 = parts[gs + 3]
          if (next !== '..') continue
          if (
            !p ||
            p === '.' ||
            p === '..' ||
            !p2 ||
            p2 === '.' ||
            p2 === '..'
          ) {
            continue
          }
          didSomething = true
          // edit parts in place, and push the new one
          parts.splice(gs, 1)
          const other = parts.slice(0)
          other[gs] = '**'
          globParts.push(other)
          gs--
        }

        // <pre>/<e>/<rest> -> <pre>/<rest>
        if (!this.preserveMultipleSlashes) {
          for (let i = 1; i < parts.length - 1; i++) {
            const p = parts[i]
            // don't squeeze out UNC patterns
            if (i === 1 && p === '' && parts[0] === '') continue
            if (p === '.' || p === '') {
              didSomething = true
              parts.splice(i, 1)
              i--
            }
          }
          if (
            parts[0] === '.' &&
            parts.length === 2 &&
            (parts[1] === '.' || parts[1] === '')
          ) {
            didSomething = true
            parts.pop()
          }
        }

        // <pre>/<p>/../<rest> -> <pre>/<rest>
        let dd: number = 0
        while (-1 !== (dd = parts.indexOf('..', dd + 1))) {
          const p = parts[dd - 1]
          if (p && p !== '.' && p !== '..' && p !== '**') {
            didSomething = true
            const needDot = dd === 1 && parts[dd + 1] === '**'
            const splin = needDot ? ['.'] : []
            parts.splice(dd - 1, 2, ...splin)
            if (parts.length === 0) parts.push('')
            dd -= 2
          }
        }
      }
    } while (didSomething)

    return globParts
  }

  // second phase: multi-pattern dedupes
  // {<pre>/*/<rest>,<pre>/<p>/<rest>} -> <pre>/*/<rest>
  // {<pre>/<rest>,<pre>/<rest>} -> <pre>/<rest>
  // {<pre>/**/<rest>,<pre>/<rest>} -> <pre>/**/<rest>
  //
  // {<pre>/**/<rest>,<pre>/**/<p>/<rest>} -> <pre>/**/<rest>
  // ^-- not valid because ** doens't follow symlinks
  secondPhasePreProcess(globParts: string[][]): string[][] {
    for (let i = 0; i < globParts.length - 1; i++) {
      for (let j = i + 1; j < globParts.length; j++) {
        const matched = this.partsMatch(
          globParts[i],
          globParts[j],
          !this.preserveMultipleSlashes
        )
        if (!matched) continue
        globParts[i] = matched
        globParts[j] = []
      }
    }
    return globParts.filter(gs => gs.length)
  }

  partsMatch(
    a: string[],
    b: string[],
    emptyGSMatch: boolean = false
  ): false | string[] {
    let ai = 0
    let bi = 0
    let result: string[] = []
    let which: string = ''
    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        result.push(which === 'b' ? b[bi] : a[ai])
        ai++
        bi++
      } else if (emptyGSMatch && a[ai] === '**' && b[bi] === a[ai + 1]) {
        result.push(a[ai])
        ai++
      } else if (emptyGSMatch && b[bi] === '**' && a[ai] === b[bi + 1]) {
        result.push(b[bi])
        bi++
      } else if (
        a[ai] === '*' &&
        b[bi] &&
        (this.options.dot || !b[bi].startsWith('.')) &&
        b[bi] !== '**'
      ) {
        if (which === 'b') return false
        which = 'a'
        result.push(a[ai])
        ai++
        bi++
      } else if (
        b[bi] === '*' &&
        a[ai] &&
        (this.options.dot || !a[ai].startsWith('.')) &&
        a[ai] !== '**'
      ) {
        if (which === 'a') return false
        which = 'b'
        result.push(b[bi])
        ai++
        bi++
      } else {
        return false
      }
    }
    // if we fall out of the loop, it means they two are identical
    // as long as their lengths match
    return a.length === b.length && result
  }

  parseNegate() {
    if (this.nonegate) return

    const pattern = this.pattern
    let negate = false
    let negateOffset = 0

    for (let i = 0; i < pattern.length && pattern.charAt(i) === '!'; i++) {
      negate = !negate
      negateOffset++
    }

    if (negateOffset) this.pattern = pattern.slice(negateOffset)
    this.negate = negate
  }

  // set partial to true to test if, for example,
  // "/a/b" matches the start of "/*/b/*/d"
  // Partial means, if you run out of file before you run
  // out of pattern, then that's fine, as long as all
  // the parts match.
  matchOne(file: string[], pattern: ParseReturn[], partial: boolean = false) {
    const options = this.options

    // a UNC pattern like //?/c:/* can match a path like c:/x
    // and vice versa
    if (this.isWindows) {
      const fileUNC =
        file[0] === '' &&
        file[1] === '' &&
        file[2] === '?' &&
        typeof file[3] === 'string' &&
        /^[a-z]:$/i.test(file[3])
      const patternUNC =
        pattern[0] === '' &&
        pattern[1] === '' &&
        pattern[2] === '?' &&
        typeof pattern[3] === 'string' &&
        /^[a-z]:$/i.test(pattern[3])

      if (fileUNC && patternUNC) {
        const fd = file[3] as string
        const pd = pattern[3] as string
        if (fd.toLowerCase() === pd.toLowerCase()) {
          file[3] = pd
        }
      } else if (patternUNC && typeof file[0] === 'string') {
        const pd = pattern[3] as string
        const fd = file[0]
        if (pd.toLowerCase() === fd.toLowerCase()) {
          pattern[3] = fd
          pattern = pattern.slice(3)
        }
      } else if (fileUNC && typeof pattern[0] === 'string') {
        const fd = file[3]
        if (fd.toLowerCase() === pattern[0].toLowerCase()) {
          pattern[0] = fd
          file = file.slice(3)
        }
      }
    }

    // resolve and reduce . and .. portions in the file as well.
    // dont' need to do the second phase, because it's only one string[]
    const { optimizationLevel = 1 } = this.options
    if (optimizationLevel >= 2) {
      file = this.levelTwoFileOptimize(file)
    }

    this.debug('matchOne', this, { file, pattern })
    this.debug('matchOne', file.length, pattern.length)

    for (
      var fi = 0, pi = 0, fl = file.length, pl = pattern.length;
      fi < fl && pi < pl;
      fi++, pi++
    ) {
      this.debug('matchOne loop')
      var p = pattern[pi]
      var f = file[fi]

      this.debug(pattern, p, f)

      // should be impossible.
      // some invalid regexp stuff in the set.
      /* c8 ignore start */
      if (p === false) {
        return false
      }
      /* c8 ignore stop */

      if (p === GLOBSTAR) {
        this.debug('GLOBSTAR', [pattern, p, f])

        // "**"
        // a/**/b/**/c would match the following:
        // a/b/x/y/z/c
        // a/x/y/z/b/c
        // a/b/x/b/x/c
        // a/b/c
        // To do this, take the rest of the pattern after
        // the **, and see if it would match the file remainder.
        // If so, return success.
        // If not, the ** "swallows" a segment, and try again.
        // This is recursively awful.
        //
        // a/**/b/**/c matching a/b/x/y/z/c
        // - a matches a
        // - doublestar
        //   - matchOne(b/x/y/z/c, b/**/c)
        //     - b matches b
        //     - doublestar
        //       - matchOne(x/y/z/c, c) -> no
        //       - matchOne(y/z/c, c) -> no
        //       - matchOne(z/c, c) -> no
        //       - matchOne(c, c) yes, hit
        var fr = fi
        var pr = pi + 1
        if (pr === pl) {
          this.debug('** at the end')
          // a ** at the end will just swallow the rest.
          // We have found a match.
          // however, it will not swallow /.x, unless
          // options.dot is set.
          // . and .. are *never* matched by **, for explosively
          // exponential reasons.
          for (; fi < fl; fi++) {
            if (
              file[fi] === '.' ||
              file[fi] === '..' ||
              (!options.dot && file[fi].charAt(0) === '.')
            )
              return false
          }
          return true
        }

        // ok, let's see if we can swallow whatever we can.
        while (fr < fl) {
          var swallowee = file[fr]

          this.debug('\nglobstar while', file, fr, pattern, pr, swallowee)

          // XXX remove this slice.  Just pass the start index.
          if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
            this.debug('globstar found match!', fr, fl, swallowee)
            // found a match.
            return true
          } else {
            // can't swallow "." or ".." ever.
            // can only swallow ".foo" when explicitly asked.
            if (
              swallowee === '.' ||
              swallowee === '..' ||
              (!options.dot && swallowee.charAt(0) === '.')
            ) {
              this.debug('dot detected!', file, fr, pattern, pr)
              break
            }

            // ** swallows a segment, and continue.
            this.debug('globstar swallow a segment, and continue')
            fr++
          }
        }

        // no match was found.
        // However, in partial mode, we can't say this is necessarily over.
        /* c8 ignore start */
        if (partial) {
          // ran out of file
          this.debug('\n>>> no match, partial?', file, fr, pattern, pr)
          if (fr === fl) {
            return true
          }
        }
        /* c8 ignore stop */
        return false
      }

      // something other than **
      // non-magic patterns just have to match exactly
      // patterns with magic have been turned into regexps.
      let hit: boolean
      if (typeof p === 'string') {
        hit = f === p
        this.debug('string match', p, f, hit)
      } else {
        hit = p.test(f)
        this.debug('pattern match', p, f, hit)
      }

      if (!hit) return false
    }

    // Note: ending in / means that we'll get a final ""
    // at the end of the pattern.  This can only match a
    // corresponding "" at the end of the file.
    // If the file ends in /, then it can only match a
    // a pattern that ends in /, unless the pattern just
    // doesn't have any more for it. But, a/b/ should *not*
    // match "a/b/*", even though "" matches against the
    // [^/]*? pattern, except in partial mode, where it might
    // simply not be reached yet.
    // However, a/b/ should still satisfy a/*

    // now either we fell off the end of the pattern, or we're done.
    if (fi === fl && pi === pl) {
      // ran out of pattern and filename at the same time.
      // an exact hit!
      return true
    } else if (fi === fl) {
      // ran out of file, but still had pattern left.
      // this is ok if we're doing the match as part of
      // a glob fs traversal.
      return partial
    } else if (pi === pl) {
      // ran out of pattern, still have file left.
      // this is only acceptable if we're on the very last
      // empty segment of a file with a trailing slash.
      // a/* should match a/b/
      return fi === fl - 1 && file[fi] === ''

      /* c8 ignore start */
    } else {
      // should be unreachable.
      throw new Error('wtf?')
    }
    /* c8 ignore stop */
  }

  braceExpand() {
    return braceExpand(this.pattern, this.options)
  }

  parse(
    pattern: string,
    isSub?: typeof SUBPARSE
  ): ParseReturn | SubparseReturn {
    assertValidPattern(pattern)

    const options = this.options

    // shortcuts
    if (pattern === '**') return GLOBSTAR
    if (pattern === '') return ''

    // far and away, the most common glob pattern parts are
    // *, *.*, and *.<ext>  Add a fast check method for those.
    let m: RegExpMatchArray | null
    let fastTest: null | ((f: string) => boolean) = null
    if (isSub !== SUBPARSE) {
      if ((m = pattern.match(starRE))) {
        fastTest = options.dot ? starTestDot : starTest
      } else if ((m = pattern.match(starDotExtRE))) {
        fastTest = (
          options.nocase
            ? options.dot
              ? starDotExtTestNocaseDot
              : starDotExtTestNocase
            : options.dot
            ? starDotExtTestDot
            : starDotExtTest
        )(m[1])
      } else if ((m = pattern.match(qmarksRE))) {
        fastTest = (
          options.nocase
            ? options.dot
              ? qmarksTestNocaseDot
              : qmarksTestNocase
            : options.dot
            ? qmarksTestDot
            : qmarksTest
        )(m)
      } else if ((m = pattern.match(starDotStarRE))) {
        fastTest = options.dot ? starDotStarTestDot : starDotStarTest
      } else if ((m = pattern.match(dotStarRE))) {
        fastTest = dotStarTest
      }
    }

    let re = ''
    let hasMagic = false
    let escaping = false
    // ? => one single character
    const patternListStack: PatternListEntry[] = []
    const negativeLists: NegativePatternListEntry[] = []
    let stateChar: StateChar | false = false
    let inClass = false
    let reClassStart = -1
    let classStart = -1
    let cs: string
    let pl: PatternListEntry | undefined
    let sp: SubparseReturn
    // . and .. never match anything that doesn't start with .,
    // even when options.dot is set.  However, if the pattern
    // starts with ., then traversal patterns can match.
    let dotTravAllowed = pattern.charAt(0) === '.'
    let dotFileAllowed = options.dot || dotTravAllowed
    const patternStart = () =>
      dotTravAllowed
        ? ''
        : dotFileAllowed
        ? '(?!(?:^|\\/)\\.{1,2}(?:$|\\/))'
        : '(?!\\.)'
    const subPatternStart = (p: string) =>
      p.charAt(0) === '.'
        ? ''
        : options.dot
        ? '(?!(?:^|\\/)\\.{1,2}(?:$|\\/))'
        : '(?!\\.)'

    const clearStateChar = () => {
      if (stateChar) {
        // we had some state-tracking character
        // that wasn't consumed by this pass.
        switch (stateChar) {
          case '*':
            re += star
            hasMagic = true
            break
          case '?':
            re += qmark
            hasMagic = true
            break
          default:
            re += '\\' + stateChar
            break
        }
        this.debug('clearStateChar %j %j', stateChar, re)
        stateChar = false
      }
    }

    for (
      let i = 0, c: string;
      i < pattern.length && (c = pattern.charAt(i));
      i++
    ) {
      this.debug('%s\t%s %s %j', pattern, i, re, c)

      // skip over any that are escaped.
      if (escaping) {
        // completely not allowed, even escaped.
        // should be impossible.
        /* c8 ignore start */
        if (c === '/') {
          return false
        }
        /* c8 ignore stop */

        if (reSpecials[c]) {
          re += '\\'
        }
        re += c
        escaping = false
        continue
      }

      switch (c) {
        // Should already be path-split by now.
        /* c8 ignore start */
        case '/': {
          return false
        }
        /* c8 ignore stop */

        case '\\':
          if (inClass && pattern.charAt(i + 1) === '-') {
            re += c
            continue
          }

          clearStateChar()
          escaping = true
          continue

        // the various stateChar values
        // for the "extglob" stuff.
        case '?':
        case '*':
        case '+':
        case '@':
        case '!':
          this.debug('%s\t%s %s %j <-- stateChar', pattern, i, re, c)

          // all of those are literals inside a class, except that
          // the glob [!a] means [^a] in regexp
          if (inClass) {
            this.debug('  in class')
            if (c === '!' && i === classStart + 1) c = '^'
            re += c
            continue
          }

          // if we already have a stateChar, then it means
          // that there was something like ** or +? in there.
          // Handle the stateChar, then proceed with this one.
          this.debug('call clearStateChar %j', stateChar)
          clearStateChar()
          stateChar = c
          // if extglob is disabled, then +(asdf|foo) isn't a thing.
          // just clear the statechar *now*, rather than even diving into
          // the patternList stuff.
          if (options.noext) clearStateChar()
          continue

        case '(': {
          if (inClass) {
            re += '('
            continue
          }

          if (!stateChar) {
            re += '\\('
            continue
          }

          const plEntry: PatternListEntry = {
            type: stateChar,
            start: i - 1,
            reStart: re.length,
            open: plTypes[stateChar].open,
            close: plTypes[stateChar].close,
          }
          this.debug(this.pattern, '\t', plEntry)
          patternListStack.push(plEntry)
          // negation is (?:(?!(?:js)(?:<rest>))[^/]*)
          re += plEntry.open
          // next entry starts with a dot maybe?
          if (plEntry.start === 0 && plEntry.type !== '!') {
            dotTravAllowed = true
            re += subPatternStart(pattern.slice(i + 1))
          }
          this.debug('plType %j %j', stateChar, re)
          stateChar = false
          continue
        }

        case ')': {
          const plEntry = patternListStack[patternListStack.length - 1]
          if (inClass || !plEntry) {
            re += '\\)'
            continue
          }
          patternListStack.pop()

          // closing an extglob
          clearStateChar()
          hasMagic = true
          pl = plEntry
          // negation is (?:(?!js)[^/]*)
          // The others are (?:<pattern>)<type>
          re += pl.close
          if (pl.type === '!') {
            negativeLists.push(Object.assign(pl, { reEnd: re.length }))
          }
          continue
        }

        case '|': {
          const plEntry = patternListStack[patternListStack.length - 1]
          if (inClass || !plEntry) {
            re += '\\|'
            continue
          }

          clearStateChar()
          re += '|'
          // next subpattern can start with a dot?
          if (plEntry.start === 0 && plEntry.type !== '!') {
            dotTravAllowed = true
            re += subPatternStart(pattern.slice(i + 1))
          }
          continue
        }

        // these are mostly the same in regexp and glob
        case '[':
          // swallow any state-tracking char before the [
          clearStateChar()

          if (inClass) {
            re += '\\' + c
            continue
          }

          inClass = true
          classStart = i
          reClassStart = re.length
          re += c
          continue

        case ']':
          //  a right bracket shall lose its special
          //  meaning and represent itself in
          //  a bracket expression if it occurs
          //  first in the list.  -- POSIX.2 2.8.3.2
          if (i === classStart + 1 || !inClass) {
            re += '\\' + c
            continue
          }

          // split where the last [ was, make sure we don't have
          // an invalid re. if so, re-walk the contents of the
          // would-be class to re-translate any characters that
          // were passed through as-is
          // TODO: It would probably be faster to determine this
          // without a try/catch and a new RegExp, but it's tricky
          // to do safely.  For now, this is safe and works.
          cs = pattern.substring(classStart + 1, i)
          try {
            RegExp('[' + braExpEscape(charUnescape(cs)) + ']')
            // looks good, finish up the class.
            re += c
          } catch (er) {
            // out of order ranges in JS are errors, but in glob syntax,
            // they're just a range that matches nothing.
            re = re.substring(0, reClassStart) + '(?:$.)' // match nothing ever
          }
          hasMagic = true
          inClass = false
          continue

        default:
          // swallow any state char that wasn't consumed
          clearStateChar()

          if (reSpecials[c] && !(c === '^' && inClass)) {
            re += '\\'
          }

          re += c
          break
      } // switch
    } // for

    // handle the case where we left a class open.
    // "[abc" is valid, equivalent to "\[abc"
    if (inClass) {
      // split where the last [ was, and escape it
      // this is a huge pita.  We now have to re-walk
      // the contents of the would-be class to re-translate
      // any characters that were passed through as-is
      cs = pattern.slice(classStart + 1)
      sp = this.parse(cs, SUBPARSE) as SubparseReturn
      re = re.substring(0, reClassStart) + '\\[' + sp[0]
      hasMagic = hasMagic || sp[1]
    }

    // handle the case where we had a +( thing at the *end*
    // of the pattern.
    // each pattern list stack adds 3 chars, and we need to go through
    // and escape any | chars that were passed through as-is for the regexp.
    // Go through and escape them, taking care not to double-escape any
    // | chars that were already escaped.
    for (pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
      let tail: string
      tail = re.slice(pl.reStart + pl.open.length)
      this.debug(this.pattern, 'setting tail', re, pl)
      // maybe some even number of \, then maybe 1 \, followed by a |
      tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, (_, $1, $2) => {
        if (!$2) {
          // the | isn't already escaped, so escape it.
          $2 = '\\'
          // should already be done
          /* c8 ignore start */
        }
        /* c8 ignore stop */

        // need to escape all those slashes *again*, without escaping the
        // one that we need for escaping the | character.  As it works out,
        // escaping an even number of slashes can be done by simply repeating
        // it exactly after itself.  That's why this trick works.
        //
        // I am sorry that you have to see this.
        return $1 + $1 + $2 + '|'
      })

      this.debug('tail=%j\n   %s', tail, tail, pl, re)
      const t =
        pl.type === '*' ? star : pl.type === '?' ? qmark : '\\' + pl.type

      hasMagic = true
      re = re.slice(0, pl.reStart) + t + '\\(' + tail
    }

    // handle trailing things that only matter at the very end.
    clearStateChar()
    if (escaping) {
      // trailing \\
      re += '\\\\'
    }

    // only need to apply the nodot start if the re starts with
    // something that could conceivably capture a dot
    const addPatternStart = addPatternStartSet[re.charAt(0)]

    // Hack to work around lack of negative lookbehind in JS
    // A pattern like: *.!(x).!(y|z) needs to ensure that a name
    // like 'a.xyz.yz' doesn't match.  So, the first negative
    // lookahead, has to look ALL the way ahead, to the end of
    // the pattern.
    for (let n = negativeLists.length - 1; n > -1; n--) {
      const nl = negativeLists[n]

      const nlBefore = re.slice(0, nl.reStart)
      const nlFirst = re.slice(nl.reStart, nl.reEnd - 8)
      let nlAfter = re.slice(nl.reEnd)
      const nlLast = re.slice(nl.reEnd - 8, nl.reEnd) + nlAfter

      // Handle nested stuff like *(*.js|!(*.json)), where open parens
      // mean that we should *not* include the ) in the bit that is considered
      // "after" the negated section.
      const closeParensBefore = nlBefore.split(')').length
      const openParensBefore = nlBefore.split('(').length - closeParensBefore
      let cleanAfter = nlAfter
      for (let i = 0; i < openParensBefore; i++) {
        cleanAfter = cleanAfter.replace(/\)[+*?]?/, '')
      }
      nlAfter = cleanAfter

      const dollar = nlAfter === '' && isSub !== SUBPARSE ? '(?:$|\\/)' : ''

      re = nlBefore + nlFirst + nlAfter + dollar + nlLast
    }

    // if the re is not "" at this point, then we need to make sure
    // it doesn't match against an empty path part.
    // Otherwise a/* will match a/, which it should not.
    if (re !== '' && hasMagic) {
      re = '(?=.)' + re
    }

    if (addPatternStart) {
      re = patternStart() + re
    }

    // parsing just a piece of a larger pattern.
    if (isSub === SUBPARSE) {
      return [re, hasMagic]
    }

    // if it's nocase, and the lcase/uppercase don't match, it's magic
    if (options.nocase && !hasMagic && !options.nocaseMagicOnly) {
      hasMagic = pattern.toUpperCase() !== pattern.toLowerCase()
    }

    // skip the regexp for non-magical patterns
    // unescape anything in it, though, so that it'll be
    // an exact match against a file etc.
    if (!hasMagic) {
      return globUnescape(pattern)
    }

    const flags = options.nocase ? 'i' : ''
    try {
      const ext = fastTest
        ? {
            _glob: pattern,
            _src: re,
            test: fastTest,
          }
        : {
            _glob: pattern,
            _src: re,
          }
      return Object.assign(new RegExp('^' + re + '$', flags), ext)
      /* c8 ignore start */
    } catch (er) {
      // should be impossible
      // If it was an invalid regular expression, then it can't match
      // anything.  This trick looks for a character after the end of
      // the string, which is of course impossible, except in multi-line
      // mode, but it's not a /m regex.
      this.debug('invalid regexp', er)
      return new RegExp('$.')
    }
    /* c8 ignore stop */
  }

  makeRe() {
    if (this.regexp || this.regexp === false) return this.regexp

    // at this point, this.set is a 2d array of partial
    // pattern strings, or "**".
    //
    // It's better to use .match().  This function shouldn't
    // be used, really, but it's pretty convenient sometimes,
    // when you just want to work with a regex.
    const set = this.set

    if (!set.length) {
      this.regexp = false
      return this.regexp
    }
    const options = this.options

    const twoStar = options.noglobstar
      ? star
      : options.dot
      ? twoStarDot
      : twoStarNoDot
    const flags = options.nocase ? 'i' : ''

    // regexpify non-globstar patterns
    // if ** is only item, then we just do one twoStar
    // if ** is first, and there are more, prepend (\/|twoStar\/)? to next
    // if ** is last, append (\/twoStar|) to previous
    // if ** is in the middle, append (\/|\/twoStar\/) to previous
    // then filter out GLOBSTAR symbols
    let re = set
      .map(pattern => {
        const pp: (string | typeof GLOBSTAR)[] = pattern.map(p =>
          typeof p === 'string'
            ? regExpEscape(p)
            : p === GLOBSTAR
            ? GLOBSTAR
            : p._src
        ) as (string | typeof GLOBSTAR)[]
        pp.forEach((p, i) => {
          const next = pp[i + 1]
          const prev = pp[i - 1]
          if (p !== GLOBSTAR || prev === GLOBSTAR) {
            return
          }
          if (prev === undefined) {
            if (next !== undefined && next !== GLOBSTAR) {
              pp[i + 1] = '(?:\\/|' + twoStar + '\\/)?' + next
            } else {
              pp[i] = twoStar
            }
          } else if (next === undefined) {
            pp[i - 1] = prev + '(?:\\/|' + twoStar + ')?'
          } else if (next !== GLOBSTAR) {
            pp[i - 1] = prev + '(?:\\/|\\/' + twoStar + '\\/)' + next
            pp[i + 1] = GLOBSTAR
          }
        })
        return pp.filter(p => p !== GLOBSTAR).join('/')
      })
      .join('|')

    // must match entire pattern
    // ending in a * or ** will make it less strict.
    re = '^(?:' + re + ')$'

    // can match anything, as long as it's not this.
    if (this.negate) re = '^(?!' + re + ').*$'

    try {
      this.regexp = new RegExp(re, flags)
      /* c8 ignore start */
    } catch (ex) {
      // should be impossible
      this.regexp = false
    }
    /* c8 ignore stop */
    return this.regexp
  }

  slashSplit(p: string) {
    // if p starts with // on windows, we preserve that
    // so that UNC paths aren't broken.  Otherwise, any number of
    // / characters are coalesced into one, unless
    // preserveMultipleSlashes is set to true.
    if (this.preserveMultipleSlashes) {
      return p.split('/')
    } else if (this.isWindows && /^\/\/[^\/]+/.test(p)) {
      // add an extra '' for the one we lose
      return ['', ...p.split(/\/+/)]
    } else {
      return p.split(/\/+/)
    }
  }

  match(f: string, partial = this.partial) {
    this.debug('match', f, this.pattern)
    // short-circuit in the case of busted things.
    // comments, etc.
    if (this.comment) {
      return false
    }
    if (this.empty) {
      return f === ''
    }

    if (f === '/' && partial) {
      return true
    }

    const options = this.options

    // windows: need to use /, not \
    if (this.isWindows) {
      f = f.split('\\').join('/')
    }

    // treat the test path as a set of pathparts.
    const ff = this.slashSplit(f)
    this.debug(this.pattern, 'split', ff)

    // just ONE of the pattern sets in this.set needs to match
    // in order for it to be valid.  If negating, then just one
    // match means that we have failed.
    // Either way, return on the first hit.

    const set = this.set
    this.debug(this.pattern, 'set', set)

    // Find the basename of the path by looking for the last non-empty segment
    let filename: string = ff[ff.length - 1]
    if (!filename) {
      for (let i = ff.length - 2; !filename && i >= 0; i--) {
        filename = ff[i]
      }
    }

    for (let i = 0; i < set.length; i++) {
      const pattern = set[i]
      let file = ff
      if (options.matchBase && pattern.length === 1) {
        file = [filename]
      }
      const hit = this.matchOne(file, pattern, partial)
      if (hit) {
        if (options.flipNegate) {
          return true
        }
        return !this.negate
      }
    }

    // didn't get any hits.  this is success if it's a negative
    // pattern, failure otherwise.
    if (options.flipNegate) {
      return false
    }
    return this.negate
  }

  static defaults(def: MinimatchOptions) {
    return minimatch.defaults(def).Minimatch
  }
}

minimatch.Minimatch = Minimatch
