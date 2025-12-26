import { Airship } from "@Easy/Core/Shared/Airship";
import { Binding } from "@Easy/Core/Shared/Input/Binding";
import { TweenEasingFunction } from "@Easy/Core/Shared/Tween/EasingFunctions";
import { Tween } from "@Easy/Core/Shared/Tween/Tween";
import { Keyboard } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Config from "Code/Client/Config";
import type GenericTrigger from "../../Components/Collision/GenericTriggerComponent";
import AnimationController from "../Animation/AnimationController";
import type ClientComponent from "../ClientComponent";
import type { ValidStates } from "../ClientComponent";

const CollisionLayer = LayerMask.GetMask("GameLayer0");

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
	Wallclimb: new InputEntry(Key.Space, 2),
	Wallrun: new InputEntry(Key.Space, 1),

	Dash: new InputEntry(Key.LeftShift, 2),
	Slide: new InputEntry(Key.LeftShift, 1),
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

export enum LedgeGrabType {
	Vault,
	Jump,
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

	public KeyReleased(Name: keyof typeof Actions) {
		const Entry = Actions[Name];
		const ExistingKeys = this.KeyMap.get(Entry.Key);

		if (ExistingKeys) {
			const Index = ExistingKeys.indexOf(Name);

			if (Index > -1) {
				ExistingKeys.remove(Index);
			}
		}
	}

	public KeyPressed(Name: keyof typeof Actions) {
		const Entry = Actions[Name];

		const ExistingKeys = this.KeyMap.get(Entry.Key);
		if (ExistingKeys) {
			ExistingKeys.push(Name);
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
		return new Vector3((Keyboard.IsKeyDown(Key.A) ? -1 : 0) + (Keyboard.IsKeyDown(Key.D) ? 1 : 0), 0, (Keyboard.IsKeyDown(Key.S) ? -1 : 0) + (Keyboard.IsKeyDown(Key.W) ? 1 : 0));
	}
	// #endregion

	public ActionPressed(Name: keyof typeof Actions, Controller: ClientComponent) {
		switch (Name) {
			case "Jump": {
				const JumpStates = new Set<ValidStates>(["Grounded", "Wallrun", "Airborne", "Slide"]);
				if (JumpStates.has(Controller.State)) {
					this.Jump(Controller);
				}
				break;
			}
			case "Wallclimb":
				if (Controller.State === "Airborne") {
					this.WallclimbStart(Controller);
				}
				break;
			case "Wallrun":
				if (Controller.State === "Airborne") {
					this.WallrunStart(Controller);
				}
				break;
			case "Dash":
				this.StartDash(Controller);
				break;
		}
	}

	public ActionDropped(Name: keyof typeof Actions, Controller: ClientComponent) {
		switch (Name) {
			case "Dash":
				this.DashStart = os.clock();
				this.EndDash();
				break;
		}
	}

	public Step(Controller: ClientComponent, FixedDT: number) {
		if (this.DashCharge !== -1) this.UpdateDash(Controller, FixedDT);
	}

	public AccelerateToInput(Controller: ClientComponent, FixedDT: number) {
		const Sliding = Controller.State === "Slide";
		const Grounded = Controller.State === "Grounded";
		const LocalMoveVector = Sliding ? new Vector3(this.GetMoveVector().x, 0, 1).normalized : this.GetMoveVector();

		const TargetVelocity = Controller.Rigidbody.transform.TransformVector(LocalMoveVector);
		const CurrentVelocity = Controller.Rigidbody.linearVelocity.WithY(0).magnitude;
		const AccelerationForce =
			Controller.AccelerationCurve.Evaluate(math.clamp(CurrentVelocity, 0, 15) / 15) * 20 * (Grounded && this.DashActive() ? 1.5 : 1) * (Sliding ? 0.35 : 1);
		const GlobalMoveVector = TargetVelocity.magnitude > 0 ? TargetVelocity.normalized : Vector3.zero;

		const FrictionRate = (Grounded ? 0.45 : 0.2) * FixedDT * Config.ReferenceFPS;
		Controller.Momentum = math.max(0, Controller.Momentum - FrictionRate);

		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.MoveTowards(Vector3.zero, FrictionRate); // friction
		Controller.Rigidbody.AddForce(GlobalMoveVector.mul(AccelerationForce), ForceMode.Acceleration); // acceleration

		if (GlobalMoveVector.magnitude > 0) {
			const DeltaMomentum = (AccelerationForce / 40) * FixedDT * Config.ReferenceFPS;
			Controller.Momentum = math.clamp(Controller.Momentum + DeltaMomentum, 0, 15);
		}

		if (Grounded) {
			const LocalForce = Controller.transform.InverseTransformVector(Controller.Rigidbody.linearVelocity);

			// extra z friction
			Controller.Rigidbody.linearVelocity = Controller.transform.TransformVector(LocalForce.add(LocalForce.mul(new Vector3(-0.1 * FixedDT * Config.ReferenceFPS, 0, 0))));
		}
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

	public UpdateDash(Controller: ClientComponent, FixedDT: number) {
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
	public Jump(Controller: ClientComponent) {
		const State = Controller.State;
		if (State === "Grounded" && this.TryLedgeGrab(Controller)) {
			return;
		}

		const InWallrun = State === "Wallrun";
		let JumpType: "Wallrun" | "Default" | "Long" = InWallrun ? "Wallrun" : "Default";

		if (State === "Airborne") {
			// easier jumps
			const [FloorHit] = Physics.Raycast(Controller.GetCFrame().Position, new Vector3(0, -1, 0), 2.15, CollisionLayer);
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

		if (Controller.Gear.Ammo.Jump <= 0 && !InWallrun) return;

		this.KeyReleased("Jump");
		this.KeyReleased("Wallclimb");
		this.KeyReleased("Wallrun");

		switch (JumpType) {
			case "Default": {
				const JumpHeight = math.clamp(Controller.Momentum / Config.JumpRequiredSpeed, 0.5, 1);

				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(12 * JumpHeight);

				const Dir = this.LastJump === "R" ? "L" : "R";
				this.LastJump = Dir;

				this.AnimationController.Current = `VM_Jump${Dir}`;
				break;
			}
			case "Long": {
				const Magnitude = Controller.Rigidbody.linearVelocity.magnitude;

				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.normalized
					.WithY(Config.LongJumpHeightMultiplier)
					.normalized.mul(Magnitude + Config.LongJumpForce);

				this.AnimationController.Current = "VM_LongJump";
				break;
			}
			case "Wallrun": {
				const CurrentMagnitude = Controller.Momentum;
				const CameraLook = Camera.main.transform.rotation.mul(Vector3.forward);
				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = CameraLook.WithY(0)
					.normalized.mul(CurrentMagnitude + Config.WallrunJumpForce.x)
					.WithY(Config.WallrunJumpForce.y);

				this.AnimationController.Current = this.WallrunTarget === Controller.WallrunL ? "VM_JumpRWallrun" : "VM_JumpLWallrun";

				break;
			}
		}

		Controller.State = "Airborne";

		this.JumpTimer = 1;
		Controller.Gear.Ammo.Jump -= 1;
	}

	public JumpHold(Controller: ClientComponent, FixedDT: number) {
		if (this.JumpTimer <= 0) return;

		if (Actions.Jump.Active) {
			this.JumpTimer -= FixedDT;
			Controller.ResetLastFallSpeed();
			Controller.Rigidbody.AddForce(new Vector3(0, this.JumpTimer / 1.5, 0), ForceMode.VelocityChange);
		} else {
			this.JumpTimer = 0;
		}
	}
	// #endregion

	// #region Wallclimb
	public WallclimbStart(Controller: ClientComponent) {
		if (Controller.Gear.Ammo.Wallclimb <= 0) return;
		if (!Controller.Wallclimb.Touching || Controller.Rigidbody.linearVelocity.y < Config.WallClimbThreshold()) return;

		const Root = Controller.GetCFrame();
		const [Hit, _, Normal] = Physics.Raycast(Root.Position, Root.Rotation.mul(Vector3.forward), 5, CollisionLayer);
		if (!Hit) return;

		const TargetLook = Quaternion.LookRotation(Normal.mul(-1), Vector3.up);
		Controller.Rigidbody.rotation = TargetLook;

		Controller.ResetLastFallSpeed();
		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(math.max(Controller.Rigidbody.linearVelocity.y, Config.WallClimbMinSpeed()));

		Controller.Gear.Ammo.Wallclimb--;
		Controller.State = "Wallclimb";
		this.WallclimbTimer = 1;
	}

	public WallclimbUpdate(Controller: ClientComponent, FixedDT: number) {
		if (!Controller.Wallclimb.Touching || !Actions.Wallclimb.Active || this.WallclimbTimer <= 0) {
			Controller.State = "Airborne";
			return;
		}

		this.WallclimbTimer -= FixedDT;
		Controller.ResetLastFallSpeed();
		Controller.Rigidbody.AddForce(Vector3.up.mul(this.WallclimbTimer / 6), ForceMode.VelocityChange);
		Controller.Rigidbody.AddForce(Controller.GetCFrame().Rotation.mul(Vector3.forward), ForceMode.VelocityChange);

		const HorizontalSpeed = Controller.Rigidbody.transform.InverseTransformVector(Controller.Rigidbody.linearVelocity);

		Controller.Rigidbody.AddForce(Controller.Rigidbody.transform.TransformVector(HorizontalSpeed.mul(Vector3.right).mul(-0.1)), ForceMode.VelocityChange);

		this.TryLedgeGrab(Controller);
	}
	// #endregion

	// #region Wallrun
	public WallclimbTimer = 0;
	public WallrunFailTimer = 0;
	public WallrunTimer = 0;
	public WallrunTarget: GenericTrigger;
	public WallrunStart(Controller: ClientComponent) {
		if (Controller.Gear.Ammo.Wallrun <= 0) return;
		const [TouchingL, TouchingR] = [Controller.WallrunL.Touching, Controller.WallrunR.Touching];

		if ((!TouchingL && !TouchingR) || Controller.Rigidbody.linearVelocity.y <= Config.WallrunThreshold()) return;

		let Target: GenericTrigger | undefined;

		const Root = Controller.GetCFrame();
		const [LeftHit, _1, LeftNormal] = Physics.Raycast(Root.Position, Root.Rotation.mul(Vector3.left), 10, CollisionLayer);
		const [RightHit, _2, RightNormal] = Physics.Raycast(Root.Position, Root.Rotation.mul(Vector3.right), 10, CollisionLayer);
		const LDot = LeftHit ? LeftNormal.mul(-1).Dot(Root.Rotation.mul(Vector3.left)) : -1;
		const RDot = RightHit ? RightNormal.mul(-1).Dot(Root.Rotation.mul(Vector3.right)) : -1;

		if (LDot < 0.75 && RDot < 0.75) return;

		const WallrunForce = Controller.Momentum * Config.WallrunSpeedBoost;

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

		const LocalSpeed = Controller.transform.InverseTransformVector(Controller.Rigidbody.linearVelocity);
		Controller.Rigidbody.linearVelocity = Controller.transform.TransformVector(LocalSpeed.WithZ(math.max(WallrunForce, Config.WallrunMinSpeed)));

		Controller.State = "Wallrun";
		Controller.Gear.Ammo.Wallrun--;

		this.WallrunTimer = 2;
		this.WallrunFailTimer = 0;
		this.WallrunTarget = Target;
		this.KeyReleased("Jump");
	}

	public WallrunUpdate(Controller: ClientComponent, FixedDT: number) {
		if (!this.WallrunTarget.Touching) {
			this.WallrunFailTimer += FixedDT;
		}

		if (this.WallrunFailTimer >= Config.WallrunCoyoteTime || this.WallrunTimer <= 0) {
			Controller.State = "Airborne";
			return;
		}

		this.WallrunTimer -= FixedDT;

		const YSpeed = Controller.Rigidbody.linearVelocity.y;
		const Magnitude = Controller.Momentum + YSpeed / 4;
		const GravityAffector = 1 - this.WallrunTimer / 2;

		Controller.Rigidbody.linearVelocity = Controller.GetCFrame().Rotation.mul(Vector3.forward.mul(Magnitude)).WithY(YSpeed);

		Controller.Rigidbody.AddForce(Config.Gravity.mul(GravityAffector * Config.WallrunGravity()), ForceMode.Acceleration);
	}
	// #endregion

	// #region Ledge Grab
	public LedgeGrabType: LedgeGrabType;
	public TryLedgeGrab(Controller: ClientComponent) {
		if (!Actions.LedgeGrab.Active || Controller.State === "LedgeGrab") return;

		if ((Controller.State === "Grounded" ? Controller.LedgeGrabG : Controller.LedgeGrabA).Touching && !Controller.Wallclimb.Touching) {
			const Root = Controller.GetCFrame();
			const Origin = Root.Position.add(Root.Rotation.mul(Vector3.forward.mul(0.5))).add(new Vector3(0, 1.25, 0));
			let [Hit, HitPos] = Physics.BoxCast(Origin, new Vector3(0.25, 0.001, 0.25), new Vector3(0, -1, 0), Root.Rotation, 4.25, CollisionLayer);

			const [FloorHit] = Physics.Raycast(Root.Position, new Vector3(0, -1, 0), 2, CollisionLayer);

			if (Controller.State === "Airborne" && FloorHit) return;

			if (Hit) {
				const Mag = (HitPos as Vector3).sub(Origin).magnitude;
				HitPos = Origin.add(new Vector3(0, -Mag, 0));
				HitPos.add(new Vector3(0, 0.25, 0));

				const YPos = Controller.GetCFrame(true).Position.y + 0.15;

				const Type = Controller.State === "Grounded" ? LedgeGrabType.Vault : YPos > HitPos.y ? LedgeGrabType.Vault : LedgeGrabType.Jump;

				if (Type === LedgeGrabType.Vault) {
					// vault
					const TargetVelocity = Controller.Rigidbody.linearVelocity.magnitude;

					Controller.Rigidbody.linearVelocity = Controller.GetCFrame().Rotation.mul(Vector3.forward).WithY(0.25).normalized.mul(TargetVelocity);
				} else {
					const MoveVector = this.GetMoveVector();

					if (MoveVector.magnitude <= 0) {
						// purely vertical speed
						Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.div(4).WithY(12);
					} else {
						// horizontal launch
						const TargetVelocity = Controller.Rigidbody.linearVelocity.magnitude + Config.LedgeGrabForwardSpeed();
						Controller.Rigidbody.linearVelocity = Controller.GetCFrame().Rotation.mul(Vector3.forward).WithY(Config.LedgeGrabForwardY()).normalized.mul(TargetVelocity);
					}
				}
				
				Controller.ResetLastFallSpeed();

				this.RunLedgeGrab(Controller, HitPos, Type);

				return true;
			}
		}
	}

	public RunLedgeGrab(Controller: ClientComponent, EndPosition: Vector3, Type: LedgeGrabType) {
		this.LedgeGrabType = Type;

		Controller.Gear.ResetAmmo(["Jump"]);
		Controller.State = "LedgeGrab";

		Controller.BodyCollider.center = new Vector3(0, 1.25, 0);
		Controller.BodyCollider.height = 0;

		let LastPosition = Controller.GetCFrame(true).Position;
		const PositionTween = Tween.Vector3(
			TweenEasingFunction.OutSine,
			0.25,
			(Position) => {
				const PositionOffset = Position.sub(LastPosition);
				LastPosition = Position;
				Controller.Rigidbody.MovePosition(Controller.Rigidbody.position.add(PositionOffset));
			},
			LastPosition,
			EndPosition,
		);

		PositionTween.OnCompleted.Wait();
		Controller.BodyCollider.center = new Vector3(0, 0.5, 0);
		Controller.BodyCollider.height = 1;
		Controller.State = "Airborne";
	}
	// #endregion

	// #region Slide
	public StartSlide(Controller: ClientComponent) {
		Controller.State = "Slide";
	}

	public EndSlide(Controller: ClientComponent) {
		Controller.State = Controller.Floor.Touching ? "Grounded" : "Airborne";

		this.EndDash();
		this.DashStart = 0;
	}

	public SlideStep(Controller: ClientComponent, FixedDT: number) {
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
