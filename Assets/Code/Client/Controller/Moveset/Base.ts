import { TweenEasingFunction } from "@Easy/Core/Shared/Tween/EasingFunctions";
import { Tween } from "@Easy/Core/Shared/Tween/Tween";
import Config from "Code/Client/Config";
import { Settings } from "Code/Client/Framework/SettingsController";
import Core from "Code/Core/Core";
import ENV from "Code/Server/ENV";
import type GenericTrigger from "../../Components/Collision/GenericTriggerComponent";
import type ClientComponent from "../ClientComponent";
import { Actions } from "../Input";

export interface CastResults {
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

export function Raycast(Origin: Vector3, Direction: Vector3, Distance: number, TargetColor?: Color) {
	if (ENV.DebugDrawing) Debug.DrawRay(Origin, Direction.normalized.mul(Distance), TargetColor ?? Color.white, 15);
	return WrapCastResults(Physics.Raycast(Origin, Direction, Distance, Config.CollisionLayer));
}

export function DrawCubeAt(Origin: Vector3, Size: number, Orientation: Quaternion) {
	const UFL = Origin.add(Orientation.mul(new Vector3(Size / 2, Size / 2, -Size / 2)));
	const DFL = Origin.add(Orientation.mul(new Vector3(Size / 2, -Size / 2, -Size / 2)));
	const UFR = Origin.add(Orientation.mul(new Vector3(-Size / 2, Size / 2, -Size / 2)));
	const DFR = Origin.add(Orientation.mul(new Vector3(-Size / 2, -Size / 2, -Size / 2)));
	const UBL = Origin.add(Orientation.mul(new Vector3(Size / 2, Size / 2, Size / 2)));
	const DBL = Origin.add(Orientation.mul(new Vector3(Size / 2, -Size / 2, Size / 2)));
	const UBR = Origin.add(Orientation.mul(new Vector3(-Size / 2, Size / 2, Size / 2)));
	const DBR = Origin.add(Orientation.mul(new Vector3(-Size / 2, -Size / 2, Size / 2)));

	// Top face
	Debug.DrawLine(UFL, UFR, Color.black, 15);
	Debug.DrawLine(UFR, UBR, Color.black, 15);
	Debug.DrawLine(UBR, UBL, Color.black, 15);
	Debug.DrawLine(UBL, UFL, Color.black, 15);

	// Bottom face
	Debug.DrawLine(DFL, DFR, Color.black, 15);
	Debug.DrawLine(DFR, DBR, Color.black, 15);
	Debug.DrawLine(DBR, DBL, Color.black, 15);
	Debug.DrawLine(DBL, DFL, Color.black, 15);

	// Four corner lines
	Debug.DrawLine(UFL, DFL, Color.black, 15);
	Debug.DrawLine(UFR, DFR, Color.black, 15);
	Debug.DrawLine(UBR, DBR, Color.black, 15);
	Debug.DrawLine(UBL, DBL, Color.black, 15);

	return $tuple(UFL, DFL, UFR, DFR, UBL, DBL, UBR, DBR);
}

export function Cubecast(Origin: Vector3, Direction: Vector3, Distance: number, Size: number, Orientation: Quaternion) {
	if (ENV.DebugDrawing) {
		const FullDir = Direction.normalized.mul(Distance);
		const [UFL, DFL, UFR, DFR, UBL, DBL, UBR, DBR] = DrawCubeAt(Origin, Size, Orientation);
		DrawCubeAt(Origin.add(FullDir), Size, Orientation);

		Debug.DrawRay(UFL, FullDir, Color.black, 15);
		Debug.DrawRay(DFL, FullDir, Color.black, 15);
		Debug.DrawRay(UFR, FullDir, Color.black, 15);
		Debug.DrawRay(DFR, FullDir, Color.black, 15);

		Debug.DrawRay(UBL, FullDir, Color.black, 15);
		Debug.DrawRay(DBL, FullDir, Color.black, 15);
		Debug.DrawRay(UBR, FullDir, Color.black, 15);
		Debug.DrawRay(DBR, FullDir, Color.black, 15);

		DrawCubeAt(Origin, Size, Orientation);
	}

	return WrapCastResults(Physics.BoxCast(Origin, Vector3.one.mul(Size / 2), Direction, Orientation, Distance, Config.CollisionLayer));
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
	private AnimationController = Core().Client.Animation;

	// Dash
	public DashStart = 0;
	public DashCharge = -1;

	// #region Input

	// #endregion
	public OnAnimationEvent(Key: string, Controller: ClientComponent) {
		switch (Key) {
			case "WallclimbStep":
				this.WallclimbStep(Controller);
				break;
			case "Footstep": {
				const IsFast = Controller.GetVelocity().WithY(0).magnitude > 20;
				Core().Client.Sound.Play(`footstep${IsFast ? "fast" : ""}`);
				task.delay(0.1, () => Core().Client.Sound.Play("cloth", { Volume: 0.5 }));

				break;
			}
			case "FootstepLadder":
				Core().Client.Sound.Play("footstepladder", { Volume: 0.15 });
				break;
		}
	}

	public ActionPressed(Name: keyof typeof Actions, Controller: ClientComponent) {
		switch (Name) {
			case "WallKick": {
				if (["Airborne", "Dropdown"].includes(Controller.State)) this.StartWallKick(Controller);
				break;
			}
			case "Jump": {
				if (["Grounded", "Wallrun", "Airborne", "Slide", "Dropdown", "LadderClimb"].includes(Controller.State)) {
					this.StartJump(Controller);
				}
				break;
			}
			case "WallAction":
				if (Controller.State === "Airborne") {
					this.StartWallAction(Controller);
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
			case "Coil":
				this.StartDash(Controller);
				break;
			case "Respawn":
				if (!Core().Client.Objective.TimeTrials.IsActive()) {
					Controller.DamageSelf(999);
				}
				break;
			case "Fly":
				if (ENV.Runtime === "DEV") Controller.State = Controller.State === "Fly" ? "Airborne" : "Fly";
				break;
			case "CoreUse":
				if (Config.GrapplerEnabled()) Controller.Moveset.Grappler.StartGrapple(Controller);
				break;
		}
	}

	public ActionDropped(Name: keyof typeof Actions, _Controller: ClientComponent) {
		switch (Name) {
			case "Coil":
				if (this.DashActive()) {
					this.DashStart = os.clock();
					this.EndDash();
				}
				break;
		}
	}

	public StepMoveset(Controller: ClientComponent, FixedDT: number) {
		if (this.DashCharge !== -1) this.StepDash(Controller, FixedDT);

		if (Config.GrapplerEnabled()) Controller.Moveset.Grappler.StepGrapple(Controller, FixedDT);
	}

	//TODO: rewrite this function so it isnt evil and messy
	public AccelerateToInput(Controller: ClientComponent, FixedDT: number) {
		const Sliding = Controller.State === "Slide";
		const Grounded = Controller.State === "Grounded";
		const LocalMoveVector = Sliding ? new Vector3(Controller.Input.GetMoveVector().x, 0, 1).normalized : Controller.Input.GetMoveVector();

		const TargetVelocity = Controller.Rigidbody.transform.TransformDirection(LocalMoveVector);
		const CurrentVelocity = Controller.Rigidbody.linearVelocity.WithY(0).magnitude;
		const AccelerationForce =
			Controller.AccelerationCurve.Evaluate(CurrentVelocity / Config.RunMaxSpeed) *
			Config.RunMaxSpeed *
			(Grounded ? 1 : 1) *
			(Grounded && this.DashActive() ? 1.5 : 1) *
			(Sliding ? 0.35 : 1);
		const GlobalMoveVector = TargetVelocity.magnitude > 0 ? TargetVelocity.normalized : Vector3.zero;

		const MVFriction = LocalMoveVector.magnitude > 0 ? 1 : Grounded ? 1 : 0.1;
		const FrictionRate = (Grounded ? 0.25 : 0.1) * FixedDT * Config.ReferenceFPS * MVFriction;

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
		const FrictionScalar = -(Grounded ? 0.3 : 0.15) * FixedDT * Config.ReferenceFPS * MVFriction;
		const SignVec = SignVector(LocalMoveVector);
		const LocalForce = Controller.transform.InverseTransformDirection(Controller.Rigidbody.linearVelocity);
		const TargetFriction = new Vector3(WrapFriction(LocalForce.x, SignVec.x), 0, WrapFriction(LocalForce.z, SignVec.z)).mul(FrictionScalar);
		const FrictionVector = LocalForce.mul(TargetFriction);
		Controller.Rigidbody.linearVelocity = Controller.transform.TransformDirection(LocalForce.add(FrictionVector));

		const DeltaMomentum = (AccelerationForce / 40) * FixedDT * Config.ReferenceFPS * AccelAlignment;
		Controller.Momentum = math.max(Controller.Momentum + DeltaMomentum, 0);

		// velocity angling
		if (TargetVelocity.magnitude > 0.25) {
			const RedirectForce = Controller.VelocityLocked ? 0.1 : 1;
			const Speed = Controller.GetVelocity();
			Controller.SetVelocity(
				Speed.WithY(0)
					.normalized.Slerp(TargetVelocity.WithY(0), math.clamp01(FixedDT * 2.5 * RedirectForce))
					.mul(Speed.WithY(0).magnitude)
					.WithY(Speed.y),
			);
		}

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

	public ResetDash() {
		this.EndDash();
		this.DashStart = 0;
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

		const FromLadder = State === "LadderClimb";
		const FromDropdown = State === "Dropdown";
		const InWallrun = State === "Wallrun";
		let JumpType: "Wallrun" | "Default" | "Long" = InWallrun ? "Wallrun" : "Default";
		if (Controller.Gear.Ammo.Jump <= 0 && !InWallrun) return;

		if (["Airborne", "Dropdown"].includes(State)) {
			// easier jumps
			const Floor = Raycast(Controller.GetCFrame().Position, new Vector3(0, -1, 0), math.clamp(-Controller.Rigidbody.linearVelocity.y / 10, 0.9, 2.25), Color.blue);
			if (!Floor.Hit && Controller.AirborneTime >= Config.JumpCoyoteTime) {
				return;
			} else if (State !== "Dropdown" && Floor.Hit) {
				Controller.Land();
			} else {
				// coyote time
				if (this.DashActive() && os.clock() - Controller.LastLanded <= Config.LongJumpGraceAirborne) {
					JumpType = "Long";
				} else if (Floor.Hit) {
					Controller.Land();
				}
			}
		} else if (["Grounded", "Slide"].includes(State)) {
			const CFrame = Controller.GetCFrame();
			const ForwardCast = Raycast(CFrame.Position, CFrame.Forward, 2);
			const Valid = os.clock() - Controller.LastLanded <= Config.LongJumpGraceGrounded && (this.DashActive() || State === "Slide");
			if (Valid && !ForwardCast.Hit) {
				for (const DistanceAlpha of $range(0, 2, 0.05)) {
					const DownCast = Raycast(CFrame.Position.add(CFrame.Forward.mul(DistanceAlpha)), Vector3.down, 1.5, Color.green);
					if (!DownCast.Hit) {
						JumpType = "Long";
						break;
					}
				}
			}
		}

		if (State === "Dropdown") {
			this.ResetCollider(Controller);
		}

		Controller.Input.KeyReleased("LedgeGrab", true);
		Controller.Input.KeyReleased("WallAction", true);
		Controller.Input.KeyReleased("Wallrun", true);

		switch (JumpType) {
			case "Default": {
				const JumpHeight = math.clamp(Controller.Momentum / Config.JumpRequiredSpeed, 0.5, 1);

				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(9.5 * JumpHeight);

				const Dir = this.LastJump === "R" ? "L" : "R";
				this.LastJump = Dir;

				if (FromLadder) {
					Controller.Moveset.World.ResetLadder(Controller);
					const TargetRotation = Quaternion.LookRotation(Controller.Camera.TargetRotation.mul(Vector3.forward).WithY(0).normalized);
					Controller.Rigidbody.rotation = TargetRotation;
					Controller.SetVelocity(Controller.GetVelocity().add(TargetRotation.mul(Vector3.forward).mul(8)));

					Core().Client.Sound.Play("laddergrab");
				}

				this.AnimationController.Current = `VM_Jump${Dir}`;
				break;
			}
			case "Long": {
				Controller.Momentum += Config.LongJumpForce;
				const Magnitude = Controller.Momentum;

				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.normalized
					.WithY(FromDropdown ? Config.LongJumpHeightMultiplierDropdown : Config.LongJumpHeightMultiplier)
					.normalized.mul(Magnitude);
				Controller.VelocityLocked = true;

				this.AnimationController.Current = "VM_LongJump";
				break;
			}
			case "Wallrun": {
				const CurrentMagnitude = math.min(Controller.Momentum + Config.WallrunJumpForce.x, Config.WallrunMaxSpeed());
				const CurrentYSpeed = Controller.GetVelocity().y;

				const CameraRot = Quaternion.Euler(0, Controller.Camera.Rotation.Y, 0);
				const CameraLook = CameraRot.mul(Vector3.forward).add(CameraRot.mul(Controller.Input.GetMoveVector())).normalized;
				Controller.ResetLastFallSpeed();
				Controller.Rigidbody.linearVelocity = CameraLook.WithY(0)
					.normalized.mul(CurrentMagnitude)
					.WithY(Config.WallrunJumpKeep() ? Config.WallrunJumpForce.y + (CurrentYSpeed > 0 ? CurrentYSpeed : CurrentYSpeed / 4) : Config.WallrunJumpForce.y);

				this.AnimationController.Current = this.WallrunTarget === Controller.WallrunL ? "VM_JumpRWallrun" : "VM_JumpLWallrun";

				if (Controller.Floor.Touching) Controller.Gear.ResetAmmo(["Jump"]);

				break;
			}
		}

		this.SyncMomentum(Controller, 1);

		Controller.State = "Airborne";

		this.JumpTimer = 0.75;
		Controller.Gear.Ammo.Jump--;

		Core().Client.Sound.Play("footstep"); // TEMP
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
		return this.JumpTimer > 0 ? Config.Gravity.mul(1 - this.JumpTimer / 1.65) : Config.Gravity;
	}
	// #endregion

	public StartWallAction(Controller: ClientComponent) {
		if (Controller.Gear.Ammo.Wallclimb <= 0) return;

		const Distance = math.max(Controller.Momentum / 6, 0.75);

		const Root = Controller.GetCFrame();
		const ForwardCast = Raycast(Root.Position, Root.Forward, Distance);
		if (!ForwardCast.Hit || !math.approximately(ForwardCast.Normal.y, 0)) return;

		const NormalDot = ForwardCast.Normal.mul(-1).Dot(Controller.GetCFrame().Forward);
		if (NormalDot <= 0.7) return;

		if (Config.ClutchEnabled()) Controller.Moveset.Generic.StartWallclutch(Controller, ForwardCast);

		if (!Actions.WallAction.Active) return;

		switch (Config.WallAction()) {
			case "Wallclimb":
				this.StartWallclimb(Controller, ForwardCast);
				break;
			case "Wallboost":
				Controller.Moveset.Generic.StartWallboost(Controller);
				break;
		}
	}

	// #region Wallclimb
	public WallclimbTimer = 0;
	public WallclimbFailTimer = 0;
	public WallclimbFar = false;
	public StartWallclimb(Controller: ClientComponent, ForwardCast: CastResults) {
		if (Controller.Rigidbody.linearVelocity.y < Config.WallclimbThreshold()) return;

		if (!Settings.HoldWallclimb) {
			Controller.Input.KeyReleased("WallAction", true);
		}

		const TargetLook = Quaternion.LookRotation(ForwardCast.Normal.WithY(0).normalized.mul(-1), Vector3.up);
		Controller.Rigidbody.rotation = TargetLook;

		Controller.ResetLastFallSpeed();
		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(math.max(Controller.Rigidbody.linearVelocity.y, Config.WallclimbMinSpeed()));

		Controller.Gear.Ammo.Wallclimb--;
		Controller.State = "Wallclimb";
		this.WallclimbFar = ForwardCast.Pos.WithY(0).sub(Controller.GetCFrame().Position.WithY(0)).magnitude > 0.75;
		this.WallclimbTimer = Config.WallclimbLength();
		this.WallclimbFailTimer = 0;
	}

	public StepWallclimb(Controller: ClientComponent, FixedDT: number) {
		if (
			(!Controller.Wallclimb.Touching && this.WallclimbFailTimer >= Config.WallclimbCoyoteTime) ||
			(Settings.HoldWallclimb && !Actions.WallAction.Active) ||
			this.WallclimbTimer <= 0
		) {
			Controller.State = "Airborne";
			if (Controller.Floor.Touching) Controller.Land();

			return false;
		}

		if (!Controller.Wallclimb.Touching || Controller.Floor.Touching) this.WallclimbFailTimer += FixedDT;

		this.WallclimbTimer -= FixedDT;
		Controller.ResetLastFallSpeed();
		Controller.Rigidbody.AddForce(Config.Gravity, ForceMode.Acceleration);

		const LocalSpeed = Controller.transform.InverseTransformDirection(Controller.GetVelocity());
		Controller.SetVelocity(Controller.transform.TransformDirection(LocalSpeed.WithZ(0).mul(new Vector3(-FixedDT / 40, 1, 1))));

		Controller.Animator.AnimationController.Speed = Controller.WallclimbProgressionCurve.Evaluate(this.WallclimbTimer / Config.WallclimbLength());
		if (!Settings.HoldWallclimb && Actions.WallAction.Active) this.WallclimbTimer = 0;

		const CFrame = Controller.GetCFrame(true);
		const Cast = Raycast(CFrame.Position, CFrame.Forward, this.WallclimbFar ? 8 : 3);
		if (Cast.Hit) {
			const FarForce = (1 - this.WallclimbTimer / Config.WallclimbLength()) * 4;
			Controller.transform.position = Controller.transform.position.Lerp(
				Cast.Pos.add(CFrame.Back.mul(0.5)),
				this.WallclimbFar ? math.clamp01(FarForce) : math.clamp01(FixedDT * 5),
			);
			if (this.WallclimbFar && FarForce >= 1) this.WallclimbFar = false;
		}

		const Result = this.StartLedgeGrab(
			Controller,
			2.75 * (math.clamp01(1 - math.abs(LocalSpeed.y / 5)) + math.abs(LocalSpeed.y / 20)) + (1 - this.WallclimbTimer / Config.WallclimbLength()),
			LedgeGrabType.LedgeGrab,
		);
		return !Result;
	}

	public WallclimbStep(Controller: ClientComponent) {
		if (Controller.State !== "Wallclimb") return;

		Controller.Rigidbody.AddForce(Vector3.up.mul((this.WallclimbTimer / Config.WallclimbLength()) * Config.WallclimbStepStrength()), ForceMode.Impulse);
		Core().Client.Sound.Play("footstepfast");
	}
	// #endregion

	// #region Wallrun
	public WallrunFailTimer = 0;
	public WallrunDirection = Vector3.forward;
	public WallrunRotation = 0;
	public WallrunTimer = 0;
	public WallrunTarget: GenericTrigger;
	public WallrunForceTarget = 0;
	public StartWallrun(Controller: ClientComponent) {
		if (Controller.Gear.Ammo.Wallrun <= 0) return;
		const [TouchingL, TouchingR] = [Controller.WallrunL.Touching, Controller.WallrunR.Touching];

		if ((!TouchingL && !TouchingR) || Controller.Rigidbody.linearVelocity.y <= Config.WallrunThreshold()) return;

		let Target: GenericTrigger | undefined;

		const Root = Controller.GetCFrame();
		const [LeftHit, _1, LeftNormal] = Physics.Raycast(Root.Position, Root.Left, 2.5, Config.CollisionLayer);
		const [RightHit, _2, RightNormal] = Physics.Raycast(Root.Position, Root.Right, 2.5, Config.CollisionLayer);
		const LDot = LeftHit ? LeftNormal.mul(-1).Dot(Root.Left) : 0;
		const RDot = RightHit ? RightNormal.mul(-1).Dot(Root.Right) : 0;

		if ((LDot && LDot < 0.75) || (RDot && RDot < 0.75)) return;

		const WallrunForce = math.max(math.max(Controller.GetVelocity().WithY(0).magnitude, math.min(Controller.Momentum, Config.WallrunMomentumMaxSpeed)), Config.WallrunMinSpeed);
		this.WallrunForceTarget = WallrunForce;

		if (TouchingL && TouchingR) {
			if (LeftHit && RightHit) {
				Target = LDot >= RDot ? Controller.WallrunL : Controller.WallrunR;
				const Normal = LDot >= RDot ? LeftNormal : RightNormal;
				this.WallrunRotation = Normal === RightNormal ? -90 : 90;
				this.WallrunDirection = Normal;
			}
		} else if ((TouchingL && LeftHit) || (TouchingR && RightHit)) {
			Target = TouchingL ? Controller.WallrunL : Controller.WallrunR;
			const Normal = (TouchingL ? LeftNormal : RightNormal) as Vector3;
			this.WallrunRotation = Normal === RightNormal ? -90 : 90;
			this.WallrunDirection = Normal;
		}

		if (!Target) return;

		const LocalVelocity = Controller.GetCFrame().VectorToObjectSpace(Controller.GetVelocity());
		this.AlignWallrun(Controller, 1 / 60);
		Controller.Rigidbody.linearVelocity = Controller.transform.TransformDirection(new Vector3(0, Controller.GetVelocity().y * 0.75, LocalVelocity.z));

		Controller.State = "Wallrun";
		Controller.Gear.Ammo.Wallrun--;

		this.WallrunTimer = Config.WallrunLength();
		this.WallrunFailTimer = 0;
		this.WallrunTarget = Target;
		Controller.Input.KeyReleased("Jump", true);

		if (!Settings.HoldWallrun) {
			Controller.Input.KeyReleased("Wallrun", true);
		}
	}

	public StepWallrun(Controller: ClientComponent, FixedDT: number) {
		if (!this.WallrunTarget.Touching || Controller.Floor.Touching || Controller.Rigidbody.linearVelocity.y <= Config.WallrunThreshold()) {
			this.WallrunFailTimer += FixedDT;
		}

		if (this.WallrunFailTimer >= Config.WallrunCoyoteTime || this.WallrunTimer <= 0) {
			Controller.State = "Airborne";
			if (Controller.Floor.Touching) Controller.Land();

			// extra boosted lg at the end
			this.StartLedgeGrab(Controller);

			return false;
		}

		this.WallrunTimer -= FixedDT;

		const WallRay = Raycast(Controller.GetCFrame(true).Position, this.WallrunDirection.mul(-1), 1);
		if (WallRay.Hit) {
			this.WallrunDirection = WallRay.Normal;
		}
		this.AlignWallrun(Controller, FixedDT);

		let TargetVector = Controller.Input.GetMoveVector();
		if (TargetVector.magnitude <= 0) TargetVector = Vector3.forward;

		const CurrentVelocity = Controller.GetCFrame().VectorToObjectSpace(Controller.GetVelocity());
		let WallrunSpeed = CurrentVelocity.z;
		if (TargetVector.z > 0) {
			WallrunSpeed =
				WallrunSpeed < this.WallrunForceTarget ? math.min(WallrunSpeed + FixedDT * Config.WallrunAcceleration * TargetVector.z, this.WallrunForceTarget) : WallrunSpeed;
		} else if (TargetVector.z < 0) {
			WallrunSpeed = math.max(WallrunSpeed - FixedDT * Config.WallrunAcceleration * -TargetVector.z, -this.WallrunForceTarget);
		}

		if (TargetVector.x !== 0) {
			WallrunSpeed = WallrunSpeed - FixedDT * Config.WallrunAcceleration * math.abs(TargetVector.x) * math.sign(WallrunSpeed) * math.clamp01(math.abs(WallrunSpeed));
		}

		const VerticalDrag = CurrentVelocity.y > 0 ? CurrentVelocity.y * -0.025 : 0;
		Controller.SetVelocity(
			Controller.GetCFrame()
				.Forward.mul(WallrunSpeed)
				.add(Vector3.up.mul(CurrentVelocity.y + VerticalDrag)),
		);

		const GravityAffector = 1 - this.WallrunTimer / Config.WallrunLength();
		Controller.Rigidbody.AddForce(Config.Gravity.mul(GravityAffector * Config.WallrunGravity()), ForceMode.Acceleration);

		Controller.Animator.AnimationController.Speed = Controller.GetVelocity().magnitude / 12.5;

		if (Settings.HoldWallrun && !Actions.Wallrun.Active) {
			this.StartJump(Controller);

			return false;
		}

		return true;
	}

	public AlignWallrun(Controller: ClientComponent, FixedDT: number) {
		let Rotation = Quaternion.LookRotation(this.WallrunDirection.WithY(0).normalized.mul(-1), Vector3.up).mul(Quaternion.Euler(0, this.WallrunRotation, 0));
		Controller.Rigidbody.rotation = Quaternion.Slerp(Controller.Rigidbody.rotation, Rotation, FixedDT * 5);
	}
	// #endregion

	// #region Ledge Grab
	public LedgeGrabType: LedgeGrabType;
	public StartLedgeGrab(Controller: ClientComponent, FixedHeight?: number, ForceType?: LedgeGrabType) {
		if (Controller.GetVelocity().y <= -65) return false;

		const Grounded = Controller.State === "Grounded";

		let Origin = Controller.GetCFrame(true);
		const YSpeed = Controller.GetVelocity().y;
		let GrabHeight = FixedHeight ?? (Grounded ? 3 : 2.75 + (YSpeed > 0 ? math.clamp(YSpeed / 6, 0, 0.75) : 0));

		if (!Grounded) {
			let RayLength = 0.85 * math.clamp(-YSpeed / 10, 1, 3);
			let DownRay = Raycast(Origin.Position, Vector3.down, RayLength, Color.magenta);
			if (DownRay.Hit) RayLength = DownRay.Pos.sub(Origin.Position).magnitude;
			Origin = Origin.add(Vector3.down.mul(RayLength));
			GrabHeight += RayLength;
		}

		const UpRay = Raycast(Origin.Position, Vector3.up, GrabHeight, Color.yellow);
		if (UpRay.Hit) GrabHeight = UpRay.Pos.sub(Origin.Position).magnitude;
		else Origin = Origin.add(new Vector3(0, 0.25, 0));

		for (const Height of $range(0, GrabHeight, 0.05)) {
			let Position = Origin.Position.add(new Vector3(0, Height, 0));
			const ForwardRay = Cubecast(Position, Origin.Forward, 1, 0.2, Origin.Rotation);
			if (!ForwardRay.Hit) {
				for (const Distance of $range(0, 2.25, 0.05)) {
					let Position = Origin.Position.add(new Vector3(0, Height, 0)).add(Origin.Forward.mul(Distance));
					const DownRay = Raycast(Position, Vector3.down, Height, Color.red);
					if (DownRay.Hit) {
						const CheckAgainst = (Height: number, Direction: Vector3) => {
							return Raycast(DownRay.Pos.add(new Vector3(0, Height + 0.05, 0)).sub(Direction.mul(0.25)), Direction, 0.5, Color.blue).Hit;
						};

						let Success = true;
						for (const Height of $range(0, 0, 0.25)) {
							if (CheckAgainst(Height, Origin.Forward) || CheckAgainst(Height, Origin.Back)) {
								Success = false;
								break;
							}
						}

						if (Success) {
							const UnderKnees = DownRay.Pos.y <= Origin.Position.y + 0.65;
							const UnderWaist = DownRay.Pos.y <= Origin.Position.y + 1.25;

							task.spawn(() =>
								this.StepLedgeGrab(Controller, DownRay.Pos, ForceType ?? (UnderKnees ? LedgeGrabType.VaultLow : UnderWaist ? LedgeGrabType.VaultHigh : LedgeGrabType.LedgeGrab)),
							);

							return true;
						}
					}
				}
			}
		}

		return false;
	}

	public StepLedgeGrab(Controller: ClientComponent, EndPosition: Vector3, Type: LedgeGrabType) {
		const IsKinematic = Type === LedgeGrabType.LedgeGrab;

		this.LedgeGrabType = Type;

		Controller.State = "LedgeGrab";
		Controller.ResetLastFallSpeed();
		this.ShrinkCollider(Controller);

		const VirtualSpeed = math.max(Controller.Momentum, Controller.Rigidbody.linearVelocity.magnitude);
		const CurrentMagnitude = Controller.Input.GetMoveVector().magnitude > 0 ? VirtualSpeed : 0;
		const Velocity = Controller.Rigidbody.linearVelocity;
		if (IsKinematic) {
			Controller.Rigidbody.isKinematic = true;
		} else {
			Controller.Rigidbody.linearVelocity = Controller.transform.TransformVector(Vector3.forward.mul(CurrentMagnitude));
		}

		Controller.Animator.AnimationController.Current = IsKinematic ? "VM_LedgeGrab" : "VM_VaultStart";

		Core().Client.Sound.Play("grab");

		const Origin = Controller.GetCFrame(true);
		let LastPosition = Origin.Position;

		if (IsKinematic) {
			const EdgeGrabPosition = EndPosition.add(Origin.Back.mul(0.515)).add(Origin.Down.mul(1.67));
			const UpTween = Tween.Vector3(
				TweenEasingFunction.InOutSine,
				0.07,
				(Position) => {
					if (!Controller) return;
					Controller.Rigidbody.MovePosition(Position);
				},
				LastPosition,
				EdgeGrabPosition,
			);
			UpTween.OnCompleted.Wait();
			LastPosition = EdgeGrabPosition;
		}

		let ClimbSpeed = math.clamp(LastPosition.sub(EndPosition).magnitude / 6 - 0.2, 0.5, 1);
		const PositionTween = Tween.Vector3(
			TweenEasingFunction.InSine,
			IsKinematic ? 0.5 * ClimbSpeed : 0.15,
			(Position) => {
				if (!Controller) return;
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
		if (!Controller) return;
		if (IsKinematic) {
			Controller.Rigidbody.isKinematic = false;
			Controller.Rigidbody.linearVelocity = Velocity;
		}

		this.ResetCollider(Controller);
		Controller.State = "Airborne";

		Controller.Gear.ResetAmmo(["Jump"]);
		const StickHeld = Controller.Input.GetMoveVector().magnitude > 0;
		if (Type === LedgeGrabType.VaultHigh || Type === LedgeGrabType.VaultLow) {
			if (Actions.LedgeGrab.Active) {
				if (!StickHeld) {
					// purely vertical speed
					Controller.Rigidbody.linearVelocity = Controller.GetCFrame()
						.Forward.mul(VirtualSpeed)
						.div(4)
						.WithY(VirtualSpeed * 0.875 + Config.LedgeGrabUpSpeed());
				} else {
					// horizontal launch
					Controller.Rigidbody.linearVelocity = Controller.GetCFrame()
						.Forward.WithY(Config.LedgeGrabForwardY())
						.normalized.mul(VirtualSpeed + Config.LedgeGrabForwardSpeed());
				}

				Controller.Animator.AnimationController.Current = "VM_VaultLaunch";
			} else {
				// generic forward vault
				Controller.Rigidbody.linearVelocity = Controller.GetCFrame().Forward.WithY(0.25).normalized.mul(CurrentMagnitude);

				Controller.Animator.AnimationController.Current = "VM_VaultEnd";
			}

			this.JumpTimer = 1;
		} else if (Type === LedgeGrabType.LedgeGrab) {
			this.SyncMomentum(Controller, 1 / 60);

			const TargetVelocity = StickHeld ? math.min(Controller.Momentum, 15) : 0;
			Controller.Rigidbody.linearVelocity = Controller.GetCFrame().Forward.WithY(0).mul(TargetVelocity);
			Controller.Land();
		}
	}
	// #endregion

	public ShrinkCollider(Controller: ClientComponent) {
		Controller.BodyCollider.center = new Vector3(0, 1.25, 0);
		Controller.BodyCollider.radius = 0.1;
		Controller.BodyCollider.height = 0;
	}
	public ResetCollider(Controller: ClientComponent) {
		Controller.BodyCollider.center = new Vector3(0, 0.5, 0);
		Controller.BodyCollider.radius = Config.PlayerRadius;
		Controller.BodyCollider.height = Config.PlayerHeight;
	}

	// #region Slide
	public StartSlide(Controller: ClientComponent) {
		if (Controller.Rigidbody.linearVelocity.WithY(0).magnitude < Config.SlideThreshold) return;
		Controller.State = "Slide";
		Core().Client.Sound.Play("slidestart");
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

		this.StartDropdown(Controller);

		if (Controller.State === "Slide" && (!Actions.Slide.Active || !Controller.Floor.Touching)) {
			this.EndSlide(Controller);
		}
	}
	// #endregion

	// #region Dropdwon
	public StartDropdown(Controller: ClientComponent) {
		const CFrame = Controller.GetCFrame();
		const ForwardCast = Raycast(CFrame.Position, CFrame.Forward.mul(Config.DropdownDistance), 1);
		if (!ForwardCast.Hit) {
			const DownCast = Raycast(CFrame.Position.add(CFrame.Forward.mul(Config.DropdownDistance)), Vector3.down, Config.DropdownHeight);
			if (!DownCast.Hit) {
				Controller.State = "Dropdown";
				task.spawn(() => this.StepDropdown(Controller));
			}
		}
	}

	public StepDropdown(Controller: ClientComponent) {
		this.ResetDash();
		this.StartDash(Controller);

		Controller.AnimationController.Current = "VM_Dropdown";

		const CFrame = Controller.GetCFrame();

		Controller.SetVelocity(Controller.GetVelocity().mul(new Vector3(0.75, 1, 0.75)));

		this.ShrinkCollider(Controller);

		let Distance = Config.DropdownDistance;
		for (const DistanceShort of $range(Distance, 0, -0.05)) {
			const DownRay = Raycast(CFrame.Position.add(CFrame.Forward.mul(DistanceShort)), new Vector3(0, -Config.DropdownHeight, 0), Distance);
			if (DownRay.Hit) {
				Distance = DistanceShort;
				break;
			}
		}

		let LastPosition = Controller.GetCFrame(true).Position;
		const PositionTween = Tween.Vector3(
			TweenEasingFunction.InSine,
			0.25,
			(Position) => {
				const PositionOffset = Position.sub(LastPosition);
				LastPosition = Position;
				Controller.Rigidbody.MovePosition(Controller.Rigidbody.position.add(PositionOffset));
			},
			LastPosition,
			CFrame.Position.add(CFrame.Forward.mul(Distance)).sub(new Vector3(0, Config.DropdownHeight, 0)),
		);

		PositionTween.OnCompleted.Wait();

		if (Controller.State === "Dropdown") {
			Controller.State = "Airborne";
			this.ResetCollider(Controller);
			this.EndDash();
		}
	}
	// #endregion

	public StartWallKick(Controller: ClientComponent) {
		const Velocity = Controller.GetVelocity();
		if (Controller.Gear.Ammo.WallKick < 1 || Velocity.y <= -45) return;
		const CFrame = Controller.GetCFrame();

		if (!this.DashActive()) return;

		const BackCast = Raycast(CFrame.Position, CFrame.Back, 2);
		if (BackCast.Hit) {
			Controller.SetVelocity(CFrame.Forward.mul(12.5).WithY(math.max(Velocity.y, 16)));
			Controller.Gear.Ammo.WallKick--;

			Controller.Input.KeyReleased("Jump", true);
			Controller.AnimationController.Current = "VM_JumpR"; // TEMP
			this.JumpTimer = 1.25;

			Core().Client.Sound.Play("footstepfast"); // TEMP
		}
	}

	public ResetState() {
		this.ResetDash();

		this.JumpTimer = 0;
		this.WallrunTimer = 0;
		this.WallclimbFailTimer = 0;
		this.WallclimbTimer = 0;
		this.WallclimbFailTimer = 0;
		this.LastJump = "R";
	}
}
