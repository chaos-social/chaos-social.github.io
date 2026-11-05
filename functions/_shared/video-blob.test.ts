import {getDidDocumentUrl} from './video-blob'

describe('getDidDocumentUrl', () => {
  it('reads did:plc through the plc directory', () => {
    expect(getDidDocumentUrl('did:plc:alice')).toBe(
      'https://plc.directory/did:plc:alice',
    )
  })

  it('reads did:web from well-known', () => {
    expect(getDidDocumentUrl('did:web:example.com')).toBe(
      'https://example.com/.well-known/did.json',
    )
  })

  it('reads a path-based did:web', () => {
    expect(getDidDocumentUrl('did:web:example.com:users:alice')).toBe(
      'https://example.com/users/alice/did.json',
    )
  })

  it('decodes a port-encoded host', () => {
    expect(getDidDocumentUrl('did:web:example.com%3A8443')).toBe(
      'https://example.com:8443/.well-known/did.json',
    )
  })

  it('uses http for localhost', () => {
    expect(getDidDocumentUrl('did:web:localhost%3A8080')).toBe(
      'http://localhost:8080/.well-known/did.json',
    )
  })

  it('returns undefined for unsupported methods', () => {
    expect(getDidDocumentUrl('did:key:zabc')).toBeUndefined()
    expect(getDidDocumentUrl('did:web:')).toBeUndefined()
  })
})
