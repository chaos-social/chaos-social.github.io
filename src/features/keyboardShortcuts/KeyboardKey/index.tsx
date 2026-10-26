import {atoms as a} from '#/alf'
import {Text} from '#/components/Typography'

export function KeyboardKey({children}: {children: string}) {
  return <Text style={[a.text_sm, a.font_semi_bold]}>{children}</Text>
}
