import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 text-sm uppercase tracking-[0.3em] text-aura-terracota">
        Aura Cleaners
      </p>
      <h1 className="font-display text-5xl font-semibold text-aura-brown sm:text-6xl">
        Clean you can feel.
      </h1>
      <p className="mt-4 max-w-md text-aura-brown/70">
        Cotiza tu limpieza en menos de dos minutos y reserva al instante. EN / FR / ES.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/quote" className="btn-primary">
          Comenzar cotización
        </Link>
        <Link href="/dashboard" className="btn-outline">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
