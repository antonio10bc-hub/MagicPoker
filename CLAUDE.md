# Instrucciones para Claude

- Al terminar cualquier cambio, haz commit y push sin preguntar, a la rama de trabajo y también a `main` (la web publicada se despliega desde `main`).
- Antes de hacer push, ejecuta `npm test`, `npm run typecheck` y `npm run lint`.
- El estilo visual se rige por `ART_DIRECTION.md`. La lógica de juego (`lib/`, `store/`) no se toca en cambios puramente visuales.
