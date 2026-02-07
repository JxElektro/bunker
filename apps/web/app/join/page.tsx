"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getPlayerName, setPlayerName } from "@/src/lib/identity";

export default function JoinPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState(getPlayerName() || "");

  function go() {
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    if (name.trim()) setPlayerName(name.trim());
    router.push(`/play/${encodeURIComponent(code)}`);
  }

  return (
    <main className="container">
      <h1 className="title">Unirse</h1>
      <p className="subtitle">Ingresa el código que aparece en la pantalla del host.</p>

      <section className="card" style={{ maxWidth: 520 }}>
        <div className="field">
          <div className="label">Código</div>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="ABCD"
            inputMode="text"
            autoCapitalize="characters"
          />
        </div>

        <div className="field">
          <div className="label">Nombre</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
          />
        </div>

        <button className="btn btnPrimary" onClick={go}>Entrar</button>
      </section>
    </main>
  );
}

