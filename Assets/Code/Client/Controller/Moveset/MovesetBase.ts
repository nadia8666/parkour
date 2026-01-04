import { Airship } from "@Easy/Core/Shared/Airship";
import { Binding } from "@Easy/Core/Shared/Input/Binding";
import { TweenEasingFunction } from "@Easy/Core/Shared/Tween/EasingFunctions";
import { Tween } from "@Easy/Core/Shared/Tween/Tween";
import { Keyboard } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Config from "Code/Client/Config";
import { Settings } from "Code/Client/Framework/SettingsController";
import CFrame from "@inkyaker/CFrame/Code";
import type GenericTrigger from "../../Components/Collision/GenericTriggerComponent";
import AnimationController from "../Animation/AnimationController";
import type ClientComponent from "../ClientComponent";

export const CollisionLayer = LayerMask.GetMask("GameLayer0");

class InputEntry {
	public Active = false;

	constructor(
		public readonly Key: Key,
		public readonly Priority: number,
	) {}
}

export const Actions = {
	LedgeGrab: new InputEntry(Key.Space, 4),
	Jump: new InputEntry(Key.Space, 3),
	Wallrun: new InputEntry(Key.Space, 2),
	Wallclimb: new InputEntry(Key.Space, 1),

	Dash: new InputEntry(Key.LeftShift, 2),
	Slide: new InputEntry(Key.LeftShift, 1),

	Respawn: new InputEntry(Key.R, 1),
};

const InverseMap = new Map<Key, (keyof typeof Actions)[]>();

for (const [Name, Entry] of pairs(Actions)) {
	const List = InverseMap.get(Entry.Key);

	if (List) {
		List.push(Name);
		List.sort((Name1, Name2) => {
			const [Entry1, Entry2] = [Actions[Name1], Actions[Name2]];
			return Entry1.Priority > Entry2.Priority;
		});
	} else {
		InverseMap.set(Entry.Key, [Name]);
	}

	Airship.Input.CreateAction(Name, Binding.Key(Entry.Key));
}

interface CastResults {
	Hit: boolean;
	Pos: Vector3;
	Normal: Vector3;
	Collider: Collider;
}

function WrapCastResults(Input: LuaTuple<[hit: boolean, point: Vector3 | undefined, normal: Vector3 | undefined, collider: Collider | undefined]>): CastResults {
	return {
		Hit: Input[0],
		Pos: Input[1] as Vector3,
		Normal: Input[2] as Vector3,
		Collider: Input[3] as Collider,
	};
}

function Raycast(Origin: Vector3, Direction: Vector3, Distance: number, TargetColor?: Color) {
	Debug.DrawRay(Origin, Direction.normalized.mul(Distance), TargetColor ?? Color.white, 15);
	return WrapCastResults(Physics.Raycast(Origin, Direction, Distance, CollisionLayer));
}

function SignVector(Vector: Vector3) {
	return new Vector3(Vector.x !== 0 ? (Vector.x > 0 ? 1 : -1) : 0, Vector.y !== 0 ? (Vector.y > 0 ? 1 : -1) : 0, Vector.z !== 0 ? (Vector.z > 0 ? 1 : -1) : 0);
}

function WrapFriction(Current: number, Input: number) {
	if (Input === 0) {
		return 1;
	} else {
		if (math.sign(Current) === math.sign(Input)) {
			return 0;
		} else {
			return 1;
		}
	}
}

export enum LedgeGrabType {
	VaultHigh,
	VaultLow,
	LedgeGrab,
}

export class MovesetBase {
	private AnimationController = AnimationController.Get();

	// Dash
	public DashStart = 0;
	public DashCharge = -1;

	// #region Input
	private readonly KeyMap = new Map<Key, Array<keyof typeof Actions>>();
	public Bin = new Bin();

	public BindInputs() {
		this.Bin.Clean();

		for (const [Name] of pairs(Actions)) {
			this.Bin.Add(Airship.Input.OnDown(Name).Connect(() => this.KeyPressed(Name)));
			this.Bin.Add(Airship.Input.OnUp(Name).Connect(() => this.KeyReleased(Name)));
		}
	}

	/**
	 * queues a button to be removed from the list. if you pass in controller it will immediately drop the key
	 * @param Name
	 * @param Controller
	 */
	public KeyReleased(Name: keyof typeof Actions, Controller?: ClientComponent) {
		const Entry = Actions[Name];
		const ExistingKeys = this.KeyMap.get(Entry.Key);

		if (ExistingKeys) {
			const Index = ExistingKeys.indexOf(Name);

			if (Index > -1) {
				ExistingKeys.remove(Index);

				if (Controller) {
					Entry.Active = false;
					this.ActionDropped(Name, Controller);
				}
			}
		}
	}

	public KeyPressed(Name: keyof typeof Actions, Controller?: ClientComponent) {
		const Entry = Actions[Name];

		const ExistingKeys = this.KeyMap.get(Entry.Key);
		if (ExistingKeys) {
			ExistingKeys.push(Name);

			if (Controller) {
				Entry.Active = true;
				this.ActionPressed(Name, Controller);
			}
		} else {
			this.KeyMap.set(Entry.Key, [Name]);
		}
	}

	public UpdateInputs(Controller: ClientComponent) {
		for (const [Key, Names] of pairs(InverseMap)) {
			const ExistingKeys = this.KeyMap.get(Key);

			if (ExistingKeys) {
				for (const [_, Name] of pairs(Names)) {
					const Index = ExistingKeys.indexOf(Name);
					const Entry = Actions[Name];

					if (Index === -1) {
						if (Entry.Active) {
							Entry.Active = false;
							this.ActionDropped(Name, Controller);
						}
					} else {
						if (!Entry.Active) {
							Entry.Active = true;
							this.ActionPressed(Name, Controller);
						}
					}
				}
			} else {
				for (const [_, Name] of pairs(Names)) {
					const Entry = Actions[Name];

					if (Entry.Active) {
						Entry.Active = false;
						this.ActionDropped(Name, Controller);
					}
				}
			}
		}
	}

	public GetMoveVector() {
		return new Vector3((Keyboard.IsKeyDown(Key.A) ? -1 : 0) + (Keyboard.IsKeyDown(Key.D) ? 1 : 0), 0, (Keyboard.IsKeyDown(Key.S) ? -1 : 0) + (Keyboard.IsKeyDown(Key.W) ? 1 : 0))
			.normalized;
	}
	// #endregion

	public ActionPressed(Name: keyof typeof Actions, Controller: ClientComponent) {
		switch (Name) {
			case "Jump": {
				if (["Grounded", "Wallrun", "Airborne", "Slide"].includes(Controller.State)) {
					this.StartJump(Controller);
				}
				break;
			}
			case "Wallclimb":
				if (Controller.State === "Airborne") {
					this.StartWallclimb(Controller);
				}
				break;
			case "Wallrun":
				if (Controller.State === "Airborne") {
					this.StartWallrun(Controller);
				}
				break;
			case "LedgeGrab":
				if (["Airborne", "Grounded"].includes(Controller.State)) {
					this.StartLedgeGrab(Controller);
				}
				break;
			case "Dash":
				this.StartDash(Controller);
				break;
			case "Respawn":
				Controller.DamageSelf(999);
				break;
		}
	}

	public ActionDropped(Name: keyof typeof Actions, _Controller: ClientComponent) {
		switch (Name) {
			case "Dash":
				this.DashStart = os.clock();
				this.EndDash();
				break;
		}
	}

	public StepMoveset(Controller: ClientComponent, FixedDT: number) {
		if (this.DashCharge !== -1) this.StepDash(Controller, FixedDT);
	}

	public AccelerateToInput(Controller: ClientComponent, FixedDT: number) {
		const Sliding = Controller.State === "Slide";
		const Grounded = Controller.State === "Grounded";
		const LocalMoveVector = Sliding ? new Vector3(this.GetMoveVector().x, 0, 1).normalized : this.GetMoveVector();

		const TargetVelocity = Controller.Rigidbody.transform.TransformDirection(LocalMoveVector);
		const CurrentVelocity = Controller.Rigidbody.linearVelocity.WithY(0).magnitude;
		const AccelerationForce =
			Controller.AccelerationCurve.Evaluate(CurrentVelocity / 20) * 20 * (Grounded ? 1 : 1) * (Grounded && this.DashActive() ? 1.5 : 1) * (Sliding ? 0.35 : 1);
		const GlobalMoveVector = TargetVelocity.magnitude > 0 ? TargetVelocity.normalized : Vector3.zero;

		const FrictionRate = (Grounded ? 0.25 : 0.1) * FixedDT * Config.ReferenceFPS;

		const MomentumDecay = FrictionRate * this.GetMomentumFriction(Controller.Momentum);
		Controller.Momentum = math.max(0, Controller.Momentum - MomentumDecay);

		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.MoveTowards(Vector3.zero, FrictionRate);
		Controller.Rigidbody.AddForce(GlobalMoveVector.mul(AccelerationForce), ForceMode.Acceleration);

		let AccelAlignment = 0;
		if (GlobalMoveVector.magnitude > 0) {
			const HorizontalVel = Controller.Rigidbody.linearVelocity.WithY(0);
			AccelAlignment = HorizontalVel.magnitude > 0 ? math.max(0, GlobalMoveVector.Dot(HorizontalVel.normalized)) : 1;
		}

		// extra friction for smoother control
		const FrictionScalar = -(Grounded ? 0.3 : 0.15) * FixedDT * Config.ReferenceFPS;
		const SignVec = SignVector(LocalMoveVector);
		const LocalForce = Controller.transform.InverseTransformDirection(Controller.Rigidbody.linearVelocity);
		const TargetFriction = new Vector3(WrapFriction(LocalForce.x, SignVec.x), 0, WrapFriction(LocalForce.z, SignVec.z)).mul(FrictionScalar);
		const FrictionVector = LocalForce.mul(TargetFriction);
		Controller.Rigidbody.linearVelocity = Controller.transform.TransformDirection(LocalForce.add(FrictionVector));

		const DeltaMomentum = (AccelerationForce / 40) * FixedDT * Config.ReferenceFPS * AccelAlignment;
		Controller.Momentum = math.max(Controller.Momentum + DeltaMomentum, 0);

		this.SyncMomentum(Controller, FixedDT);
	}

	public SyncMomentum(Controller: ClientComponent, FixedDT: number) {
		const HorizontalSpeed = Controller.Rigidbody.linearVelocity.WithY(0).magnitude;
		if (HorizontalSpeed - Controller.Momentum > Config.MomentumSyncThreshold) {
			Controller.Momentum = math.lerp(Controller.Momentum, HorizontalSpeed, math.clamp01(FixedDT * 15));
		}
	}

	private GetMomentumFriction(Momentum: number) {
		const Alpha = math.max((Momentum - 10) / 30, 0);

		return 1 + Alpha ** 1.75 * 6;
	}

	// #region Dash
	public DashActive() {
		return this.DashCharge !== -1;
	}

	public StartDash(Controller: ClientComponent) {
		if (os.clock() - this.DashStart <= Config.DashCooldown) return;

		if (Controller.State === "Airborne") this.AnimationController.Current = "VM_Coil";

		this.DashCharge = 0;

		if (Controller.State === "Grounded") this.StartSlide(Controller);
	}

	public EndDash() {
		if (this.AnimationController.Current === "VM_Coil") this.AnimationController.Current = "VM_Fall";

		this.DashCharge = -1;
	}

	public StepDash(Controller: ClientComponent, FixedDT: number) {
		const Grounded = Controller.State === "Grounded";
		this.DashCharge += FixedDT;

		if (this.DashCharge >= (Grounded ? Config.DashLengthGrounded : Config.DashLengthAirborne)) {
			this.EndDash();
			this.DashStart = os.clock();
		}
	}
	// #endregion

	// #region Jump
	public LastJump = "R";
	public JumpTimer = 0;
	public StartJump(Controller: ClientComponent) {
		const State = Controller.State;
		if (State === "Grounded" && this.StartLedgeGrab(Controller)) {
			return;
		}

		const InWallrun = State === "Wallrun";
		let JumpType: "Wallrun" | "Default" | "Long" = InWallrun ? "Wallrun" : "Default";
		if (Controller.Gear.Ammo.Jump <= 0 && !InWallrun) return;

		if (State === "Airborne") {
			// easier jumps
			const [FloorHit] = Physics.Raycast(
				Controller.GetCFrame().Position,
				new Vector3(0, -1, 0),
				math.clamp(-Controller.Rigidbody.linearVelocity.y / 10, 0.9, 2.25),
				CollisionLayer,
			);
			if (!FloorHit && Controller.AirborneTime >= Config.JumpCoyoteTime) {
				return;
			} else if (FloorHit) {
				Controller.Land();
			} else {
				// coyote time
				if (this.DashActive()) {
					JumpType = "Long";
				}
			}
		}

		this.KeyReleased("LedgeGrab", Controller);
		this.KeyReleased("Wallclimb", Controller);
		this.KeyReleased("Wallrun", Controller);

		switch (JumpType) {
			case "Default": {
				const JumpHeight = math.clamp(Controller.Momentum / Config.JumpRequiredSpeed, 0.5, 1);

				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(9.5 * JumpHeight);

				const Dir = this.LastJump === "R" ? "L" : "R";
				this.LastJump = Dir;

				this.AnimationController.Current = `VM_Jump${Dir}`;
				break;
			}
			case "Long": {
				Controller.Momentum += Config.LongJumpForce;
				const Magnitude = Controller.Momentum;

				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.normalized.WithY(Config.LongJumpHeightMultiplier).normalized.mul(Magnitude);

				this.AnimationController.Current = "VM_LongJump";
				break;
			}
			case "Wallrun": {
				const CurrentMagnitude = math.min(Controller.Momentum + Config.WallrunJumpForce.x, Config.WallrunMaxSpeed());

				const CameraRot = Quaternion.Euler(0, Controller.Camera.Rotation.Y, 0);
				const CameraLook = CameraRot.mul(Vector3.forward).add(CameraRot.mul(this.GetMoveVector())).normalized;
				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = CameraLook.WithY(0).normalized.mul(CurrentMagnitude).WithY(Config.WallrunJumpForce.y);

				this.AnimationController.Current = this.WallrunTarget === Controller.WallrunL ? "VM_JumpRWallrun" : "VM_JumpLWallrun";

				if (Controller.Floor.Touching) Controller.Gear.ResetAmmo(["Jump"]);

				break;
			}
		}

		this.SyncMomentum(Controller, 1);

		Controller.State = "Airborne";

		this.JumpTimer = 0.75;
		Controller.Gear.Ammo.Jump -= 1;
	}

	public StepJump(Controller: ClientComponent, FixedDT: number) {
		if (this.JumpTimer <= 0) return;

		if (Actions.Jump.Active) {
			this.JumpTimer -= FixedDT;
			Controller.ResetLastFallSpeed();
		} else {
			this.JumpTimer = 0;
		}
	}

	public GetJumpGravity() {
		return this.JumpTimer > 0 ? Config.Gravity.mul(1 - this.JumpTimer / 1.85) : Config.Gravity;
	}
	// #endregion

	// #region Wallclimb
	public WallclimbTimer = 0;
	public WallclimbFailTimer = 0;
	public StartWallclimb(Controller: ClientComponent) {
		if (Controller.Gear.Ammo.Wallclimb <= 0) return;

		if (Controller.Rigidbody.linearVelocity.y < Config.WallclimbThreshold()) return;

		const Distance = Controller.Momentum / 6;

		const Root = Controller.GetCFrame();
		const ForwardCast = Raycast(Root.Position, Root.Rotation.mul(Vector3.forward), Distance);
		if (!ForwardCast.Hit) return;

		if (!Settings.HoldWallclimb) {
			this.KeyReleased("Wallclimb", Controller);
		}

		const TargetLook = Quaternion.LookRotation(ForwardCast.Normal.mul(-1), Vector3.up);
		Controller.Rigidbody.rotation = TargetLook;

		Controller.ResetLastFallSpeed();
		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(math.max(Controller.Rigidbody.linearVelocity.y, Config.WallclimbMinSpeed()));

		Controller.Gear.Ammo.Wallclimb--;
		Controller.State = "Wallclimb";
		this.WallclimbTimer = 1;
		this.WallclimbFailTimer = 0;
	}

	public StepWallclimb(Controller: ClientComponent, FixedDT: number) {
		if (
			(!Controller.Wallclimb.Touching && this.WallclimbFailTimer >= Config.WallclimbCoyoteTime) ||
			(Settings.HoldWallclimb && !Actions.Wallclimb.Active) ||
			this.WallclimbTimer <= 0
		) {
			Controller.State = "Airborne";
			if (Controller.Floor.Touching) Controller.Land();

			return;
		}

		if (!Controller.Wallclimb.Touching || Controller.Floor.Touching) this.WallclimbFailTimer += FixedDT;

		this.WallclimbTimer -= FixedDT;
		Controller.ResetLastFallSpeed();
		Controller.Rigidbody.AddForce(Vector3.up.mul(this.WallclimbTimer / 6), ForceMode.VelocityChange);
		Controller.Rigidbody.AddForce(Controller.GetCFrame().Rotation.mul(Vector3.forward), ForceMode.VelocityChange);

		const HorizontalSpeed = Controller.Rigidbody.transform.InverseTransformDirection(Controller.Rigidbody.linearVelocity);

		Controller.Rigidbody.AddForce(Controller.Rigidbody.transform.TransformDirection(HorizontalSpeed.mul(Vector3.right).mul(-0.1)), ForceMode.VelocityChange);

		if (!Settings.HoldWallclimb && Actions.Wallclimb.Active) this.WallclimbTimer = 0;

		this.StartLedgeGrab(Controller, LedgeGrabType.LedgeGrab);
	}
	// #endregion

	// #region Wallrun
	public WallrunFailTimer = 0;
	public WallrunTimer = 0;
	public WallrunTarget: GenericTrigger;
	public StartWallrun(Controller: ClientComponent) {
		if (Controller.Gear.Ammo.Wallrun <= 0) return;
		const [TouchingL, TouchingR] = [Controller.WallrunL.Touching, Controller.WallrunR.Touching];

		if ((!TouchingL && !TouchingR) || Controller.Rigidbody.linearVelocity.y <= Config.WallrunThreshold()) return;

		let Target: GenericTrigger | undefined;

		const Root = Controller.GetCFrame();
		const [LeftHit, _1, LeftNormal] = Physics.Raycast(Root.Position, Root.Rotation.mul(Vector3.left), 2.5, CollisionLayer);
		const [RightHit, _2, RightNormal] = Physics.Raycast(Root.Position, Root.Rotation.mul(Vector3.right), 2.5, CollisionLayer);
		const LDot = LeftHit ? LeftNormal.mul(-1).Dot(Root.Rotation.mul(Vector3.left)) : 0;
		const RDot = RightHit ? RightNormal.mul(-1).Dot(Root.Rotation.mul(Vector3.right)) : 0;

		if ((LDot && LDot < 0.75) || (RDot && RDot < 0.75)) return;

		const WallrunForce = math.max(Controller.GetVelocity().WithY(0).magnitude, Controller.Momentum / 6);

		if (TouchingL && TouchingR) {
			if (LeftHit && RightHit) {
				Target = LDot >= RDot ? Controller.WallrunL : Controller.WallrunR;
				const Normal = LDot >= RDot ? LeftNormal : RightNormal;

				let Rotation = Quaternion.LookRotation(Normal.mul(-1), Vector3.up).mul(Quaternion.Euler(0, Normal === RightNormal ? -90 : 90, 0));
				Controller.Rigidbody.rotation = Rotation;
			}
		} else if ((TouchingL && LeftHit) || (TouchingR && RightHit)) {
			Target = TouchingL ? Controller.WallrunL : Controller.WallrunR;

			const Normal = (TouchingL ? LeftNormal : RightNormal) as Vector3;

			let Rotation = Quaternion.LookRotation(Normal.mul(-1), Vector3.up).mul(Quaternion.Euler(0, Normal === RightNormal ? -90 : 90, 0));
			Controller.Rigidbody.rotation = Rotation;
		}

		if (!Target) return;

		Controller.Rigidbody.linearVelocity = Controller.transform.TransformDirection(new Vector3(0, Controller.GetVelocity().y, math.max(WallrunForce, Config.WallrunMinSpeed)));

		Controller.State = "Wallrun";
		Controller.Gear.Ammo.Wallrun--;

		this.WallrunTimer = 2;
		this.WallrunFailTimer = 0;
		this.WallrunTarget = Target;
		this.KeyReleased("Jump", Controller);

		if (!Settings.HoldWallrun) {
			this.KeyReleased("Wallrun", Controller);
		}
	}

	public StepWallrun(Controller: ClientComponent, FixedDT: number) {
		if (!this.WallrunTarget.Touching || Controller.Floor.Touching || Controller.Rigidbody.linearVelocity.y <= Config.WallrunThreshold()) {
			this.WallrunFailTimer += FixedDT;
		}

		if (this.WallrunFailTimer >= Config.WallrunCoyoteTime || this.WallrunTimer <= 0) {
			Controller.State = "Airborne";
			if (Controller.Floor.Touching) Controller.Land();

			return;
		}

		this.WallrunTimer -= FixedDT;

		const YSpeed = Controller.Rigidbody.linearVelocity.y;
		const Magnitude = Controller.Momentum + YSpeed / 4;
		const GravityAffector = 1 - this.WallrunTimer / 2;

		Controller.Rigidbody.linearVelocity = Controller.GetCFrame().Rotation.mul(Vector3.forward.mul(Magnitude)).WithY(YSpeed);

		Controller.Rigidbody.AddForce(Config.Gravity.mul(GravityAffector * Config.WallrunGravity()), ForceMode.Acceleration);

		if (Settings.HoldWallrun && !Actions.Wallrun.Active) {
			this.StartJump(Controller);
		}
	}
	// #endregion

	// #region Ledge Grab
	public LedgeGrabType: LedgeGrabType;
	public StartLedgeGrab(Controller: ClientComponent, ForceType?: LedgeGrabType) {
		const Rotation = Controller.GetCFrame().Rotation;
		const Position = Controller.LedgeGrabFail.transform.position;
		const Speed = Controller.Momentum / 12.5;

		const Overlapping = Physics.CheckBox(Position.add(Rotation.mul(new Vector3(0, 1.75, 0.5 + Speed / 2))), new Vector3(0.125, 0.125, Speed), Rotation, CollisionLayer);
		if (Overlapping) return;

		const Grounded = Controller.State === "Grounded";

		const GrabMargin = 2.25;
		const Root = Controller.GetCFrame(true);
		const Normal = Root.Rotation.mul(Vector3.forward);
		const Origin = Root.mul(new CFrame(new Vector3(0, 1.75, GrabMargin / 2))).Position;

		if (!Grounded) {
			if (Raycast(Root.mul(new CFrame(new Vector3(0, 1.75, -GrabMargin / 2))).Position, new Vector3(0, -1, 0), 1.75, Color.green).Hit) {
				return;
			}
		} else if (!Raycast(Root.mul(new CFrame(new Vector3(0, 0.5, 0))).Position, Root.mul(Vector3.forward), 1, Color.red).Hit) return;

		let DownCast: CastResults | undefined;
		let FloorCast: CastResults | undefined;

		for (let i = 0; i < GrabMargin / 0.025; i++) {
			const Offset = i * 0.025;
			DownCast = Raycast(Origin.sub(Normal.mul(0.025 + Offset)), new Vector3(0, -1, 0), 1.75, Color.grey);
			if (DownCast.Hit) {
				FloorCast = Raycast(DownCast.Pos.add(Vector3.up.mul(0.5)).add(Normal.mul(Offset)), Normal.mul(-1), GrabMargin, Color.blue);
				if (!FloorCast.Hit) break;
			}
		}

		if (!FloorCast || FloorCast.Hit || !DownCast || !DownCast.Hit) return;

		const HeadHeight = Controller.GetCFrame(true).mul(new CFrame(new Vector3(0, 1.25, 0))).Position.y;
		const ChestHeight = Controller.GetCFrame().Position.y;
		const Height = DownCast.Pos.y;

		const Type = ForceType ?? (Height > HeadHeight ? LedgeGrabType.LedgeGrab : Height > ChestHeight ? LedgeGrabType.VaultHigh : LedgeGrabType.VaultLow);

		if (Grounded && Height >= HeadHeight) return;

		Controller.ResetLastFallSpeed();
		task.spawn(() => this.StepLedgeGrab(Controller, DownCast.Pos, Type));

		return true;
	}

	public StepLedgeGrab(Controller: ClientComponent, EndPosition: Vector3, Type: LedgeGrabType) {
		const IsKinematic = Type === LedgeGrabType.LedgeGrab;

		this.LedgeGrabType = Type;

		Controller.State = "LedgeGrab";

		Controller.BodyCollider.center = new Vector3(0, 1.25, 0);
		Controller.BodyCollider.radius = 0.1;
		Controller.BodyCollider.height = 0;

		const CurrentMagnitude = math.max(Controller.Momentum, Controller.Rigidbody.linearVelocity.magnitude);
		const Velocity = Controller.Rigidbody.linearVelocity;
		if (IsKinematic) {
			Controller.Rigidbody.isKinematic = true;
		} else {
			Controller.Rigidbody.linearVelocity = Controller.transform.TransformVector(Vector3.forward.mul(CurrentMagnitude));
		}

		let LastPosition = Controller.GetCFrame(true).Position;
		const PositionTween = Tween.Vector3(
			TweenEasingFunction.InOutSine,
			IsKinematic ? 0.25 : 0.15,
			(Position) => {
				if (IsKinematic) {
					Controller.Rigidbody.MovePosition(Position);
				} else {
					const PositionOffset = Position.sub(LastPosition);
					LastPosition = Position;
					Controller.Rigidbody.MovePosition(Controller.Rigidbody.position.add(PositionOffset));
				}
			},
			LastPosition,
			EndPosition,
		);

		PositionTween.OnCompleted.Wait();

		if (IsKinematic) {
			Controller.Rigidbody.isKinematic = false;
			Controller.Rigidbody.linearVelocity = Velocity;
		}

		Controller.BodyCollider.center = new Vector3(0, 0.5, 0);
		Controller.BodyCollider.radius = Config.PlayerRadius;
		Controller.BodyCollider.height = Config.PlayerHeight;
		Controller.State = "Airborne";

		Controller.Gear.ResetAmmo(["Jump"]);
		if (Type === LedgeGrabType.VaultHigh || Type === LedgeGrabType.VaultLow) {
			const MoveVector = this.GetMoveVector();

			if (Actions.LedgeGrab.Active) {
				if (MoveVector.magnitude <= 0) {
					// purely vertical speed
					Controller.Rigidbody.linearVelocity = Controller.GetCFrame()
						.Rotation.mul(Vector3.forward)
						.mul(CurrentMagnitude)
						.div(4)
						.WithY(CurrentMagnitude + Config.LedgeGrabUpSpeed());
				} else {
					// horizontal launch
					const TargetVelocity = CurrentMagnitude + Config.LedgeGrabForwardSpeed();
					Controller.Rigidbody.linearVelocity = Controller.GetCFrame().Rotation.mul(Vector3.forward).WithY(Config.LedgeGrabForwardY()).normalized.mul(TargetVelocity);
				}
			} else {
				// generic forward vault
				Controller.Rigidbody.linearVelocity = Controller.GetCFrame().Rotation.mul(Vector3.forward).WithY(0.25).normalized.mul(CurrentMagnitude);
			}

			this.JumpTimer = 1;
		} else if (Type === LedgeGrabType.LedgeGrab) {
			this.SyncMomentum(Controller, 1 / 60);

			const TargetVelocity = math.min(Controller.Momentum, 15);
			Controller.Rigidbody.linearVelocity = Controller.GetCFrame().mul(Vector3.forward).WithY(0).mul(TargetVelocity);
			Controller.Land();
		}
	}
	// #endregion

	// #region Slide
	public StartSlide(Controller: ClientComponent) {
		if (Controller.Rigidbody.linearVelocity.WithY(0).magnitude < Config.SlideThreshold) return;
		Controller.State = "Slide";
	}

	public EndSlide(Controller: ClientComponent) {
		Controller.State = Controller.Floor.Touching ? "Grounded" : "Airborne";

		this.EndDash();
		this.DashStart = 0;
	}

	public StepSlide(Controller: ClientComponent, FixedDT: number) {
		this.DashCharge = 0;

		Controller.Rigidbody.AddForce(Config.Gravity, ForceMode.Acceleration);
		this.AccelerateToInput(Controller, FixedDT);

		const TargetLook = Quaternion.LookRotation(Controller.Rigidbody.linearVelocity.WithY(0).normalized).eulerAngles.y;
		const LastRotation = Controller.transform.rotation.eulerAngles;

		Controller.transform.rotation = Quaternion.Euler(LastRotation.x, TargetLook, LastRotation.z);
		this.AnimationController.Current = "VM_Slide";

		if (!Actions.Slide.Active || !Controller.Floor.Touching) {
			this.EndSlide(Controller);
		}
	}
	// #endregion
}
