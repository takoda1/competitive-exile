export function generateCodeVerifier(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32))
  return base64url(bytes)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return base64url(new Uint8Array(digest))
}

export function generateState(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return base64url(bytes)
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}
