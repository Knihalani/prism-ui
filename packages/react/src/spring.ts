export interface SpringOptions { response: number; damping: number; samples?: number }
export function spring({ response, damping, samples = 40 }: SpringOptions) {
  if (!Number.isFinite(response) || response <= 0 || !Number.isFinite(damping) || damping <= 0 || !Number.isInteger(samples) || samples < 2 || samples > 1000) throw new RangeError('Invalid spring parameters');
  const frequency = 2 * Math.PI / response;
  const step = Math.min(1 / 1000, 1 / (frequency * Math.max(1, damping) * 20));
  const positions = [0];
  let position = 0, velocity = 0, time = 0;
  while (Math.hypot(1 - position, velocity / frequency) > .001) {
    velocity += ((1 - position) * frequency ** 2 - 2 * damping * frequency * velocity) * step;
    position += velocity * step; time += step; positions.push(position);
    if (positions.length > 2_000_000) throw new RangeError('Spring takes too long to settle');
  }
  const duration = Math.ceil(time * 1000);
  const values = Array.from({ length: samples }, (_, i) => i === samples - 1 ? 1 : Math.round(positions[Math.round(i / (samples - 1) * (positions.length - 1))] * 1000) / 1000);
  return { easing: `linear(${values.join(', ')})`, duration };
}

export const snappy = spring({ response: .35, damping: .85 });
export const bouncy = spring({ response: .4, damping: .7 });
