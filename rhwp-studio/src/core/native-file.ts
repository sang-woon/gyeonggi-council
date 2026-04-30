import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { isNativePlatform } from './platform';

export interface NativeOpenedFile {
  bytes: Uint8Array;
  fileName: string;
  uri?: string;
}

function decodeBase64(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export async function readUriAsBytes(uri: string): Promise<NativeOpenedFile> {
  const result = await Filesystem.readFile({ path: uri });
  const data = result.data;
  const bytes = typeof data === 'string' ? decodeBase64(data) : new Uint8Array(await data.arrayBuffer());
  const fileName = decodeURIComponent(uri.split(/[/\\]/).pop() ?? 'document.hwp');
  return { bytes, fileName, uri };
}

export async function writeBytesToDocuments(
  fileName: string,
  bytes: Uint8Array,
): Promise<{ uri: string }> {
  const result = await Filesystem.writeFile({
    path: `rhwp/${fileName}`,
    data: encodeBase64(bytes),
    directory: Directory.Documents,
    recursive: true,
    encoding: Encoding.UTF8 as unknown as undefined, // base64 일 때는 encoding 미지정이지만 타입 호환용 캐스팅
  } as Parameters<typeof Filesystem.writeFile>[0]);
  return { uri: result.uri };
}

export type NativeOpenListener = (file: NativeOpenedFile) => void;

let urlOpenRegistered = false;
let pendingListeners: NativeOpenListener[] = [];

export function onNativeFileOpen(listener: NativeOpenListener): () => void {
  pendingListeners.push(listener);
  ensureUrlOpenRegistered();
  return () => {
    pendingListeners = pendingListeners.filter((l) => l !== listener);
  };
}

function ensureUrlOpenRegistered(): void {
  if (urlOpenRegistered || !isNativePlatform()) return;
  urlOpenRegistered = true;
  App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
    const url = event.url;
    if (!url) return;
    if (!/\.hwpx?(\?|$)/i.test(url)) return;
    try {
      const opened = await readUriAsBytes(url);
      for (const l of pendingListeners) l(opened);
    } catch (err) {
      console.error('[native-file] appUrlOpen 처리 실패:', err);
    }
  });
}
