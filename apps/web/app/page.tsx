"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <h1 className="title">Bunker</h1>
      <p className="subtitle">
        Host en PC/TV. Teléfonos como control. Salas por código.
      </p>

      <div className="grid2">
        <div className="card">
          <h2 style={{ margin: "0 0 8px 0" }}>Host</h2>
          <p className="subtitle" style={{ margin: 0 }}>
            Crea una sala, elige juego y muestra el código en pantalla.
          </p>
          <div style={{ height: 14 }} />
          <Link className="btn btnPrimary" href="/host">
            Crear sala
          </Link>
        </div>

        <div className="card">
          <h2 style={{ margin: "0 0 8px 0" }}>Control</h2>
          <p className="subtitle" style={{ margin: 0 }}>
            Únete con código y juega desde tu teléfono.
          </p>
          <div style={{ height: 14 }} />
          <Link className="btn btnPrimary" href="/join">
            Unirse
          </Link>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <div className="pill">
        Server realtime: <code>http://localhost:4040</code>
      </div>
    </main>
  );
}

