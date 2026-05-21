import { NextResponse } from "next/server";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { updatePassword, getUserById } from "@/lib/db";

export async function PATCH(req: Request) {
  const user = await requireUser();
  const { current_password, new_password } = await req.json();

  if (!current_password || !new_password) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }
  if (new_password.length < 8) {
    return NextResponse.json({ error: "Nouveau mot de passe trop court (8 caractères min.)" }, { status: 400 });
  }

  // Verify current password
  const full = await getUserById(user.id);
  if (!full || !verifyPassword(current_password, full.password_hash)) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });
  }

  await updatePassword(user.id, hashPassword(new_password));
  return NextResponse.json({ ok: true });
}
