// Gera os ícones do PWA a partir de um desenho vetorial único (balão de fala + pino de mapa).
// Uso: npx tsx scripts/gerar-icones.mts — rodar de novo só se o desenho mudar; os PNGs são versionados.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const AZUL = "#1d4ed8"; // blue-700, mesma cor do app e do theme_color

const desenho = `
  <path fill="#fff" d="M164 128h184a48 48 0 0 1 48 48v104a48 48 0 0 1-48 48H248l-88 64 16-64h-12a48 48 0 0 1-48-48V176a48 48 0 0 1 48-48z"/>
  <path fill="${AZUL}" d="M256 300c-26-35-44-58-44-90a44 44 0 1 1 88 0c0 32-18 55-44 90z"/>
  <circle fill="#fff" cx="256" cy="210" r="16"/>`;

// "any": cantos arredondados. "maskable": fundo até a borda — o sistema recorta (o desenho fica na zona segura de 80%).
const svg = (fundo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${fundo}${desenho}</svg>`;
const qualquer = svg(`<rect width="512" height="512" rx="112" fill="${AZUL}"/>`);
const mascaravel = svg(`<rect width="512" height="512" fill="${AZUL}"/>`);

async function png(fonte: string, lado: number, destino: string) {
  await sharp(Buffer.from(fonte), { density: 300 }).resize(lado, lado).png({ compressionLevel: 9 }).toFile(destino);
}

await mkdir("public/icons", { recursive: true });
await Promise.all([
  png(qualquer, 192, "public/icons/icon-192.png"),
  png(qualquer, 512, "public/icons/icon-512.png"),
  png(mascaravel, 512, "public/icons/maskable-512.png"),
  // Convenção de arquivos do Next: viram <link rel="icon"> e <link rel="apple-touch-icon">.
  png(mascaravel, 180, "src/app/apple-icon.png"), // o iOS arredonda sozinho
  writeFile("src/app/icon.svg", qualquer.trim() + "\n"),
]);
console.log("Ícones gerados em public/icons/, src/app/icon.svg e src/app/apple-icon.png");
