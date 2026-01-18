import { Signal } from "@Easy/Core/Shared/Util/Signal";
import Core from "Code/Core/Core";
import type { GearRegistryKey } from "Code/Shared/GearRegistry";
import type { ItemInfo } from "Code/Shared/Types";

export const ForceRefreshGearSignal = new Signal();
const RecacheSignal = new Signal();
const CacheMap: { [Index in GearRegistryKey]?: number } = {};
let HasCached = false;
function InitializeCache() {
	if (HasCached) return;
	HasCached = true;
	const Link = Core().Client.Data.GetLink();

	function GenerateCache() {
		for (const [Index] of pairs(CacheMap)) {
			delete CacheMap[Index];
		}

		for (const [_, Gear] of pairs(Core().Client.Objective.TimeTrials.TrialGear ?? Link.Data.EquippedGear)) {
			for (const [_, Value] of pairs(Gear)) {
				if (Value !== "None") {
					const Item = Core().Client.Gear.GetItem(Value) as ItemInfo<"Gear">;
					if (!Item) continue;
					CacheMap[Item.Key] = Item.Level;
				}
			}
		}

		RecacheSignal.Fire();

		const Actor = Core().Client.Actor;
		if (Actor) Actor.Gear.ResetAmmo();
	}

	for (const [Slot, Gear] of pairs(Link.Data.EquippedGear)) {
		for (const [Index] of pairs(Gear)) {
			Link.GetChanged(`EquippedGear/${Slot}/${Index}`).Connect(() => GenerateCache());
		}
	}

	GenerateCache();

	ForceRefreshGearSignal.Connect(() => GenerateCache());
}
if ($CLIENT) task.spawn(() => InitializeCache());

export function WithGear<T>(ValueMap: { None: T } & { [K in GearRegistryKey]?: T | T[] }) {
	let CachedValue: T | undefined;
	RecacheSignal.Connect(() => (CachedValue = undefined));

	return (): T => {
		if (CachedValue !== undefined) return CachedValue;

		for (const [GearID, Target] of pairs(ValueMap)) {
			const Level = CacheMap[GearID];

			if (Level) {
				CachedValue = typeIs(Target, "table") ? (Target as T[])[Level - 1] : (Target as T);
				if (CachedValue !== undefined) break;
			}
		}

		CachedValue ??= ValueMap.None;

		return CachedValue as T;
	};
}

const inf = 9000;

const Config = {
	Gravity: new Vector3(0, -35, 0),
	PlayerRadius: 0.5,
	PlayerHeight: 1,

	RunMaxSpeed: 15,

	JumpRequiredSpeed: 5, // jump height under this speed is scaled from 0-spd to 0-1
	JumpCoyoteTime: 0.25,

	WallclimbMinSpeed: WithGear({ None: 7, SlipGlove: -10, GripGlove: 9 }), // upwards speed in wallclimb is max(spd, min)
	WallclimbThreshold: WithGear({ None: -30, BaseGlove: -45, SlipGlove: -75, GripGlove: -55 }), // maximum velocity before you cant wallclimb
	WallclimbCoyoteTime: 0.25, // time before you are dropped off a wallclimb without a wall in front of you
	WallclimbStepStrength: WithGear({ None: 115, GripGlove: 135 }), // strength for each push of the wallclimb
	WallclimbLength: WithGear({ None: 1, BaseGlove: 1.1, SlipGlove: 1.25, GripGlove: 1.45 }),

	WallrunCoyoteTime: 0.1, // time before you are dropped off of a wallrun without a wall next to you
	WallrunMinSpeed: 6, // forward wallrun speed is max(spd, min)
	WallrunMomentumMaxSpeed: 20,
	WallrunMaxSpeed: WithGear({ None: 18, SlipGlove: inf, GripGlove: 22.5 }), //forward wallrun speed on jump is min(spd, max)
	WallrunGravity: WithGear({ None: 0.7, SlipGlove: 0.525 }), // multiplier for global gravity while wallrunning
	WallrunThreshold: WithGear({ None: -40, SlipGlove: -inf, GripGlove: -50 }), // maximum y velocity before you cant wallrun
	WallrunJumpForce: new Vector2(0, 15),
	WallrunLength: WithGear({ None: 2, SlipGlove: 3, GripGlove: 2.5 }),
	WallrunJumpKeep: WithGear({ None: false, SlipGlove: true }),
	WallrunAcceleration: 0.75 * 60,

	LedgeGrabForwardSpeed: WithGear({ None: 2, ARCBrace: 10 }), // how much extra velocity should be added for forward ledgegrabs
	LedgeGrabForwardY: WithGear({ None: 0.35, ARCBrace: 0.85 }), // how much forward velocity should be converted into y velocity on ledgegrab forward
	LedgeGrabUpSpeed: WithGear({ None: 0, ARCBrace: 8 }),

	LongJumpForce: 11.5,
	LongJumpHeightMultiplier: 0.4,
	LongJumpHeightMultiplierDropdown: 0.6,
	LongJumpGraceAirborne: 0.35, // in seconds
	LongJumpGraceGrounded: 0.35, // in seconds

	DropdownDistance: 1,
	DropdownHeight: 2,

	DashLengthGrounded: 1.5,
	DashLengthAirborne: 1.5,
	DashCooldown: 0.15,

	SlideThreshold: 2.5, // required speed to activate slide

	ReferenceFPS: 40, // the original fps before it was bumped up to 120

	FallDamageMaxSurvivable: 75,
	FallDamgeRollTime: 0.75,
	FallDamageThreshold: 25, // speed at which fall damage begins
	FallDamageMultiplier: 4.15, // damage per unit speed above threshold

	MomentumSyncThreshold: 0.15,

	// GEAR
	ClutchEnabled: WithGear({ None: false, ClutchShoes: true }),
	WallAction: WithGear({ None: "Wallclimb", JetBrace: "Wallboost" }),
	GrapplerEnabled: WithGear({ None: false, Grappler: true }),

	GrapplerMaxYankTime: 0.5,
	GrapplerYankForce: WithGear({ None: 0, Grappler: [9, 11, 14] }),
	GrapplerMaxDistance: WithGear({ None: 0, Grappler: [32, 38, 46] }),
	GrapplerAttachTime: WithGear({ None: 0, Grappler: [1, 0.85, 0.75] }),
	GrapplerMinAttachTime: 0.2,

	CollisionLayer: LayerMask.GetMask("GameLayer0"),
	ZiplineLayer: LayerMask.GetMask("GameLayer1"),
};

export default Config;
