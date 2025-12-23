export type ValidAnimation = keyof typeof Animations;
export interface InferredAnimation {
	[Index: number]: {
		Name: string;
		Position?: number;
		Speed?: {
			Base: number;
			Increment: number;
			Absolute: boolean;
		};
	};
}

export interface AnimationData {
	EndAnimation?: ValidAnimation;
	Transitions?: {
		From?: {
			[Index: string]: number | undefined;
			All?: number;
		};
		To?: {
			[Index: string]: number | undefined;
			All?: number;
		};
	};
}

export type SetAnimation = InferredAnimation & AnimationData;

export const Animations = {
	Idle: {
		0: { Name: "Idle" },
	},

	VM_Run: {
		0: { Name: "VM_Run" },
	},

	VM_Wallclimb: {
		0: { Name: "VM_Wallclimb" },
	},

	VM_LedgeGrab: {
		0: { Name: "VM_LedgeGrab" },
		EndAnimation: "Idle",
	},

	VM_JumpL: {
		0: { Name: "VM_JumpL" },
		EndAnimation: "Idle",
	},
	VM_JumpR: {
		0: { Name: "VM_JumpR" },
		EndAnimation: "Idle",
	},

	VM_WallrunL: {
		0: { Name: "VM_WallrunL" },
	},
	VM_WallrunR: {
		0: { Name: "VM_WallrunR" },
	},
} as const satisfies {
	[Index: string]: {
		[Index: number]: {
			Name: string;
			Position?: number;
			Speed?: {
				Base: number;
				Increment: number;
				Absolute: boolean;
			};
		};
	} & {
		EndAnimation?: string;
		Transitions?: AnimationData["Transitions"];
	};
};

export default class AnimationController extends AirshipSingleton {
	public Current: ValidAnimation;
	public Speed: number = 1;
	public ClientSpeed: Vector3 = Vector3.zero;
	public Last: ValidAnimation;
	public WeightLayers = {
		0: { Target: 1, Current: 1 },
	};

	public AnimList = Animations;
}
