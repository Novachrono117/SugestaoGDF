export function AvisoEmergencia() {
  return (
    <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>Emergência?</strong> Ligue <a href="tel:190" className="font-bold underline">190</a> (Polícia Militar) ou{" "}
      <a href="tel:193" className="font-bold underline">193</a> (Bombeiros). Este canal não substitui o atendimento de
      emergência.
    </p>
  );
}
