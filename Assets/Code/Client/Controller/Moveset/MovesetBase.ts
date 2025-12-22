import { Airship } from "@Easy/Core/Shared/Airship";
import { Binding } from "@Easy/Core/Shared/Input/Binding";
import { TweenEasingFunction } from "@Easy/Core/Shared/Tween/EasingFunctions";
import { Tween } from "@Easy/Core/Shared/Tween/Tween";
import { Keyboard } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import { Gravity } from "Code/Client/Framework/FrameworkController";
import type ClientController from "../ClientController";
import type { ValidStates } from "../ClientController";
import type GenericTrigger from "../GenericTrigger";

const CollisionLayer = LayerMask.GetMask("GameLayer0");

class InputEntry {
	public Active = false;

	constructor(
		public readonly Key: Key,
		public readonly Priority: number,
	) {}
}

const Inputs = {
	Jump: new InputEntry(Key.Space, 3),
	Wallclimb: new InputEntry(Key.Space, 2),
	Wallrun: new InputEntry(Key.Space, 1),
	LedgeGrab: new InputEntry(Key.Space, 0),
};

for (const [Name, Entry] of pairs(Inputs)) {
	Airship.Input.CreateAction(Name, Binding.Key(Entry.Key));
}

export class MovesetBase {
	public JumpTimer = 0;
	public WallclimbTimer = 0;
	public WallrunTimer = 0;
	public WallrunTarget: GenericTrigger;

	private readonly KeyMap = new Map<Key, Array<keyof typeof Inputs>>();

	public Bin = new Bin();
	public BindInputs() {
		this.Bin.Clean();

		for (const [Name] of pairs(Inputs)) {
			this.Bin.Add(Airship.Input.OnDown(Name).Connect(() => this.KeyPressed(Name)));
			this.Bin.Add(Airship.Input.OnUp(Name).Connect(() => this.KeyReleased(Name)));
		}
	}

	public KeyReleased(Name: keyof typeof Inputs) {
		const Entry = Inputs[Name];
		const ExistingKeys = this.KeyMap.get(Entry.Key);

		if (ExistingKeys) {
			const Index = ExistingKeys.indexOf(Name);

			if (Index > -1) {
				ExistingKeys.remove(Index);
			}
		}
	}

	public KeyPressed(Name: keyof typeof Inputs) {
		const Entry = Inputs[Name];

		const ExistingKeys = this.KeyMap.get(Entry.Key);
		if (ExistingKeys) {
			ExistingKeys.push(Name);
			ExistingKeys.sort((Name1, Name2) => {
				const [Entry1, Entry2] = [Inputs[Name1], Inputs[Name2]];
				return Entry1.Priority > Entry2.Priority;
			});
		} else {
			this.KeyMap.set(Entry.Key, [Name]);
		}
	}

	public ActionPressed(Name: keyof typeof Inputs, Controller: ClientController) {
		switch (Name) {
			case "Jump": {
				const JumpStates = new Set<ValidStates>(["Grounded", "Wallrun"]);
				if (JumpStates.has(Controller.State)) {
					this.KeyReleased("Wallclimb");
					this.KeyReleased("Wallrun");

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
					this.KeyReleased("Jump");

					this.WallrunStart(Controller);
				}
				break;
		}
	}

	public UpdateInputs(Controller: ClientController) {
		for (const [Name, Entry] of pairs(Inputs)) {
			const ExistingKeys = this.KeyMap.get(Entry.Key);

			if (ExistingKeys) {
				const Index = ExistingKeys.includes(Name);

				if (Index && !Entry.Active) {
					Entry.Active = true;
					this.ActionPressed(Name, Controller);
				} else if (!Index && Entry.Active) {
					Entry.Active = false;
				}
			} else if (Entry.Active) {
				Entry.Active = false;
			}
		}
	}

	public Jump(Controller: ClientController) {
		if (Controller.State === "Wallrun") {
			const CurrentMagnitude = Controller.Rigidbody.linearVelocity.magnitude;
			const CameraLook = Camera.main.transform.rotation.mul(Vector3.forward);
			Controller.Rigidbody.linearVelocity = CameraLook.WithY(1).normalized.mul(CurrentMagnitude + 8.5);
		} else {
			Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(12);
		}
		Controller.State = "Airborne";

		this.JumpTimer = 1;
	}

	public JumpHold(Controller: ClientController, FixedDT: number) {
		if (this.JumpTimer <= 0) return;

		if (Inputs.Jump.Active) {
			this.JumpTimer -= FixedDT;
			Controller.Rigidbody.AddForce(new Vector3(0, this.JumpTimer / 1.5, 0), ForceMode.VelocityChange);
		} else {
			this.JumpTimer = 0;
		}
	}

	public Walk(Controller: ClientController) {
		const LocalMoveVector = new Vector3(
			(Keyboard.IsKeyDown(Key.A) ? -1 : 0) + (Keyboard.IsKeyDown(Key.D) ? 1 : 0),
			0,
			(Keyboard.IsKeyDown(Key.S) ? -1 : 0) + (Keyboard.IsKeyDown(Key.W) ? 1 : 0),
		);

		const TargetVelocity = Controller.Rigidbody.transform.TransformVector(LocalMoveVector);
		const CurrentVelocity = Controller.Rigidbody.linearVelocity.WithY(0).magnitude;
		const AccelerationForce = Controller.AccelerationCurve.Evaluate(math.clamp(CurrentVelocity, 0, 15) / 15) * 20;
		const GlobalMoveVector = TargetVelocity.magnitude > 0 ? TargetVelocity.normalized : Vector3.zero;

		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.MoveTowards(Vector3.zero.WithY(Controller.Rigidbody.linearVelocity.y), 0.45); // friction
		Controller.Rigidbody.AddForce(GlobalMoveVector.mul(AccelerationForce), ForceMode.Acceleration); // acceleration
	}

	public WallclimbStart(Controller: ClientController) {
		// TODO: slip glove min -45
		if (!Controller.Wallclimb.Touching || Controller.Rigidbody.linearVelocity.y < -10) return;

		const Root = Controller.GetCFrame();
		const [Hit, _, Normal] = Physics.Raycast(Root.Position, Root.Rotation.mul(Vector3.forward), 5, CollisionLayer);
		if (!Hit) return;

		const TargetLook = Quaternion.LookRotation(Normal.mul(-1), Vector3.up);
		Controller.Rigidbody.rotation = TargetLook;

		// TODO: make grip glove give minimum 7, gloveless minimum 0, slip glove min -10
		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(math.max(Controller.Rigidbody.linearVelocity.y, 5));

		Controller.State = "Wallclimb";
		this.WallclimbTimer = 1;
	}

	public WallclimbUpdate(Controller: ClientController, FixedDT: number) {
		if (!Controller.Wallclimb.Touching || !Inputs.Wallclimb.Active || this.WallclimbTimer <= 0) {
			Controller.State = "Airborne";
			return;
		}

		this.WallclimbTimer -= FixedDT;
		Controller.Rigidbody.AddForce(Vector3.up.mul(this.WallclimbTimer / 6), ForceMode.VelocityChange);
		Controller.Rigidbody.AddForce(Controller.GetCFrame().Rotation.mul(Vector3.forward), ForceMode.VelocityChange);

		this.TryLedgeGrab(Controller);
	}

	public WallrunStart(Controller: ClientController) {
		const [TouchingL, TouchingR] = [Controller.WallrunL.Touching, Controller.WallrunR.Touching];

		if ((!TouchingL && !TouchingR) || Controller.Rigidbody.linearVelocity.y <= -75) return;

		let Target: GenericTrigger | undefined;

		const Root = Controller.GetCFrame();
		const [LeftHit, _1, LeftNormal] = Physics.Raycast(Root.Position, Root.Rotation.mul(Vector3.left), 10, CollisionLayer);
		const [RightHit, _2, RightNormal] = Physics.Raycast(Root.Position, Root.Rotation.mul(Vector3.right), 10, CollisionLayer);
		const LDot = LeftHit ? -LeftNormal.Dot(Vector3.right) : -1;
		const RDot = RightHit ? -RightNormal.Dot(Vector3.left) : -1;

		if (!(LDot >= 0.35 || RDot >= 0.35)) return;

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

		Controller.State = "Wallrun";
		this.WallrunTimer = 2;
		this.WallrunTarget = Target;
	}

	public WallrunUpdate(Controller: ClientController, FixedDT: number) {
		if (!this.WallrunTarget.Touching || this.WallrunTimer <= 0) {
			Controller.State = "Airborne";
			return;
		}

		this.WallrunTimer -= FixedDT;

		const YSpeed = Controller.Rigidbody.linearVelocity.y;
		const Magnitude = Controller.Rigidbody.linearVelocity.WithY(YSpeed / 4).magnitude;
		const GravityAffector = 1 - this.WallrunTimer / 2;

		Controller.Rigidbody.linearVelocity = Controller.GetCFrame()
			.Rotation.mul(Vector3.forward.mul(Magnitude))
			.WithY(YSpeed)
			.add(Gravity.mul(GravityAffector * 1));
	}

	public TryLedgeGrab(Controller: ClientController) {
		if (!Inputs.LedgeGrab.Active || Controller.State === "LedgeGrab") return;

		if (Controller.LedgeGrab.Touching && !Controller.Wallclimb.Touching) {
			const Root = Controller.GetCFrame();
			const [Hit, HitPos] = Physics.Raycast(Root.Position.add(Root.Rotation.mul(Vector3.forward.mul(0.5))), new Vector3(0, -1, 0), 1.5, CollisionLayer);

			if (Hit) {
				Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.WithY(10);
				this.RunLedgeGrab(Controller, HitPos);
			}
		}
	}

	public RunLedgeGrab(Controller: ClientController, EndPosition: Vector3) {
		Controller.State = "LedgeGrab";
		Controller.BodyCollider.enabled = false;

		let LastPosition = Controller.GetCFrame().Position;
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
		Controller.BodyCollider.enabled = true;
		Controller.State = "Airborne";
	}
}
