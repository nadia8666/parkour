import { Signal } from "@Easy/Core/Shared/Util/Signal";
import type { GearRegistryKey } from "Code/Shared/GearRegistry";
import DataController from "./Framework/DataController";

const RecacheSignal = new Signal();
const CacheMap: GearRegistryKey[] = [];
let HasCached = false;
function InitializeCache() {
	if (HasCached) return;
	HasCached = true;

	const Link = DataController.Get().GetLink();

	function GenerateCache() {
		CacheMap.clear();
		for (const [_, Gear] of pairs(Link.Data.EquippedGear)) {
			for (const [_, Value] of pairs(Gear)) {
				if (Value !== "None") {
					CacheMap.push(Value);
				}
			}
		}

		RecacheSignal.Fire();
	}

	for (const [Slot, Gear] of pairs(Link.Data.EquippedGear)) {
		for (const [Index] of pairs(Gear)) {
			Link.GetChanged(`EquippedGear/${Slot}/${Index}`).Connect(() => GenerateCache());
		}
	}
}
if ($CLIENT) task.spawn(() => InitializeCache());

export function WithGear<T>(ValueMap: { None: T } & { [K in GearRegistryKey]?: T }) {
	let CachedValue: T | undefined;
	RecacheSignal.Connect(() => {
		CachedValue = undefined;
	});

	return (): T => {
		if (CachedValue !== undefined) return CachedValue;

		for (const [_, Gear] of pairs(CacheMap)) {
			let Mapped: unknown;

			// biome-ignore lint/suspicious/noAssignInExpressions: clean
			if ((Mapped = ValueMap[Gear])) {
				CachedValue = Mapped as T;
				break;
			}
		}

		CachedValue ??= ValueMap.None;

		return CachedValue as T;
	};
}

const Config = {
	Gravity: new Vector3(0, -1, 0),

	JumpRequiredSpeed: 3, // jump height under this speed is scaled from 0-spd to 0-1
	JumpCoyoteTime: 0.25,

	WallClimbMinSpeed: WithGear({ None: 2.25, SlipGlove: -10, GripGlove: 7 }), // upwards speed in wallclimb is max(spd, min)
	WallClimbThreshold: WithGear({ None: -10, SlipGlove: -65, GripGlove: -45 }), // maximum velocity before you cant wallclimb

	WallrunCoyoteTime: 0.25, // time before you are dropped off of a wallrun without a wall next to you
	WallrunMinSpeed: 7, // forward wallrun speed is max(spd, min)
	WallrunGravity: WithGear({ None: 0.85, SlipGlove: 0.7 }), // multiplier for global gravity while wallrunning
	WallrunThreshold: WithGear({ None: -75, SlipGlove: -135 }), // maximum velocity before you cant wallrun
	WallrunSpeedBoost: 1.15, // multiplier for converted wallrun velocity (wr speed = in speed * boost)
	WallrunJumpForce: new Vector2(8, 15),

	LedgeGrabForwardSpeed: WithGear({ None: 2, ARCBrace: 12 }), // how much extra velocity should be added for forward ledgegrabs
	LedgeGrabForwardY: WithGear({ None: 1, ARCBrace: 1.35 }), // how much forward velocity should be converted into y velocity on ledgegrab forward

	LongJumpForce: 18,
	LongJumpHeightMultiplier: 0.45,

	DashLengthGrounded: 1.5,
	DashLengthAirborne: 0.5,
	DashCooldown: 0.75,
};

export default Config;
