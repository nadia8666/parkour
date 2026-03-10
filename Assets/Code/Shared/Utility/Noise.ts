//--!native
//--!optimize 2

const Floor = math.floor;
const Sqrt = math.sqrt;
const Abs = math.abs;

const F2: number = 0.5 * (Sqrt(3) - 1);
const G2: number = (3 - Sqrt(3)) / 6;
const F3: number = 1 / 3;
const G3: number = 1 / 6;

const Gradients: number[] = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];

export class NoiseHandler {
	private _perm: number[];
	private _perm12: number[];

	private _c2DBatch = new Map<string, number[]>();
	private _c3DBatch = new Map<string, number[]>();
	private _cCaveBatch = new Map<string, number[]>();

	constructor(seed?: number) {
		const actualSeed: number = seed !== undefined ? seed : math.random(-2147483648, 2147483647);
		math.randomseed(actualSeed);

		const p: number[] = new Array(512);
		const p12: number[] = new Array(512);

		for (let i: number = 0; i < 512; i++) {
			p[i] = i % 256;
		}

		for (let i: number = 511; i >= 1; i--) {
			const j: number = math.random(0, i);
			const temp: number = p[i];
			p[i] = p[j];
			p[j] = temp;
		}

		for (let i: number = 0; i < 512; i++) {
			const val = p[i % 256];
			p[i] = val;
			p12[i] = val % 12;
		}

		this._perm = p;
		this._perm12 = p12;
	}

	private cacheBatch(map: Map<string, number[]>, key: string, results: number[]): void {
		if (map.size() >= 256) map.clear();
		const clone = new Array<number>(results.size());
		for (let i = 0; i < results.size(); i++) clone[i] = results[i];
		map.set(key, clone);
	}

	public Get2DValue(x: number, y: number): number {
		const p = this._perm;
		const p12 = this._perm12;

		const s: number = (x + y) * F2;
		const i: number = Floor(x + s);
		const j: number = Floor(y + s);

		const t: number = (i + j) * G2;
		const x0: number = x - (i - t);
		const y0: number = y - (j - t);

		let i1: number, j1: number;
		if (x0 > y0) {
			i1 = 1;
			j1 = 0;
		} else {
			i1 = 0;
			j1 = 1;
		}

		const x1: number = x0 - i1 + G2;
		const y1: number = y0 - j1 + G2;
		const x2: number = x0 - 1 + 2 * G2;
		const y2: number = y0 - 1 + 2 * G2;

		const ii: number = i % 256;
		const jj: number = j % 256;

		const gi0: number = p12[ii + p[jj]];
		const gi1: number = p12[ii + i1 + p[jj + j1]];
		const gi2: number = p12[ii + 1 + p[jj + 1]];

		let n0: number = 0,
			n1: number = 0,
			n2: number = 0;

		let t0: number = 0.5 - x0 * x0 - y0 * y0;
		if (t0 > 0) {
			t0 *= t0;
			const o0 = gi0 * 3;
			n0 = t0 * t0 * (Gradients[o0] * x0 + Gradients[o0 + 1] * y0);
		}

		let t1: number = 0.5 - x1 * x1 - y1 * y1;
		if (t1 > 0) {
			t1 *= t1;
			const o1 = gi1 * 3;
			n1 = t1 * t1 * (Gradients[o1] * x1 + Gradients[o1 + 1] * y1);
		}

		let t2: number = 0.5 - x2 * x2 - y2 * y2;
		if (t2 > 0) {
			t2 *= t2;
			const o2 = gi2 * 3;
			n2 = t2 * t2 * (Gradients[o2] * x2 + Gradients[o2 + 1] * y2);
		}

		return 70 * (n0 + n1 + n2);
	}

	public Get3DValue(x: number, y: number, z: number): number {
		const p = this._perm;
		const p12 = this._perm12;

		const s: number = (x + y + z) * F3;
		const i: number = Floor(x + s);
		const j: number = Floor(y + s);
		const k: number = Floor(z + s);

		const t: number = (i + j + k) * G3;
		const x0: number = x - (i - t);
		const y0: number = y - (j - t);
		const z0: number = z - (k - t);

		let i1: number, j1: number, k1: number;
		let i2: number, j2: number, k2: number;

		if (x0 >= y0) {
			if (y0 >= z0) {
				i1 = 1;
				j1 = 0;
				k1 = 0;
				i2 = 1;
				j2 = 1;
				k2 = 0;
			} else if (x0 >= z0) {
				i1 = 1;
				j1 = 0;
				k1 = 0;
				i2 = 1;
				j2 = 0;
				k2 = 1;
			} else {
				i1 = 0;
				j1 = 0;
				k1 = 1;
				i2 = 1;
				j2 = 0;
				k2 = 1;
			}
		} else {
			if (y0 < z0) {
				i1 = 0;
				j1 = 0;
				k1 = 1;
				i2 = 0;
				j2 = 1;
				k2 = 1;
			} else if (x0 < z0) {
				i1 = 0;
				j1 = 1;
				k1 = 0;
				i2 = 0;
				j2 = 1;
				k2 = 1;
			} else {
				i1 = 0;
				j1 = 1;
				k1 = 0;
				i2 = 1;
				j2 = 1;
				k2 = 0;
			}
		}

		const x1: number = x0 - i1 + G3;
		const y1: number = y0 - j1 + G3;
		const z1: number = z0 - k1 + G3;
		const x2: number = x0 - i2 + 2 * G3;
		const y2: number = y0 - j2 + 2 * G3;
		const z2: number = z0 - k2 + 2 * G3;
		const x3: number = x0 - 1 + 3 * G3;
		const y3: number = y0 - 1 + 3 * G3;
		const z3: number = z0 - 1 + 3 * G3;

		const ii: number = i % 256;
		const jj: number = j % 256;
		const kk: number = k % 256;

		const gi0: number = p12[ii + p[jj + p[kk]]];
		const gi1: number = p12[ii + i1 + p[jj + j1 + p[kk + k1]]];
		const gi2: number = p12[ii + i2 + p[jj + j2 + p[kk + k2]]];
		const gi3: number = p12[ii + 1 + p[jj + 1 + p[kk + 1]]];

		let n0: number = 0,
			n1: number = 0,
			n2: number = 0,
			n3: number = 0;

		let t0: number = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
		if (t0 > 0) {
			t0 *= t0;
			const o0 = gi0 * 3;
			n0 = t0 * t0 * (Gradients[o0] * x0 + Gradients[o0 + 1] * y0 + Gradients[o0 + 2] * z0);
		}

		let t1: number = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
		if (t1 > 0) {
			t1 *= t1;
			const o1 = gi1 * 3;
			n1 = t1 * t1 * (Gradients[o1] * x1 + Gradients[o1 + 1] * y1 + Gradients[o1 + 2] * z1);
		}

		let t2: number = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
		if (t2 > 0) {
			t2 *= t2;
			const o2 = gi2 * 3;
			n2 = t2 * t2 * (Gradients[o2] * x2 + Gradients[o2 + 1] * y2 + Gradients[o2 + 2] * z2);
		}

		let t3: number = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
		if (t3 > 0) {
			t3 *= t3;
			const o3 = gi3 * 3;
			n3 = t3 * t3 * (Gradients[o3] * x3 + Gradients[o3 + 1] * y3 + Gradients[o3 + 2] * z3);
		}

		return 32 * (n0 + n1 + n2 + n3);
	}

	public Get3DFBM(x: number, y: number, z: number, amplitude: number, frequency: number, octaveCount: number, persistence: number, lacunarity: number): number {
		let value: number = 0;
		let maxAmplitude: number = 0;
		let cAmp: number = amplitude;
		let cFreq: number = frequency;

		for (let i: number = 1; i <= octaveCount; i++) {
			if (cAmp < 0.001) break;
			value += cAmp * this.Get3DValue(x * cFreq, y * cFreq, z * cFreq);
			maxAmplitude += cAmp;
			cAmp *= persistence;
			cFreq *= lacunarity;
		}

		return maxAmplitude > 0 ? value / maxAmplitude : 0;
	}

	public Get3DFBMBatch(
		offsetX: number,
		offsetY: number,
		offsetZ: number,
		width: number,
		height: number,
		depth: number,
		results: number[],
		amplitude: number,
		frequency: number,
		octaveCount: number,
		persistence: number,
		lacunarity: number,
	): number[] {
		const key = `${offsetX}_${offsetY}_${offsetZ}_${amplitude}_${frequency}_${octaveCount}`;
		const cached = this._c3DBatch.get(key);
		if (cached) {
			for (let i = 0; i < cached.size(); i++) results[i] = cached[i];
			return results;
		}

		const octaveParams: { amplitude: number; frequency: number }[] = [];
		let cAmp: number = amplitude;
		let cFreq: number = frequency;
		let maxAmplitude: number = 0;

		for (let i: number = 1; i <= octaveCount; i++) {
			if (cAmp < 0.001) break;
			octaveParams.push({ amplitude: cAmp, frequency: cFreq });
			maxAmplitude += cAmp;
			cAmp *= persistence;
			cFreq *= lacunarity;
		}

		for (let z: number = 0; z < depth; z++) {
			for (let y: number = 0; y < height; y++) {
				for (let x: number = 0; x < width; x++) {
					let value: number = 0;
					for (let p: number = 0; p < octaveParams.size(); p++) {
						const params = octaveParams[p];
						value += params.amplitude * this.Get3DValue((x + offsetX) * params.frequency, (y + offsetY) * params.frequency, (z + offsetZ) * params.frequency);
					}
					results[z * width * height + y * width + x] = maxAmplitude > 0 ? value / maxAmplitude : 0;
				}
			}
		}

		this.cacheBatch(this._c3DBatch, key, results);
		return results;
	}

	public Get2DFBM(x: number, y: number, amplitude: number, frequency: number, octaveCount: number, persistence: number, lacunarity: number): number {
		let value: number = 0;
		let maxAmplitude: number = 0;
		let cAmp: number = amplitude;
		let cFreq: number = frequency;

		for (let i: number = 1; i <= octaveCount; i++) {
			if (cAmp < 0.001) break;
			value += cAmp * this.Get2DValue(x * cFreq, y * cFreq);
			maxAmplitude += cAmp;
			cAmp *= persistence;
			cFreq *= lacunarity;
		}

		return maxAmplitude > 0 ? value / maxAmplitude : 0;
	}

	public Get2DFBMBatch(
		offsetX: number,
		offsetY: number,
		width: number,
		height: number,
		results: number[],
		amplitude: number,
		frequency: number,
		octaveCount: number,
		persistence: number,
		lacunarity: number,
	): number[] {
		const key = `${offsetX}_${offsetY}_${amplitude}_${frequency}_${octaveCount}`;
		const cached = this._c2DBatch.get(key);
		if (cached) {
			for (let i = 0; i < cached.size(); i++) results[i] = cached[i];
			return results;
		}

		const p = this._perm;
		const p12 = this._perm12;

		const octaveParams: { amplitude: number; frequency: number }[] = [];
		let cAmp: number = amplitude;
		let cFreq: number = frequency;
		let maxAmplitude: number = 0;

		for (let i: number = 1; i <= octaveCount; i++) {
			if (cAmp < 0.001) break;
			octaveParams.push({ amplitude: cAmp, frequency: cFreq });
			maxAmplitude += cAmp;
			cAmp *= persistence;
			cFreq *= lacunarity;
		}

		for (let y: number = 0; y < height; y++) {
			for (let x: number = 0; x < width; x++) {
				let value: number = 0;

				for (let o: number = 0; o < octaveParams.size(); o++) {
					const params = octaveParams[o];
					const freqX: number = (x + offsetX) * params.frequency;
					const freqY: number = (y + offsetY) * params.frequency;

					const s: number = (freqX + freqY) * F2;
					const ix: number = Floor(freqX + s);
					const jy: number = Floor(freqY + s);

					const t: number = (ix + jy) * G2;
					const x0: number = freqX - (ix - t);
					const y0: number = freqY - (jy - t);

					let i1: number, j1: number;
					if (x0 > y0) {
						i1 = 1;
						j1 = 0;
					} else {
						i1 = 0;
						j1 = 1;
					}

					const x1: number = x0 - i1 + G2;
					const y1: number = y0 - j1 + G2;
					const x2: number = x0 - 1 + 2 * G2;
					const y2: number = y0 - 1 + 2 * G2;

					const ii: number = ix % 256;
					const jj: number = jy % 256;

					const gi0: number = p12[ii + p[jj]];
					const gi1: number = p12[ii + i1 + p[jj + j1]];
					const gi2: number = p12[ii + 1 + p[jj + 1]];

					let n0: number = 0,
						n1: number = 0,
						n2: number = 0;

					let t0: number = 0.5 - x0 * x0 - y0 * y0;
					if (t0 > 0) {
						t0 *= t0;
						const o0 = gi0 * 3;
						n0 = t0 * t0 * (Gradients[o0] * x0 + Gradients[o0 + 1] * y0);
					}

					let t1: number = 0.5 - x1 * x1 - y1 * y1;
					if (t1 > 0) {
						t1 *= t1;
						const o1 = gi1 * 3;
						n1 = t1 * t1 * (Gradients[o1] * x1 + Gradients[o1 + 1] * y1);
					}

					let t2: number = 0.5 - x2 * x2 - y2 * y2;
					if (t2 > 0) {
						t2 *= t2;
						const o2 = gi2 * 3;
						n2 = t2 * t2 * (Gradients[o2] * x2 + Gradients[o2 + 1] * y2);
					}

					value += params.amplitude * 70 * (n0 + n1 + n2);
				}

				results[y * width + x] = maxAmplitude > 0 ? value / maxAmplitude : 0;
			}
		}

		this.cacheBatch(this._c2DBatch, key, results);
		return results;
	}

	public Get2DBatch(offsetX: number, offsetY: number, width: number, height: number, results: number[], frequency: number = 1): number[] {
		const p = this._perm;
		const p12 = this._perm12;

		for (let y: number = 0; y < height; y++) {
			for (let x: number = 0; x < width; x++) {
				const posX: number = (x + offsetX) * frequency;
				const posY: number = (y + offsetY) * frequency;

				const s: number = (posX + posY) * F2;
				const ix: number = Floor(posX + s);
				const jy: number = Floor(posY + s);

				const t: number = (ix + jy) * G2;
				const x0: number = posX - (ix - t);
				const y0: number = posY - (jy - t);

				let i1: number, j1: number;
				if (x0 > y0) {
					i1 = 1;
					j1 = 0;
				} else {
					i1 = 0;
					j1 = 1;
				}

				const x1: number = x0 - i1 + G2;
				const y1: number = y0 - j1 + G2;
				const x2: number = x0 - 1 + 2 * G2;
				const y2: number = y0 - 1 + 2 * G2;

				const ii: number = ix % 256;
				const jj: number = jy % 256;

				const gi0: number = p12[ii + p[jj]];
				const gi1: number = p12[ii + i1 + p[jj + j1]];
				const gi2: number = p12[ii + 1 + p[jj + 1]];

				let n0: number = 0,
					n1: number = 0,
					n2: number = 0;

				let t0: number = 0.5 - x0 * x0 - y0 * y0;
				if (t0 > 0) {
					t0 *= t0;
					const o0 = gi0 * 3;
					n0 = t0 * t0 * (Gradients[o0] * x0 + Gradients[o0 + 1] * y0);
				}

				let t1: number = 0.5 - x1 * x1 - y1 * y1;
				if (t1 > 0) {
					t1 *= t1;
					const o1 = gi1 * 3;
					n1 = t1 * t1 * (Gradients[o1] * x1 + Gradients[o1 + 1] * y1);
				}

				let t2: number = 0.5 - x2 * x2 - y2 * y2;
				if (t2 > 0) {
					t2 *= t2;
					const o2 = gi2 * 3;
					n2 = t2 * t2 * (Gradients[o2] * x2 + Gradients[o2 + 1] * y2);
				}

				results[y * width + x] = 70 * (n0 + n1 + n2);
			}
		}
		return results;
	}

	public GetDoubleRidgeValue(x: number, y: number, z: number, frequency: number): number {
		const offset: number = 54.32;
		const n1: number = this.Get3DValue(x * frequency, y * frequency, z * frequency);
		const n2: number = this.Get3DValue((x + offset) * frequency, (y + offset) * frequency, (z + offset) * frequency);
		return (1 - Abs(n1)) * (1 - Abs(n2));
	}

	public GetCaveBatch(offsetX: number, offsetY: number, offsetZ: number, width: number, height: number, depth: number, results: number[], frequency: number): number[] {
		const key = `${offsetX}_${offsetY}_${offsetZ}_${frequency}`;
		const cached = this._cCaveBatch.get(key);
		if (cached) {
			for (let i = 0; i < cached.size(); i++) results[i] = cached[i];
			return results;
		}

		const offset2: number = 54.32;

		for (let z: number = 0; z < depth; z++) {
			const pZ: number = (z + offsetZ) * frequency;
			const pZ2: number = (z + offsetZ + offset2) * frequency;

			for (let y: number = 0; y < height; y++) {
				const pY: number = (y + offsetY) * frequency;
				const pY2: number = (y + offsetY + offset2) * frequency;

				for (let x: number = 0; x < width; x++) {
					const pX: number = (x + offsetX) * frequency;
					const pX2: number = (x + offsetX + offset2) * frequency;

					const n1: number = this.Get3DValue(pX, pY, pZ);
					const n2: number = this.Get3DValue(pX2, pY2, pZ2);

					results[z * width * height + y * width + x] = (1 - Abs(n1)) * (1 - Abs(n2));
				}
			}
		}

		this.cacheBatch(this._cCaveBatch, key, results);
		return results;
	}
}
