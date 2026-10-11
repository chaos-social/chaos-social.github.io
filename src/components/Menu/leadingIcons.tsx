import {cloneElement, isValidElement} from 'react'
import flattenReactChildren from 'react-keyed-flatten-children'

import {type ItemIconProps} from '#/components/Menu/types'

/** Keep action icons and selection indicators before labels regardless of the caller's child order. */
export function leadingIcons(
  children: React.ReactNode,
  iconComponent: React.ComponentType<ItemIconProps>,
  radioComponent: React.ComponentType<{selected: boolean}>,
) {
  const icons: React.ReactNode[] = []
  const content: React.ReactNode[] = []
  for (const child of flattenReactChildren(children)) {
    if (isValidElement<ItemIconProps>(child) && child.type === iconComponent) {
      icons.push(cloneElement(child, {position: 'left'}))
    } else if (isValidElement(child) && child.type === radioComponent) {
      icons.push(child)
    } else {
      content.push(child)
    }
  }
  return [...icons, ...content]
}
