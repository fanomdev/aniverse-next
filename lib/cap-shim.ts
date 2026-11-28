// lib/cap-shim.ts — local filesystem URI → src the WebView can load
import { Capacitor } from "@capacitor/core"

export const Converter = {
  toSrc(uri: string): string {
    try {
      return Capacitor.convertFileSrc(uri)
    } catch {
      return uri
    }
  },
}
