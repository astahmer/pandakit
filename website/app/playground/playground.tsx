import { useActor } from '@xstate/react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { css } from '#styled-system/css'
import { styled } from '#styled-system/jsx'
import { ResizeHandle } from './resize-handle'
import { useTheme } from '../vite-themes/provider'

import ReactDeclaration from '../../dts/react.d.ts?raw'
import { playgroundActor } from './machine'
import { EditorProps, Editor as MonacoEditor } from '@monaco-editor/react'

// No idea why the typings wont work without this
const Editor = (props: EditorProps) => <MonacoEditor {...props} />

export const Playground = () => {
  const [state, send] = useActor(playgroundActor)
  // console.log(state.value, state.context)

  const theme = useTheme()
  const colorMode = theme.resolvedTheme
  // console.log(state.context)

  return (
    <PanelGroup direction="horizontal">
      <Panel defaultSize={50} className={css({ display: 'flex', flexDirection: 'column' })} minSize={20}>
        <styled.div
          boxSize="full"
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          <Editor
            theme={colorMode === 'dark' ? 'vs-dark' : 'vs-light'}
            language="typescript"
            path="input.tsx"
            value={state.context.input ?? ''}
            options={{ minimap: { enabled: false } }}
            beforeMount={(monaco) => {
              monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.Latest,
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                module: monaco.languages.typescript.ModuleKind.CommonJS,
                noEmit: true,
                esModuleInterop: true,
                jsx: monaco.languages.typescript.JsxEmit.Preserve,
                // reactNamespace: "React",
                allowJs: true,
                typeRoots: ['node_modules/@types'],
              })

              monaco.languages.typescript.typescriptDefaults.addExtraLib(ReactDeclaration, '@types/react')

              monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
              })
            }}
            onMount={(editor, monaco) => {
              // console.log('editor mounted', editor, monaco)
              send({ type: 'Editor Loaded', editor, monaco, kind: 'input' })
              // editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, (e) => {
              //   send({ type: 'Save' })
              // })
            }}
            onChange={(content) => {
              return send({ type: 'Update input', value: content ?? '' })
            }}
          />
        </styled.div>
      </Panel>
      <ResizeHandle className={css({ color: 'black' })} />
      <Panel defaultSize={50} className={css({ display: 'flex', flexDirection: 'column' })} minSize={20}>
        <styled.div
          boxSize="full"
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          <Editor
            options={{ minimap: { enabled: false } }}
            theme={colorMode === 'dark' ? 'vs-dark' : 'vs-light'}
            language="typescript"
            path="output.tsx"
            value={state.context.output}
            beforeMount={(monaco) => {
              monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
              })
            }}
            onMount={(editor, monaco) => {
              send({ type: 'Editor Loaded', editor, monaco, kind: 'output' })
            }}
          />
        </styled.div>
      </Panel>
    </PanelGroup>
  )
}