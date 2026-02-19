//--!native
//--!optimize 2

const Floor = math.floor;
const Sqrt = math.sqrt;
const BufferCreate = buffer.create;
const BufferReadU8 = buffer.readu8;
const BufferReadI8 = buffer.readi8;
const BufferWriteU8 = buffer.writeu8;
const BufferWriteI8 = buffer.writei8;

const F2: number = 0.5 * (Sqrt(3) - 1);
const G2: number = (3 - Sqrt(3)) / 6;
const F3: number = 1 / 3;
const G3: number = 1 / 6;

const GradBuffer: buffer = BufferCreate(36);

const Gradients: number[] = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];

for (let i: number = 0; i < 36; i++) {
	BufferWriteI8(GradBuffer, i, Gradients[i]);
}

function Dot2(gi: number, x: number, y: number): number {
	const offset: number = gi * 3;
	return BufferReadI8(GradBuffer, offset) * x + BufferReadI8(GradBuffer, offset + 1) * y;
}

function Dot3(gi: number, x: number, y: number, z: number): number {
	const offset: number = gi * 3;
	return BufferReadI8(GradBuffer, offset) * x + BufferReadI8(GradBuffer, offset + 1) * y + BufferReadI8(GradBuffer, offset + 2) * z;
}

export class NoiseHandler {
	private _permBuffer: buffer;
	private _perm12Buffer: buffer;

	constructor(seed?: number) {
		const permBuffer: buffer = BufferCreate(512);
		const perm12Buffer: buffer = BufferCreate(512);

		const actualSeed: number = seed !== undefined ? seed : math.random(-2147483648, 2147483647);
		math.randomseed(actualSeed);

		for (let i: number = 0; i < 512; i++) {
			BufferWriteU8(permBuffer, i, i % 256);
		}

		for (let i: number = 511; i >= 1; i--) {
			const j: number = math.random(0, i);
			const temp: number = BufferReadU8(permBuffer, i);
			BufferWriteU8(permBuffer, i, BufferReadU8(permBuffer, j));
			BufferWriteU8(permBuffer, j, temp);
		}

		for (let i: number = 0; i < 512; i++) {
			const val: number = BufferReadU8(permBuffer, i % 256);
			BufferWriteU8(permBuffer, i, val);
			BufferWriteU8(perm12Buffer, i, val % 12);
		}

		this._permBuffer = permBuffer;
		this._perm12Buffer = perm12Buffer;
	}

	public Get2DValue(x: number, y: number): number {
		const permBuffer: buffer = this._permBuffer;
		const perm12Buffer: buffer = this._perm12Buffer;

		const s: number = (x + y) * F2;
		const i: number = Floor(x + s);
		const j: number = Floor(y + s);

		const t: number = (i + j) * G2;
		const x0: number = x - (i - t);
		const y0: number = y - (j - t);

		let i1: number;
		let j1: number;
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

		const gi0: number = BufferReadU8(perm12Buffer, ii + BufferReadU8(permBuffer, jj));
		const gi1: number = BufferReadU8(perm12Buffer, ii + i1 + BufferReadU8(permBuffer, jj + j1));
		const gi2: number = BufferReadU8(perm12Buffer, ii + 1 + BufferReadU8(permBuffer, jj + 1));

		let n0: number = 0;
		let n1: number = 0;
		let n2: number = 0;

		let t0: number = 0.5 - x0 * x0 - y0 * y0;
		if (t0 > 0) {
			t0 = t0 * t0;
			n0 = t0 * t0 * Dot2(gi0, x0, y0);
		}

		let t1: number = 0.5 - x1 * x1 - y1 * y1;
		if (t1 > 0) {
			t1 = t1 * t1;
			n1 = t1 * t1 * Dot2(gi1, x1, y1);
		}

		let t2: number = 0.5 - x2 * x2 - y2 * y2;
		if (t2 > 0) {
			t2 = t2 * t2;
			n2 = t2 * t2 * Dot2(gi2, x2, y2);
		}

		return 70 * (n0 + n1 + n2);
	}

	public Get3DValue(x: number, y: number, z: number): number {
		const permBuffer: buffer = this._permBuffer;
		const perm12Buffer: buffer = this._perm12Buffer;

		const s: number = (x + y + z) * F3;
		const i: number = Floor(x + s);
		const j: number = Floor(y + s);
		const k: number = Floor(z + s);

		const t: number = (i + j + k) * G3;
		const x0: number = x - (i - t);
		const y0: number = y - (j - t);
		const z0: number = z - (k - t);

		let i1: number;
		let j1: number;
		let k1: number;
		let i2: number;
		let j2: number;
		let k2: number;

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

		const gi0: number = BufferReadU8(perm12Buffer, ii + BufferReadU8(permBuffer, jj + BufferReadU8(permBuffer, kk)));
		const gi1: number = BufferReadU8(perm12Buffer, ii + i1 + BufferReadU8(permBuffer, jj + j1 + BufferReadU8(permBuffer, kk + k1)));
		const gi2: number = BufferReadU8(perm12Buffer, ii + i2 + BufferReadU8(permBuffer, jj + j2 + BufferReadU8(permBuffer, kk + k2)));
		const gi3: number = BufferReadU8(perm12Buffer, ii + 1 + BufferReadU8(permBuffer, jj + 1 + BufferReadU8(permBuffer, kk + 1)));

		let n0: number = 0;
		let n1: number = 0;
		let n2: number = 0;
		let n3: number = 0;

		let t0: number = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
		if (t0 > 0) {
			t0 = t0 * t0;
			n0 = t0 * t0 * Dot3(gi0, x0, y0, z0);
		}

		let t1: number = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
		if (t1 > 0) {
			t1 = t1 * t1;
			n1 = t1 * t1 * Dot3(gi1, x1, y1, z1);
		}

		let t2: number = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
		if (t2 > 0) {
			t2 = t2 * t2;
			n2 = t2 * t2 * Dot3(gi2, x2, y2, z2);
		}

		let t3: number = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
		if (t3 > 0) {
			t3 = t3 * t3;
			n3 = t3 * t3 * Dot3(gi3, x3, y3, z3);
		}

		return 32 * (n0 + n1 + n2 + n3);
	}

	public Get3DFBM(x: number, y: number, z: number, amplitude: number, frequency: number, octaveCount: number, persistence: number, lacunarity: number): number {
		let value: number = 0;
		let maxAmplitude: number = 0;
		let currentAmplitude: number = amplitude;
		let currentFrequency: number = frequency;

		for (let i: number = 1; i <= octaveCount; i++) {
			if (currentAmplitude < 0.001) break;

			value = value + currentAmplitude * this.Get3DValue(x * currentFrequency, y * currentFrequency, z * currentFrequency);
			maxAmplitude = maxAmplitude + currentAmplitude;
			currentAmplitude = currentAmplitude * persistence;
			currentFrequency = currentFrequency * lacunarity;
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
		const octaveParams: { amplitude: number; frequency: number }[] = [];
		let currentAmplitude: number = amplitude;
		let currentFrequency: number = frequency;
		let maxAmplitude: number = 0;

		for (let i: number = 1; i <= octaveCount; i++) {
			if (currentAmplitude < 0.001) break;
			octaveParams.push({ amplitude: currentAmplitude, frequency: currentFrequency });
			maxAmplitude = maxAmplitude + currentAmplitude;
			currentAmplitude = currentAmplitude * persistence;
			currentFrequency = currentFrequency * lacunarity;
		}

		for (let z: number = 0; z < depth; z++) {
			for (let y: number = 0; y < height; y++) {
				for (let x: number = 0; x < width; x++) {
					let value: number = 0;

					for (let p: number = 0; p < octaveParams.size(); p++) {
						const params = octaveParams[p];
						value = value + params.amplitude * this.Get3DValue((x + offsetX) * params.frequency, (y + offsetY) * params.frequency, (z + offsetZ) * params.frequency);
					}

					const index: number = z * width * height + y * width + x;
					results[index] = maxAmplitude > 0 ? value / maxAmplitude : 0;
				}
			}
		}
		return results;
	}

	public Get2DFBM(x: number, y: number, amplitude: number, frequency: number, octaveCount: number, persistence: number, lacunarity: number): number {
		let value: number = 0;
		let maxAmplitude: number = 0;
		let currentAmplitude: number = amplitude;
		let currentFrequency: number = frequency;

		for (let i: number = 1; i <= octaveCount; i++) {
			if (currentAmplitude < 0.001) break;

			value = value + currentAmplitude * this.Get2DValue(x * currentFrequency, y * currentFrequency);
			maxAmplitude = maxAmplitude + currentAmplitude;
			currentAmplitude = currentAmplitude * persistence;
			currentFrequency = currentFrequency * lacunarity;
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
		const permBuffer: buffer = this._permBuffer;
		const perm12Buffer: buffer = this._perm12Buffer;

		const octaveParams: { amplitude: number; frequency: number }[] = [];
		let currentAmplitude: number = amplitude;
		let currentFrequency: number = frequency;
		let maxAmplitude: number = 0;

		for (let i: number = 1; i <= octaveCount; i++) {
			if (currentAmplitude < 0.001) break;
			octaveParams.push({
				amplitude: currentAmplitude,
				frequency: currentFrequency,
			});
			maxAmplitude = maxAmplitude + currentAmplitude;
			currentAmplitude = currentAmplitude * persistence;
			currentFrequency = currentFrequency * lacunarity;
		}

		for (let y: number = 0; y < height; y++) {
			for (let x: number = 0; x < width; x++) {
				let value: number = 0;

				for (let p: number = 0; p < octaveParams.size(); p++) {
					const params = octaveParams[p];
					const freqX: number = (x + offsetX) * params.frequency;
					const freqY: number = (y + offsetY) * params.frequency;

					const s: number = (freqX + freqY) * F2;
					const ix: number = Floor(freqX + s);
					const jy: number = Floor(freqY + s);

					const t: number = (ix + jy) * G2;
					const x0: number = freqX - (ix - t);
					const y0: number = freqY - (jy - t);

					let i1: number;
					let j1: number;
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

					const gi0: number = BufferReadU8(perm12Buffer, ii + BufferReadU8(permBuffer, jj));
					const gi1: number = BufferReadU8(perm12Buffer, ii + i1 + BufferReadU8(permBuffer, jj + j1));
					const gi2: number = BufferReadU8(perm12Buffer, ii + 1 + BufferReadU8(permBuffer, jj + 1));

					let n0: number = 0;
					let n1: number = 0;
					let n2: number = 0;

					let t0: number = 0.5 - x0 * x0 - y0 * y0;
					if (t0 > 0) {
						t0 = t0 * t0;
						n0 = t0 * t0 * Dot2(gi0, x0, y0);
					}

					let t1: number = 0.5 - x1 * x1 - y1 * y1;
					if (t1 > 0) {
						t1 = t1 * t1;
						n1 = t1 * t1 * Dot2(gi1, x1, y1);
					}

					let t2: number = 0.5 - x2 * x2 - y2 * y2;
					if (t2 > 0) {
						t2 = t2 * t2;
						n2 = t2 * t2 * Dot2(gi2, x2, y2);
					}

					value = value + params.amplitude * 70 * (n0 + n1 + n2);
				}

				results[y * width + x] = maxAmplitude > 0 ? value / maxAmplitude : 0;
			}
		}
		return results;
	}

	public Get2DBatch(offsetX: number, offsetY: number, width: number, height: number, results: number[], frequency: number = 1): number[] {
		const permBuffer: buffer = this._permBuffer;
		const perm12Buffer: buffer = this._perm12Buffer;

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

				let i1: number;
				let j1: number;
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

				const gi0: number = BufferReadU8(perm12Buffer, ii + BufferReadU8(permBuffer, jj));
				const gi1: number = BufferReadU8(perm12Buffer, ii + i1 + BufferReadU8(permBuffer, jj + j1));
				const gi2: number = BufferReadU8(perm12Buffer, ii + 1 + BufferReadU8(permBuffer, jj + 1));

				let n0: number = 0;
				let n1: number = 0;
				let n2: number = 0;

				let t0: number = 0.5 - x0 * x0 - y0 * y0;
				if (t0 > 0) {
					t0 = t0 * t0;
					n0 = t0 * t0 * Dot2(gi0, x0, y0);
				}

				let t1: number = 0.5 - x1 * x1 - y1 * y1;
				if (t1 > 0) {
					t1 = t1 * t1;
					n1 = t1 * t1 * Dot2(gi1, x1, y1);
				}

				let t2: number = 0.5 - x2 * x2 - y2 * y2;
				if (t2 > 0) {
					t2 = t2 * t2;
					n2 = t2 * t2 * Dot2(gi2, x2, y2);
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

		const ridge1: number = 1 - math.abs(n1);
		const ridge2: number = 1 - math.abs(n2);

		return ridge1 * ridge2;
	}

	public GetCaveBatch(offsetX: number, offsetY: number, offsetZ: number, width: number, height: number, depth: number, results: number[], frequency: number): number[] {
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

					const ridge1: number = 1 - math.abs(n1);
					const ridge2: number = 1 - math.abs(n2);

					const index: number = z * width * height + y * width + x;
					results[index] = ridge1 * ridge2;
				}
			}
		}
		return results;
	}
}
