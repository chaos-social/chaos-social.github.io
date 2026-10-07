import React from 'react'
import {StyleSheet, View} from 'react-native'

import {usePalette} from '#/lib/hooks/usePalette'
import {InfoCircleIcon} from '#/lib/icons'
import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {Text} from '#/view/com/util/text/Text'
import {atoms as a, useTheme} from '#/alf'
import {useIsWithinMessage} from '#/components/dms/MessageContext'
import {Loader} from '#/components/Loader'

function extractTextFromChildren(children: React.ReactNode): string {
  if (children == null) return ''
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children))
    return children.map(extractTextFromChildren).join(' ')
  if (React.isValidElement(children))
    return extractTextFromChildren((children as any).props?.children)
  return ''
}

export function PostPlaceholder({
  children,
  directFetchEnabled,
}: {
  children: React.ReactNode
  directFetchEnabled?: boolean
}) {
  const shapePreference = useEnableSquareButtons()

  const t = useTheme()
  const pal = usePalette('default')
  const isWithinMessage = useIsWithinMessage()

  const text = extractTextFromChildren(children).trim().toLowerCase()
  const isDeleted = /\bdeleted\b/.test(text)

  const showLoader = Boolean(directFetchEnabled) && !isDeleted

  return (
    <View
      style={[
        styles.errorContainer,
        isWithinMessage && styles.errorContainerInMessage,
        !isWithinMessage && [a.border, t.atoms.border_contrast_low],
        shapePreference === 'sharp' && SHARP_CORNERS,
      ]}>
      {showLoader ? (
        <Loader size={'md'} style={pal.text} />
      ) : (
        <InfoCircleIcon size={18} style={pal.text} />
      )}
      <Text type="lg" style={pal.text}>
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorContainerInMessage: {
    marginTop: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
})
