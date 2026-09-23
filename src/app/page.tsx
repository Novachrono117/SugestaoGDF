export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-3xl font-bold">Voz DF</h1>
      <p>Rede Central de Denúncias do Distrito Federal — em construção.</p>
      <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
        Emergências: ligue <strong>190</strong> (PMDF) ou <strong>193</strong> (CBMDF). Este canal não
        substitui o atendimento de emergência.
      </p>
    </main>
  );
}
