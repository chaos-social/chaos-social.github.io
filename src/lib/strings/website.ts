import {sanitizeUrl} from '@braintree/sanitize-url'
import * as URI from 'uri-js'

export function sanitizeWebsiteForDisplay(website: string): string {
  return website.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

export function sanitizeWebsiteForLink(website: string): string {
  const trimmedWebsite = website.trim()
  return sanitizeUrl(trimmedWebsite)
}

export function isValidWebsiteFormat(website: string): boolean {
  const trimmedWebsite = website?.trim() || ''

  if (!trimmedWebsite || trimmedWebsite.length === 0) {
    return true
  }

  const parsedWebsite = URI.parse(trimmedWebsite)
  return !parsedWebsite.error && !!parsedWebsite.scheme
}
