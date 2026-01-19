import { TweenEasingFunction } from "@Easy/Core/Shared/Tween/EasingFunctions";
import { Tween } from "@Easy/Core/Shared/Tween/Tween";
import Core from "Code/Core/Core";
import type ClientComponent from "../ClientComponent";
import type { VirtualizedLadder } from "../Modules/Ladder/Ladders";
import { LedgeGrabType } from "./Base";

export class MovesetWorld {
	public LastLadder = os.clock();
	public CurrentLadder: VirtualizedLadder | undefined;
	public LadderOffset = Vector3.zero;

	public StartLadder(Controller: ClientComponent) {
		if (os.clock() - this.LastLadder <= 0.35) return;
		const Ladders = Core().Client.World.Ladders;

		const Ladder = Ladders.GetTouchingLadder(Controller);
		if (Ladder) {
			Controller.State = "LadderClimb";
			const [Center, Size] = Core().Client.World.Ladders.GetLadderInfo(Ladder);
			let LocalOffset = Center.PointToObjectSpace(Controller.GetCFrame(true).Position);
			LocalOffset = LocalOffset.WithY(math.clamp(LocalOffset.y, -Size.y / 2, Size.y / 2));

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

		Controller.SetVelocity(Controller.GetVelocity().MoveTowards(new Vector3(0, Direction * 6, 0), FixedDT * 15));

		let Height = Center.PointToObjectSpace(Controller.GetCFrame(true).Position).y;
		Controller.transform.position = Center.PointToWorldSpace(this.LadderOffset.WithY(math.clamp(Height, -Size.y / 2, Size.y / 2)));

		const Grounded = Controller.Floor.Touching;
		if (Height < -Size.y / 2 + 0.25 || (Grounded && os.clock() - this.LastLadder >= 0.5)) {
			if (Grounded) Controller.Land();
			else Controller.State = "Airborne";

			this.ResetLadder(Controller);
		} else if (Height > Size.y / 2) {
			Controller.State = "LedgeGrab";
			task.spawn(() =>
				Controller.Moveset.Base.StepLedgeGrab(
					Controller,
					Center.PointToWorldSpace(
						this.LadderOffset.WithY(Size.y / 2)
							.add(new Vector3(0, 0.1, 0))
							.add(Center.Forward.WithY(0).normalized.mul(0.25)),
					),
					LedgeGrabType.LedgeGrab,
				),
			);
		}

		Controller.AnimationController.Current = "VM_LadderClimb";
		Controller.AnimationController.Speed = Controller.GetVelocity().magnitude;
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
