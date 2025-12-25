import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // Como NO tienes carpeta 'src', las rutas deben empezar por ./
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // <--- Aquí es donde vive GameCardLOLO.tsx
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;