import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { captureAdminLiveBrowserScreenshot } from "@/lib/admin-live-browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  return { user };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const fpsParam = Number(req.nextUrl.searchParams.get("fps") || 4);
  const fps = Math.min(Math.max(Number.isFinite(fpsParam) ? fpsParam : 4, 1), 8);
  const intervalMs = Math.round(1000 / fps);
  const boundary = "azenith-live-browser-frame";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      req.signal.addEventListener("abort", () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });

      while (!closed) {
        try {
          const image = await captureAdminLiveBrowserScreenshot();
          controller.enqueue(
            encoder.encode(
              `--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${image.length}\r\nCache-Control: no-store\r\n\r\n`
            )
          );
          controller.enqueue(new Uint8Array(image));
          controller.enqueue(encoder.encode("\r\n"));
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `--${boundary}\r\nContent-Type: text/plain\r\n\r\n${
                error instanceof Error ? error.message : "Live browser stream failed"
              }\r\n`
            )
          );
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    },
    cancel() {
      /* client disconnected */
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": `multipart/x-mixed-replace; boundary=${boundary}`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Connection: "keep-alive",
    },
  });
}
