import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json({
      connected: false,
      configured: false,
      message: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set",
    });
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getMe`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();

    return NextResponse.json({
      connected: res.ok && data.ok === true,
      configured: true,
      botUsername: data.result?.username ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      configured: true,
      error: err.message,
    });
  }
}
