import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import Storage from "expo-sqlite/kv-store";

// Pleos 앱 보안 가이드: 기기에 저장하는 민감정보는 앱 수준에서 암호화하고, 키는 Android Keystore 로 보호한다.
// 값은 AES-GCM 으로 암호화해 SQLite 에 두고, 키는 expo-secure-store(Keystore 로 보호)에만 둔다.
const KEY_NAME = "mobi.storage-key.v1";
const PREFIX = "enc1:";

let keyPromise: Promise<AESEncryptionKey> | null = null;

async function loadOrCreateKey(): Promise<AESEncryptionKey> {
  const saved = await SecureStore.getItemAsync(KEY_NAME);
  if (saved) return AESEncryptionKey.import(saved, "base64");
  const key = await AESEncryptionKey.generate();
  await SecureStore.setItemAsync(KEY_NAME, await key.encoded("base64"));
  return key;
}

// 동시에 처음 불려도 키를 두 번 만들지 않게 한 번만 읽는다. 실패하면 다음 호출에서 다시 시도한다.
function storageKey(): Promise<AESEncryptionKey> {
  keyPromise ??= loadOrCreateKey().catch((error: unknown) => {
    keyPromise = null;
    throw error;
  });
  return keyPromise;
}

async function encrypt(plaintext: string): Promise<string> {
  const sealed = await aesEncryptAsync(
    new TextEncoder().encode(plaintext),
    await storageKey(),
  );
  return PREFIX + (await sealed.combined("base64"));
}

async function decrypt(stored: string): Promise<string> {
  const sealed = AESSealedData.fromCombined(stored.slice(PREFIX.length));
  const bytes = await aesDecryptAsync(sealed, await storageKey(), {
    output: "bytes",
  });
  return new TextDecoder().decode(bytes as Uint8Array);
}

export async function setEncryptedItem(key: string, value: string) {
  await Storage.setItem(key, await encrypt(value));
}

/**
 * 복호화한 값을 돌려준다. 없거나 복호화할 수 없으면(키 분실 등) null.
 * 암호화 전 버전이 남긴 평문은 읽은 뒤 바로 암호화해 다시 저장한다.
 */
export async function getEncryptedItem(key: string): Promise<string | null> {
  const stored = await Storage.getItem(key);
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) {
    await setEncryptedItem(key, stored);
    return stored;
  }
  try {
    return await decrypt(stored);
  } catch {
    return null;
  }
}
