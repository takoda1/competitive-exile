// RFC 7636 §4.1 recommends 32–96 bytes of entropy for the code verifier
const VERIFIER_BYTES = 32
// 16 bytes gives 128 bits of entropy for the OAuth state nonce
const STATE_BYTES = 16

export function generateCodeVerifier(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES))
  return base64url(bytes)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return base64url(new Uint8Array(digest))
}

export function generateState(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(STATE_BYTES))
  return base64url(bytes)
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}
