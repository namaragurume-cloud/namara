"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractQrToken } from "@/lib/qr-parse";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Section";

type DetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type Status = "idle" | "starting" | "scanning" | "error";

/**
 * 店舗QRの読み取り。
 * 1. LINE アプリ内（LIFF）: liff.scanCodeV2()
 * 2. ブラウザ: カメラ + BarcodeDetector（Android Chrome 等）/ jsQR（iOS Safari 等）
 * どちらも使えない場合は、スマートフォンのカメラアプリで店頭QRを読み取れば同じ画面が開く。
 */
export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    stopRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const handle = useCallback(
    (text: string) => {
      const token = extractQrToken(text);
      if (!token) {
        setMessage("TABETUNAGU の店舗QRではないようです。レジ付近の QR をもう一度読み取ってください。");
        return false;
      }
      stop();
      router.push(`/c/${token}`);
      return true;
    },
    [router, stop],
  );

  async function start() {
    setMessage(null);
    setStatus("starting");
    const liff = window.__tabetunaguLiff;
    try {
      if (liff?.isInClient() && liff.isApiAvailable("scanCodeV2")) {
        const result = await liff.scanCodeV2();
        setStatus("idle");
        if (result.value) handle(result.value);
        return;
      }
    } catch {
      // LIFF のスキャンが使えなければブラウザのカメラにフォールバック
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage("このブラウザではカメラを使えません。スマートフォンのカメラアプリで店頭のQRを読み取ってください。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      stopRef.current = false;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("scanning");
      await scanLoop(video);
    } catch (error) {
      stop();
      setStatus("error");
      setMessage(
        (error as Error)?.name === "NotAllowedError"
          ? "カメラの使用が許可されていません。ブラウザの設定でカメラを許可するか、カメラアプリで店頭のQRを読み取ってください。"
          : "カメラを起動できませんでした。カメラアプリで店頭のQRを読み取ってください。",
      );
    }
  }

  async function scanLoop(video: HTMLVideoElement) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let detector: DetectorLike | null = null;
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
    if (Ctor) {
      try {
        detector = new Ctor({ formats: ["qr_code"] });
      } catch {
        detector = null;
      }
    }
    const jsQR = detector ? null : (await import("jsqr")).default;
    while (!stopRef.current) {
      await new Promise((r) => setTimeout(r, 160));
      if (!video.videoWidth || !ctx) continue;
      try {
        if (detector) {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue && handle(codes[0].rawValue)) return;
        } else if (jsQR) {
          const scale = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data && handle(code.data)) return;
        }
      } catch {
        // 1フレームの失敗は無視して続ける
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-ink">
        <video ref={videoRef} playsInline muted className={status === "scanning" ? "h-full w-full object-cover" : "hidden"} />
        {status !== "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <Camera className="h-10 w-10" strokeWidth={1.4} aria-hidden />
            <p className="text-[13px]">{status === "starting" ? "カメラを起動しています…" : "店頭のQRコードを読み取ります"}</p>
          </div>
        )}
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden />
        )}
      </div>
      {message && <Notice tone="error">{message}</Notice>}
      {status === "scanning" ? (
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => {
            stop();
            setStatus("idle");
          }}
        >
          読み取りをやめる
        </Button>
      ) : (
        <Button size="lg" className="w-full" onClick={start} disabled={status === "starting"}>
          カメラで読み取る
        </Button>
      )}
    </div>
  );
}
