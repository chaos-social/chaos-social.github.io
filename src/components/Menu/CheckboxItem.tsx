import {useEffect, useState} from 'react'

import {atoms as a} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'

export function CheckboxItemText({
  children,
  value,
  label,
  onChange,
}: React.PropsWithChildren<{
  value: boolean
  label: string
  onChange: (value: boolean) => void
}>) {
  // Native submenus retain their children, so feedback cannot wait for new props.
  const [selected, setSelected] = useState(value)
  useEffect(() => setSelected(value), [value])

  return (
    <Toggle.Item
      name="menu_checkbox"
      label={label}
      value={selected}
      onChange={next => {
        setSelected(next)
        onChange(next)
      }}
      style={[a.flex_1, a.gap_sm]}>
      <Toggle.Checkbox />
      <Toggle.LabelText style={[a.flex_1, a.text_md]}>
        {children}
      </Toggle.LabelText>
    </Toggle.Item>
  )
}
