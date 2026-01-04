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

const inf = 9000

const Config = {
	Gravity: new Vector3(0, -35, 0),
	PlayerRadius: 0.5,
	PlayerHeight: 1,

	JumpRequiredSpeed: 5, // jump height under this speed is scaled from 0-spd to 0-1
	JumpCoyoteTime: 0.25,

	WallclimbMinSpeed: WithGear({ None: 2.25, SlipGlove: -10, GripGlove: 7 }), // upwards speed in wallclimb is max(spd, min)
	WallclimbThreshold: WithGear({ None: -15, SlipGlove: -65, GripGlove: -45 }), // maximum velocity before you cant wallclimb
	WallclimbCoyoteTime: 0.25, // time before you are dropped off a wallclimb without a wall in front of you

	WallrunCoyoteTime: 0.1, // time before you are dropped off of a wallrun without a wall next to you
	WallrunMinSpeed: 6, // forward wallrun speed is max(spd, min)
	WallrunMaxSpeed: WithGear({ None: 18, SlipGlove: inf, GripGlove: 22.5}), //forward wallrun speed on jump is min(spd, max)
	WallrunGravity: WithGear({ None: 0.85, SlipGlove: 0.7 }), // multiplier for global gravity while wallrunning
	WallrunThreshold: WithGear({ None: -35, SlipGlove: -inf, GripGlove: -40 }), // maximum y velocity before you cant wallrun
	WallrunJumpForce: new Vector2(0, 15),

	LedgeGrabForwardSpeed: WithGear({ None: 2, ARCBrace: 12 }), // how much extra velocity should be added for forward ledgegrabs
	LedgeGrabForwardY: WithGear({ None: 0.35, ARCBrace: 0.85 }), // how much forward velocity should be converted into y velocity on ledgegrab forward
	LedgeGrabUpSpeed: WithGear({ None: 0, ARCBrace: 12 }),

	LongJumpForce: 6.5,
	LongJumpHeightMultiplier: 0.45,

	DashLengthGrounded: 1.5,
	DashLengthAirborne: 1.5,
	DashCooldown: 0.15,

	SlideThreshold: 5, // required speed to activate slide

	ReferenceFPS: 40, // the original fps before it was bumped up to 120

	FallDamageMaxSurvivable: 75,
	FallDamgeRollTime: 0.75,
	FallDamageThreshold: 25, // speed at which fall damage begins
	FallDamageMultiplier: 4.15, // damage per unit speed above threshold

	MomentumSyncThreshold: 0.15,
};

export default Config;
