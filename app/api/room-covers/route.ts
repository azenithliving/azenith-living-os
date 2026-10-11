import { NextResponse } from "next/server";

import { pickRoomCovers } from "@/lib/cad/sheet-images";
import { BASE_ROOMS } from "@/lib/constants/rooms";

/**
 * The storefront's room pictures, read from the store's own bank.
 *
 * Before this door existed the home page asked an external photo service once per room on every visit,
 * with a random page offset in the query — so the same room showed one picture to a visitor and another
 * on reload, and every visit spent an external call. The bank holds 7,805 active pictures of these very
 * rooms and answers the same row every time it is asked.
 *
 * One call returns every style the switcher offers, so switching style is instant and costs nothing.
 * Rooms the bank does not hold are simply absent from the answer; the page keeps its named fallback for
 * those rather than showing a whole-house picture under a bathroom's name.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const rooms = [...BASE_ROOMS.map((room) => room.slug), "interior-design"];
    const covers = await pickRoomCovers(rooms);
    const cells = Object.values(covers).reduce((sum, set) => sum + Object.keys(set).length, 0);

    return NextResponse.json({ ok: true, covers, rooms: rooms.length, cells });
  } catch (error) {
    console.error("[room-covers] the bank did not answer:", error);
    // An empty answer is not a lie here: the page falls back per room and says nothing was found.
    return NextResponse.json({ ok: false, covers: {}, rooms: 0, cells: 0 }, { status: 200 });
  }
}
