export type Biquad = { process(x: Float32Array): Float32Array };
declare const AntaliaAudio: {
  TONE_LOW: unknown;
  TONE_HIGH: unknown;
  Biquad: new (c: unknown) => Biquad;
  postProcessAudio(samples: Float32Array, low: Biquad, high: Biquad): Float32Array;
  pauseSec(part: string): number;
};
export default AntaliaAudio;
