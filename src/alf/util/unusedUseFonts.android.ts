import {useFonts} from 'expo-font'

/*
 * IMPORTANT: This is unused. Expo statically extracts these fonts.
 *
 * All used fonts MUST be configured here. Unused fonts can be commented out.
 *
 * This is used for both web fonts and native fonts.
 */
export function DO_NOT_USE() {
  return useFonts({
    'Inter-Regular': require('../../../assets/fonts/inter/Inter-Regular.otf'),
    'Inter-Italic': require('../../../assets/fonts/inter/Inter-Italic.otf'),
    'Inter-Medium': require('../../../assets/fonts/inter/Inter-Medium.otf'),
    'Inter-MediumItalic': require('../../../assets/fonts/inter/Inter-MediumItalic.otf'),
    'Inter-SemiBold': require('../../../assets/fonts/inter/Inter-SemiBold.otf'),
    'Inter-SemiBoldItalic': require('../../../assets/fonts/inter/Inter-SemiBoldItalic.otf'),
    'Inter-Bold': require('../../../assets/fonts/inter/Inter-Bold.otf'),
    'Inter-BoldItalic': require('../../../assets/fonts/inter/Inter-BoldItalic.otf'),
    // Google Sans Flex - 9pt
    'GoogleSansFlex_9pt-Thin': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Thin.ttf'),
    'GoogleSansFlex_9pt-ExtraLight': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-ExtraLight.ttf'),
    'GoogleSansFlex_9pt-Light': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Light.ttf'),
    'GoogleSansFlex_9pt-Regular': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Regular.ttf'),
    'GoogleSansFlex_9pt-Medium': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Medium.ttf'),
    'GoogleSansFlex_9pt-SemiBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-SemiBold.ttf'),
    'GoogleSansFlex_9pt-Bold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Bold.ttf'),
    'GoogleSansFlex_9pt-ExtraBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-ExtraBold.ttf'),
    'GoogleSansFlex_9pt-Black': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Black.ttf'),
    // Google Sans Flex - 24pt
    'GoogleSansFlex_24pt-Thin': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Thin.ttf'),
    'GoogleSansFlex_24pt-ExtraLight': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-ExtraLight.ttf'),
    'GoogleSansFlex_24pt-Light': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Light.ttf'),
    'GoogleSansFlex_24pt-Regular': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Regular.ttf'),
    'GoogleSansFlex_24pt-Medium': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Medium.ttf'),
    'GoogleSansFlex_24pt-SemiBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-SemiBold.ttf'),
    'GoogleSansFlex_24pt-Bold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Bold.ttf'),
    'GoogleSansFlex_24pt-ExtraBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-ExtraBold.ttf'),
    'GoogleSansFlex_24pt-Black': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Black.ttf'),
    // Google Sans Flex - 36pt
    'GoogleSansFlex_36pt-Thin': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Thin.ttf'),
    'GoogleSansFlex_36pt-ExtraLight': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-ExtraLight.ttf'),
    'GoogleSansFlex_36pt-Light': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Light.ttf'),
    'GoogleSansFlex_36pt-Regular': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Regular.ttf'),
    'GoogleSansFlex_36pt-Medium': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Medium.ttf'),
    'GoogleSansFlex_36pt-SemiBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-SemiBold.ttf'),
    'GoogleSansFlex_36pt-Bold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Bold.ttf'),
    'GoogleSansFlex_36pt-ExtraBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-ExtraBold.ttf'),
    'GoogleSansFlex_36pt-Black': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Black.ttf'),
    // Google Sans Flex - 72pt
    'GoogleSansFlex_72pt-Thin': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Thin.ttf'),
    'GoogleSansFlex_72pt-ExtraLight': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-ExtraLight.ttf'),
    'GoogleSansFlex_72pt-Light': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Light.ttf'),
    'GoogleSansFlex_72pt-Regular': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Regular.ttf'),
    'GoogleSansFlex_72pt-Medium': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Medium.ttf'),
    'GoogleSansFlex_72pt-SemiBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-SemiBold.ttf'),
    'GoogleSansFlex_72pt-Bold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Bold.ttf'),
    'GoogleSansFlex_72pt-ExtraBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-ExtraBold.ttf'),
    'GoogleSansFlex_72pt-Black': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Black.ttf'),
    // Google Sans Flex - 120pt
    'GoogleSansFlex_120pt-Thin': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Thin.ttf'),
    'GoogleSansFlex_120pt-ExtraLight': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-ExtraLight.ttf'),
    'GoogleSansFlex_120pt-Light': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Light.ttf'),
    'GoogleSansFlex_120pt-Regular': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Regular.ttf'),
    'GoogleSansFlex_120pt-Medium': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Medium.ttf'),
    'GoogleSansFlex_120pt-SemiBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-SemiBold.ttf'),
    'GoogleSansFlex_120pt-Bold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Bold.ttf'),
    'GoogleSansFlex_120pt-ExtraBold': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-ExtraBold.ttf'),
    'GoogleSansFlex_120pt-Black': require('../../../assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Black.ttf'),
  })
}
