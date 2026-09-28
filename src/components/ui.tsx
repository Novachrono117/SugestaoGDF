// Componentes base de formulário (acessíveis: label associado, erro anunciado).
import type { ComponentProps, ReactNode } from "react";

export function Campo({
  id,
  label,
  dica,
  ...props
}: { id: string; label: string; dica?: string } & ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-describedby={dica ? `${id}-dica` : undefined}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        {...props}
      />
      {dica && (
        <p id={`${id}-dica`} className="text-xs text-slate-500">
          {dica}
        </p>
      )}
    </div>
  );
}

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: { variante?: "primario" | "secundario" | "perigo" } & ComponentProps<"button">) {
  const estilos = {
    primario: "bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-300",
    secundario: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400",
    perigo: "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300",
  }[variante];
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${estilos} ${className}`}
      {...props}
    />
  );
}

export function Alerta({ tipo = "erro", children }: { tipo?: "erro" | "info" | "sucesso"; children: ReactNode }) {
  const estilos = {
    erro: "border-red-300 bg-red-50 text-red-900",
    info: "border-amber-300 bg-amber-50 text-amber-900",
    sucesso: "border-emerald-300 bg-emerald-50 text-emerald-900",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${estilos}`}>
      {children}
    </div>
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}
