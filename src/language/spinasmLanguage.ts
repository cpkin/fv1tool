import { LRLanguage, LanguageSupport } from '@codemirror/language'
import { styleTags, tags } from '@lezer/highlight'

import { parser } from './spinasmParser'

export const spinasmLanguage = LRLanguage.define({
  name: 'SpinASM',
  parser: parser.configure({
    props: [
      styleTags({
        EquDir: tags.keyword,
        MemDir: tags.keyword,
        OrgDir: tags.keyword,
        OpcodeName: tags.keyword,
        'LabelDef/Identifier': tags.labelName,
        Number: tags.number,
        LineComment: tags.lineComment,
        Operator: tags.operator,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: ';' },
  },
})

export const spinasm = new LanguageSupport(spinasmLanguage)
