import { WithGear } from "Code/Client/Config";

export type ValidAnimation = keyof typeof Animations;
export interface InferredAnimation {
	[Index: number]: {
		Name: string | (() => string);
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
	VM_Idle: {
		0: { Name: "VM_Idle" },
	},

	VM_Fall: {
		0: { Name: "VM_Fall" },
	},

	VM_Run: {
		0: { Name: "VM_Run" },
	},

	VM_Wallclimb: {
		0: { Name: WithGear({ None: "VM_Wallclimb", GripGlove: "VM_WallclimbGrip" }) },
	},

	VM_LedgeGrab: {
		0: { Name: "VM_LedgeGrab" },
		EndAnimation: "VM_Fall",
	},
	VM_Vault: {
		0: { Name: "VM_Vault" },
		EndAnimation: "VM_Fall",
	},

	VM_LongJump: {
		0: { Name: "VM_LongJump" },
		EndAnimation: "VM_Fall",
	},

	VM_JumpL: {
		0: { Name: "VM_JumpL" },
		EndAnimation: "VM_Fall",
	},
	VM_JumpR: {
		0: { Name: "VM_JumpR" },
		EndAnimation: "VM_Fall",
	},

	VM_JumpLWallrun: {
		0: { Name: "VM_JumpLWallrun" },
		EndAnimation: "VM_Fall",
	},
	VM_JumpRWallrun: {
		0: { Name: "VM_JumpRWallrun" },
		EndAnimation: "VM_Fall",
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
			Name: string | (() => string);
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
	public Current: ValidAnimation = "VM_Idle";
	public Speed: number = 1;
	public ClientSpeed: Vector3 = Vector3.zero;
	public Last: ValidAnimation = "VM_Run";
	public WeightLayers = {
		0: { Target: 1, Current: 1 },
	};

	public AnimList = Animations;
}
