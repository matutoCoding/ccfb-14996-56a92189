import { h } from './dom'

export function textField(
  label: string,
  value: string,
  onValue: (value: string) => void,
  options: { placeholder?: string; textarea?: boolean } = {},
): HTMLLabelElement {
  const input = options.textarea
    ? h('textarea', {
        class: 'textarea',
        props: { value },
        on: { input: (e) => onValue((e.target as HTMLTextAreaElement).value) },
      })
    : h('input', {
        class: 'input',
        props: { value },
        attrs: { type: 'text', placeholder: options.placeholder },
        on: { input: (e) => onValue((e.target as HTMLInputElement).value) },
      })
  return h('label', { class: 'field' }, [h('span', { text: label }), input])
}

export function numberField(
  label: string,
  value: number,
  onValue: (value: number) => void,
  options: { min?: number; max?: number; step?: number; unit?: string } = {},
): HTMLLabelElement {
  return h('label', { class: 'field' }, [
    h('span', {}, [label, options.unit ? `（${options.unit}）` : '']),
    h('input', {
      class: 'input',
      attrs: { type: 'number', min: options.min, max: options.max, step: options.step ?? 0.1 },
      props: { value: String(value) },
      on: {
        change: (event) => {
          const next = Number((event.target as HTMLInputElement).value)
          if (Number.isFinite(next)) onValue(next)
        },
      },
    }),
  ])
}

export function rangeField(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onValue: (value: number) => void,
  format?: (value: number) => string,
): HTMLLabelElement {
  const output = h('output', { text: format ? format(value) : String(value) })
  return h('label', { class: 'field' }, [
    h('span', {}, [label, output]),
    h('input', {
      attrs: { type: 'range', min, max, step },
      props: { value: String(value) },
      on: {
        input: (event) => {
          const next = Number((event.target as HTMLInputElement).value)
          output.textContent = format ? format(next) : String(next)
          onValue(next)
        },
      },
    }),
  ])
}

export function selectField<T extends string>(
  label: string,
  value: T,
  options: Array<{ value: T; label: string }>,
  onValue: (value: T) => void,
): HTMLLabelElement {
  return h('label', { class: 'field' }, [
    h('span', { text: label }),
    h('select', {
      class: 'select',
      on: { change: (e) => onValue((e.target as HTMLSelectElement).value as T) },
    }, options.map((option) => h('option', {
      attrs: { value: option.value, selected: option.value === value },
      text: option.label,
    }))),
  ])
}
