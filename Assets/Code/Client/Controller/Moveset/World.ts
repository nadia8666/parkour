import { TweenEasingFunction } from "@Easy/Core/Shared/Tween/EasingFunctions";
import { Tween } from "@Easy/Core/Shared/Tween/Tween";
import Core from "Code/Core/Core";
import type ClientComponent from "../ClientComponent";
import { Actions } from "../Input";
import type { VirtualizedLadder } from "../Modules/Ladder/Ladders";
import { LedgeGrabType } from "./Base";

export class MovesetWorld {
	public LastLadder = os.clock();
	public CurrentLadder: VirtualizedLadder | undefined;
	public LadderOffset = Vector3.zero;
	public LastLadderJump = os.clock();

	public StartLadder(Controller: ClientComponent) {
		if (os.clock() - this.LastLadder <= 0.35) return;
		const Ladders = Core().Client.World.Ladders;

		const Ladder = Ladders.GetTouchingLadder(Controller);
		if (Ladder) {
			Controller.State = "LadderClimb";
			const [Center, Size] = Core().Client.World.Ladders.GetLadderInfo(Ladder);
			let LocalOffset = Center.PointToObjectSpace(Controller.GetCFrame(true).Position);
			LocalOffset = LocalOffset.WithY(math.clamp(LocalOffset.y, -Size.y / 2, Size.y / 2 - 1.75));

			this.LadderOffset = LocalOffset;
			Tween.Vector3(
				TweenEasingFunction.OutSine,
				0.1,
				(Position) => {
					if (!Controller) return;
					this.LadderOffset = Position;
				},
				LocalOffset,
				Vector3.zero,
			);

			Controller.transform.position = Center.PointToWorldSpace(LocalOffset);
			Controller.transform.rotation = Center.Rotation;
			Controller.SetVelocity(Vector3.zero);
			this.CurrentLadder = Ladder;
			this.LastLadder = os.clock();

			Controller.Gear.ResetAmmo();

			Controller.Moveset.Base.ShrinkCollider(Controller);

			Core().Client.Sound.Play("laddergrab");
		}

		return false;
	}

	public StepLadder(Controller: ClientComponent, FixedDT: number) {
		if (!this.CurrentLadder) return;
		const Direction = Controller.Input.GetMoveVector().z;
		const [Center, Size] = Core().Client.World.Ladders.GetLadderInfo(this.CurrentLadder);

		let TargetVelocity = new Vector3(0, Direction * 6, 0);
		let Sliding = false;

		if (Actions.Slide.Active && ["VM_LadderClimb", "VM_LadderSlide"].includes(Controller.AnimationController.Current)) {
			Sliding = true;
			TargetVelocity = Vector3.down.mul(13.5);
		}

		Controller.SetVelocity(Controller.GetVelocity().MoveTowards(Controller.GetCFrame().VectorToWorldSpace(TargetVelocity), FixedDT * 15));

		let Height = Center.PointToObjectSpace(Controller.GetCFrame(true).Position).y;
		Controller.transform.position = Center.PointToWorldSpace(this.LadderOffset.WithY(math.clamp(Height, -Size.y / 2, Size.y / 2)));

		const LocalSpeed = Controller.GetCFrame().VectorToObjectSpace(Controller.GetVelocity()).y;
		const Grounded = Controller.Floor.Touching;
		if (Height < -Size.y / 2 - 0.65 || (Grounded && os.clock() - this.LastLadder >= 1.25 && LocalSpeed < 0)) {
			if (Grounded) Controller.Land();
			else Controller.State = "Airborne";

			this.ResetLadder(Controller);
		} else if (Height > Size.y / 2 - 1.75 && LocalSpeed > 0) {
			this.ResetLadder(Controller);
			Controller.State = "LedgeGrab";
			task.spawn(() =>
				Controller.Moveset.Base.StepLedgeGrab(
					Controller,
					Center.PointToWorldSpace(
						this.LadderOffset.WithY(Size.y / 2)
							//.add(new Vector3(0, 0.1, 0))
							.add(Center.Forward.WithY(0).normalized.mul(0.25)),
					),
					LedgeGrabType.LedgeGrab,
				),
			);

			return;
		} else if (Height > Size.y + 0.25) {
			this.ResetLadder(Controller);
			Controller.State = "Airborne";
		}

		if (!Controller.AnimationController.Current.find("VM_LadderJump")[0]) {
			if (Sliding && Controller.AnimationController.Current !== "VM_LadderSlide") {
				Controller.SetVelocity(new Vector3(0, -6, 0));
			}
			Controller.AnimationController.Current = Sliding ? "VM_LadderSlide" : "VM_LadderClimb";
			Controller.AnimationController.Speed = LocalSpeed;
		}
	}

	public ResetLadder(Controller: ClientComponent) {
		const YRotation = Controller.GetCFrame().Rotation.eulerAngles.y;
		Controller.transform.rotation = Quaternion.Euler(0, YRotation, 0);

		this.LastLadder = os.clock();
		this.CurrentLadder = undefined;
		Controller.Moveset.Base.ResetCollider(Controller);
	}

	public StartZipline(_Controller: ClientComponent) {}

	public StartObjects(Controller: ClientComponent) {
		return this.StartLadder(Controller) || this.StartZipline(Controller);
	}
}
