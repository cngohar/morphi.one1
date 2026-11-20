import { motion } from '#lib/ui/motion.js';

export function shapeDivisionEntrance(path: SVGPathElement, duration: number, ready: () => void) {
	return motion.shapeDivision(path, 'entrance', duration, ready);
}

export function shapeDivisionDetach(piece: SVGElement, lift: SVGElement) {
	return motion.shapeDivision(piece, 'detach', 300, undefined, lift);
}
