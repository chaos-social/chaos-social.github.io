type AccessPrivileges = 'all' | 'limited' | 'none'

export type ExistingContact = {
  id?: string
  firstName?: string
  lastName?: string
  phoneNumbers?: Array<{
    label?: string
    number?: string
    digits?: string
    countryCode?: string
  }>
  imageAvailable?: boolean
}

export type PermissionResponse = {
  granted: boolean
  canAskAgain: boolean
  accessPrivileges?: AccessPrivileges
}

export const Fields = {
  FirstName: 'firstName',
  LastName: 'lastName',
  PhoneNumbers: 'phoneNumbers',
  Image: 'image',
} as const

export async function isAvailableAsync() {
  return false
}

export async function getPermissionsAsync(): Promise<PermissionResponse> {
  return {
    granted: false,
    canAskAgain: false,
    accessPrivileges: 'none',
  }
}

export async function requestPermissionsAsync(): Promise<PermissionResponse> {
  return await getPermissionsAsync()
}

export async function getContactsAsync() {
  return {data: [] as ExistingContact[]}
}
