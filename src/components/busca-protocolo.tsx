// Formulário GET simples (funciona sem JavaScript): /acompanhar?protocolo=...
export function BuscaProtocolo({ valorInicial = "" }: { valorInicial?: string }) {
  return (
    <form action="/acompanhar" method="get" className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="protocolo" className="sr-only">
        Número do protocolo
      </label>
      <input
        id="protocolo"
        name="protocolo"
        defaultValue={valorInicial}
        required
        placeholder="DF-2026-000123"
        autoComplete="off"
        className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-base uppercase text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
      />
      <button type="submit" className="min-h-11 rounded-lg bg-slate-900 px-4 font-semibold text-white hover:bg-slate-800">
        Acompanhar
      </button>
    </form>
  );
}
