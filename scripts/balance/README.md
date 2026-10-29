# Simulación de balanceo

Bots que juegan a Magic Poker con las reglas de verdad (`lib/`), sin interfaz, para medir
lo difícil que es cada parte del juego. No toca `lib/` ni `store/`: encadena las mismas
funciones que la tienda (`store/useGameStore.ts`).

- `engine.ts` · una partida entera (moneda, turnos, cartas ocultas, sellos, comodín, empates, fase 2 del Soberano).
- `personas.ts` · los seis perfiles de jugador y cómo eligen mejoras en el Castillo.
- `scenarios.ts` · jefe, revancha, subida al Castillo, duelo del Bosque y la campaña entera.
- `run.ts` · la batería principal (experimentos con semilla fija, repartidos entre procesos).
- `extra.ts` · calibración (bot contra la misma IA) y "¿y si...?" del Castillo.
- `trace.ts` · una partida jugada en voz alta (para depurar).
- `report.py` · gráficas y PDF a partir de los resultados (necesita matplotlib y reportlab).

```sh
OUT=/tmp/bal && mkdir -p $OUT
npx esbuild scripts/balance/run.ts --bundle --platform=node --format=esm --outfile=$OUT/run.mjs
npx esbuild scripts/balance/extra.ts --bundle --platform=node --format=esm --outfile=$OUT/extra.mjs
for s in 0 1 2 3; do node $OUT/run.mjs $s 4 $OUT/full-$s.json 1 & done; wait   # escala 1 ≈ 30 min con 4 núcleos
for s in 0 1 2 3; do node $OUT/extra.mjs $s 4 $OUT/extra-$s.json & done; wait
python3 scripts/balance/report.py $OUT informe.pdf scripts/balance/texto.json
```

El último argumento de `run.mjs` escala el número de partidas (0.02 para una prueba rápida).
