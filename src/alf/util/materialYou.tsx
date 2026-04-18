import {type JSX} from 'react'

export function getMaterialYouColor(
  _color: [
    'system_accent1',
    'system_accent2',
    'system_accent3',
    'system_neutral1',
    'system_neutral2',
  ][number],
  _shade: [
    0,
    10,
    50,
    100,
    200,
    300,
    400,
    500,
    600,
    700,
    800,
    900,
    1000,
  ][number],
): string {
  return '#000000'
}

export function onMaterialYouPaletteChange(_callback: () => void) {}

export function MaterialYouPaletteProvider({
  children,
}: React.PropsWithChildren): JSX.Element {
  return <>{children}</>
}
