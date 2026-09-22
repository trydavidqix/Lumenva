import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
  if (!keyBase64) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY environment variable is not set')
  }
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded in base64')
  }
  return key
}

export function encryptToken(text: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  
  const authTag = cipher.getAuthTag().toString('base64')
  const ivStr = iv.toString('base64')
  
  // Format: iv:authTag:encryptedData
  return `${ivStr}:${authTag}:${encrypted}`
}

export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format')
  }
  
  const [ivStr, authTagStr, encryptedStr] = parts
  const iv = Buffer.from(ivStr, 'base64')
  const authTag = Buffer.from(authTagStr, 'base64')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encryptedStr, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
