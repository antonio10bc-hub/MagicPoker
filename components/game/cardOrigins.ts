// Última posición conocida (en coordenadas del escenario) de cada carta de la mano.
// Sirve para que, al jugarla, la carta salga volando desde donde estaba.
export const cardOrigins = new Map<string, { x: number; y: number }>();
